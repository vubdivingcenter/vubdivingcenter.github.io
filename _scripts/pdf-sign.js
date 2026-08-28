import { PDFDocument, PDFName, PDFString, PDFHexString, PDFArray, PDFRef, StandardFonts } from 'pdf-lib';
import forge from 'node-forge';

// Aantal bytes gereserveerd voor de CMS-handtekening in de PDF
const PLACEHOLDER_SIZE = 8192;

const OID = {
    signedData: forge.pki.oids.signedData,
    data: forge.pki.oids.data,
    sha256: forge.pki.oids.sha256,
    sha256WithRSA: forge.pki.oids.sha256WithRSAEncryption,
    contentType: forge.pki.oids.contentType,
    messageDigest: forge.pki.oids.messageDigest,
    signingTime: forge.pki.oids.signingTime,
    essCertV2: '1.2.840.113549.1.9.16.2.47',
};

const U = forge.asn1.Class.UNIVERSAL;
const CTX = forge.asn1.Class.CONTEXT_SPECIFIC;
const T = forge.asn1.Type;

function oidNode(oid) {
    return forge.asn1.create(U, T.OID, false, forge.asn1.oidToDer(oid).getBytes());
}

function algorithmNode(oid) {
    return forge.asn1.create(U, T.SEQUENCE, true, [
        oidNode(oid),
        forge.asn1.create(U, T.NULL, false, ''),
    ]);
}

function attributeNode(oid, valueNode) {
    return forge.asn1.create(U, T.SEQUENCE, true, [
        oidNode(oid),
        forge.asn1.create(U, T.SET, true, [valueNode]),
    ]);
}

/**
 * Bouwt het signingCertificateV2-attribuut. Het identificeert het
 * signeer-certificaat (SHA-256 hash + issuer/serial) zodat readers het certificaat
 * uit de handtekening onmiskenbaar kunnen toewijzen. De encode volgt de
 * conventie van asn1crypto/pyHanko:
 * SET { SigningCertificateV2 { ESSCertIDv2s { ESSCertIDv2 { certHash, IssuerSerial } } } }
 * waarbij IssuerSerial.issuer een GeneralName directoryName ([4]) is.
 */
function essCertV2Attribute(cert) {
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const hash = forge.md.sha256.create();
    hash.update(certDer);
    const dn = forge.pki.distinguishedNameToAsn1(cert.issuer);
    const generalNames = forge.asn1.create(U, T.SEQUENCE, true, [
        forge.asn1.create(CTX, 4, true, [dn])]);
    const issuerSerial = forge.asn1.create(U, T.SEQUENCE, true, [
        generalNames,
        forge.asn1.create(U, T.INTEGER, false, forge.util.hexToBytes(cert.serialNumber))]);
    const essCertIdv2 = forge.asn1.create(U, T.SEQUENCE, true, [
        forge.asn1.create(U, T.OCTETSTRING, false, hash.digest().getBytes()),
        issuerSerial]);
    return attributeNode(OID.essCertV2,
        forge.asn1.create(U, T.SEQUENCE, true, [
            forge.asn1.create(U, T.SEQUENCE, true, [essCertIdv2])]));
}

/**
 * Bouwt een CMS SignedData-structuur (RFC 5652) die structureel identiek is aan
 * wat een conforme PAdES-tooling (bv. pyHanko) genereert:
 * - detached content (digest over het byte-bereik van de PDF)
 * - signed attributes: contentType, signingTime, messageDigest, signingCertificateV2
 * - het certificaat is ingebed
 * - de signatuur is een OCTET STRING (zoals pyHanko/openssl die genereren)
 */
function buildCms(cert, key, signedContent, signingTime) {
    const contentMd = forge.md.sha256.create();
    contentMd.update(signedContent.toString('binary'));

    const attrs = forge.asn1.create(U, T.SET, true, [
        attributeNode(OID.contentType, oidNode(OID.data)),
        attributeNode(OID.signingTime,
            forge.asn1.create(U, T.UTCTIME, false, forge.asn1.dateToUtcTime(signingTime))),
        attributeNode(OID.messageDigest,
            forge.asn1.create(U, T.OCTETSTRING, false, contentMd.digest().getBytes())),
        essCertV2Attribute(cert),
    ]);
    const attrsMd = forge.md.sha256.create();
    attrsMd.update(forge.asn1.toDer(attrs).getBytes());
    const signature = key.sign(attrsMd, 'RSASSA-PKCS1-V1_5');

    const certNode = forge.asn1.fromDer(forge.util.createBuffer(
        forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()));

    // signedAttrs is [0] IMPLICIT SET OF Attribute: de attributes staan dus
    // rechtstreeks onder [0] (de SET-tag wordt vervangen door [0]).
    const signerInfo = forge.asn1.create(U, T.SEQUENCE, true, [
        forge.asn1.create(U, T.INTEGER, false, forge.util.hexToBytes('01')),
        forge.asn1.create(U, T.SEQUENCE, true, [
            forge.pki.distinguishedNameToAsn1(cert.issuer),
            forge.asn1.create(U, T.INTEGER, false, forge.util.hexToBytes(cert.serialNumber))]),
        algorithmNode(OID.sha256),
        forge.asn1.create(CTX, 0, true, attrs.value),
        algorithmNode(OID.sha256WithRSA),
        forge.asn1.create(U, T.OCTETSTRING, false, signature),
    ]);

    // certificates is [0] IMPLICIT SET OF CertificateChoices: het certificaat
    // staat rechtstreeks onder [0] (de SET-tag wordt vervangen door [0])
    const signedData = forge.asn1.create(U, T.SEQUENCE, true, [
        forge.asn1.create(U, T.INTEGER, false, forge.util.hexToBytes('01')),
        forge.asn1.create(U, T.SET, true, [algorithmNode(OID.sha256)]),
        forge.asn1.create(U, T.SEQUENCE, true, [oidNode(OID.data)]),
        forge.asn1.create(CTX, 0, true, [certNode]),
        forge.asn1.create(U, T.SET, true, [signerInfo]),
    ]);

    const contentInfo = forge.asn1.create(U, T.SEQUENCE, true, [
        oidNode(OID.signedData),
        forge.asn1.create(CTX, 0, true, [signedData]),
    ]);

    return forge.asn1.toDer(contentInfo);
}

/**
 * Ondertekent een PDF met een PAdES (adbe.pkcs7.detached) handtekening die
 * herkend wordt door standaard PDF-readers (Adobe Reader, Chrome, ...).
 *
 * @param {Buffer|Uint8Array} pdfBytes De (nog niet) ondertekende PDF
 * @param {Object} options
 * @param {string} options.certPem PEM-certificaat van de ondertekenaar
 * @param {string} options.keyPem PEM-private key die bij het certificaat hoort
 * @param {string} [options.signerName] Naam voor /Name en de zichtbare stempel
 * @param {string} [options.location] Plaats (voor /Location)
 * @param {string} [options.reason] Reden (voor /Reason)
 * @returns {Promise<Buffer>} De ondertekende PDF
 */
export async function signPdf(pdfBytes, options) {
    const { certPem, keyPem, location, reason } = options;
    const cert = forge.pki.certificateFromPem(certPem);
    const key = forge.pki.privateKeyFromPem(keyPem);
    const signerName = options.signerName || cert.subject.attributes
        .filter(a => a.name === 'commonName')
        .map(a => a.value)
        .join(' ');

    const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    const page = doc.getPage(0);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const stampX = 370, stampY = 70, stampW = 205, stampH = 64;
    const nu = new Date();
    const p2 = n => String(n).padStart(2, '0');
    // PDF-datum in UTC (Z) voor /M
    const m = `D:${nu.getUTCFullYear()}${p2(nu.getUTCMonth() + 1)}${p2(nu.getUTCDate())}`
        + `${p2(nu.getUTCHours())}${p2(nu.getUTCMinutes())}${p2(nu.getUTCSeconds())}Z`;
    // lokale weergave voor de zichtbare stempel
    const datumTijd = `${p2(nu.getDate())}/${p2(nu.getMonth() + 1)}/${nu.getFullYear()}`
        + ` ${p2(nu.getHours())}:${p2(nu.getMinutes())}`;

    // De zichtbare handtekening is het /AP-weergave-object van het veld (niet in
    // de pagina-inhoud getekend), zodat de reader de stempel als handtekeningsveld
    // behandelt en toont.
    const esc = t => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const nameLine = esc(signerName);
    const apContent = [
        'q',
        '0.95 0.97 1 rg',
        `0 0 ${stampW} ${stampH} re f`,
        '0.1 0.4 0.7 RG 1 w',
        `0 0 ${stampW} ${stampH} re S`,
        `BT /F2 9 Tf 0.1 0.4 0.7 rg 10 ${stampH - 18} Td (${esc('DIGITAAL ONDERTEKEND')}) Tj ET`,
        `BT /F1 7.5 Tf 0.25 0.25 0.25 rg 10 ${stampH - 32} Td (${nameLine}) Tj ET`,
        `BT /F1 7.5 Tf 0.25 0.25 0.25 rg 10 ${stampH - 46} Td (${esc(`Ondertekend op ${datumTijd}`)}) Tj ET`,
        'Q',
    ].join('\n');
    const apRef = doc.context.register(doc.context.stream(apContent, {
        Type: 'XObject',
        Subtype: 'Form',
        BBox: [0, 0, stampW, stampH],
        Resources: { Font: { F1: fontRegular.ref, F2: fontBold.ref } },
    }));

    const placeholderHex = '0'.repeat(PLACEHOLDER_SIZE * 2);
    const sigDict = doc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        Contents: PDFHexString.of(placeholderHex),
        ByteRange: [0, 1111111111, 2222222222, 3333333333],
        M: PDFString.of(m),
        Name: PDFString.of(signerName),
        Location: PDFString.of(location || ''),
        Reason: PDFString.of(reason || ''),
    });
    const sigRef = doc.context.register(sigDict);

    const widget = doc.context.register(doc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        T: PDFString.of('ondertekening'),
        F: 4,
        Rect: [stampX, stampY, stampX + stampW, stampY + stampH],
        V: sigRef,
        AP: { N: apRef },
    }));

    const annots = PDFArray.withContext(doc.context);
    annots.push(widget);
    page.node.set(PDFName.of('Annots'), annots);

    const acroForm = doc.catalog.getOrCreateAcroForm();
    acroForm.dict.set(PDFName.of('SigFlags'), doc.context.obj(3));
    const fields = PDFArray.withContext(doc.context);
    fields.push(widget);
    acroForm.dict.set(PDFName.of('Fields'), fields);

    // Eerste save: objectnummers bepalen. /P (de verwijzing van het veld naar
    // de pagina) kan pas nu worden opgevuld, omdat het objectnummer van de
    // pagina pas bij het schrijven bekend is.
    let s = Buffer.from(await doc.save({ useObjectStreams: false })).toString('latin1');
    const widgetMatch = s.match(/(\d+) 0 obj\n<<\n\/Type \/Annot\n\/Subtype \/Widget\n\/FT \/Sig/);
    if (!widgetMatch) throw new Error('Widget-object niet gevonden in de gegenereerde PDF');
    const widgetNum = widgetMatch[1];
    const annotsIdx = s.search(new RegExp('/Annots \\[[^\\]]*?\\b' + widgetNum + ' 0 R[^\\]]*\\]'));
    if (annotsIdx === -1) throw new Error('Pagina-object met de handtekening niet gevonden');
    let pageNum = null;
    for (const hm of s.slice(0, annotsIdx).matchAll(/(\d+) 0 obj/g)) pageNum = hm[1];
    if (!pageNum) throw new Error('Pagina-objectnummer niet gevonden');
    doc.context.lookup(widget).set(PDFName.of('P'), PDFRef.of(Number(pageNum)));

    // Tweede save: dezelfde indeling, nu met /P in het widget-object
    s = Buffer.from(await doc.save({ useObjectStreams: false })).toString('latin1');

    const placeholderPos = s.indexOf('<' + placeholderHex + '>');
    if (placeholderPos === -1) {
        throw new Error('Handtekening-placeholder niet gevonden in de gegenereerde PDF');
    }
    const contentStart = placeholderPos + 1;
    const contentEnd = contentStart + placeholderHex.length + 1;
    const byteRange = [0, contentStart, contentEnd, s.length - contentEnd];

    // De ByteRange-waarden op hun plaats vervangen (rechts uitgelijnd, lengte
    // blijft 10 tekens). Die cijfers liggen binnen het gesigneerde bereik; de
    // digest wordt daardoor over de uiteindelijke bytes berekend.
    const sentinels = ['1111111111', '2222222222', '3333333333'];
    let offset = s.indexOf(sentinels[0]);
    if (offset === -1) throw new Error('ByteRange-placeholder niet gevonden');
    for (let i = 0; i < sentinels.length; i++) {
        if (s.substr(offset, 10) !== sentinels[i]) {
            throw new Error('Verwachte ByteRange-placeholder niet aangetroffen');
        }
        s = s.slice(0, offset) + String(byteRange[i + 1]).padStart(10, ' ') + s.slice(offset + 10);
        if (i < sentinels.length - 1) {
            offset = s.indexOf(sentinels[i + 1], offset + 10);
            if (offset === -1) throw new Error('ByteRange-placeholder niet volledig gevonden');
        }
    }

    const finalPdf = Buffer.from(s, 'latin1');
    const signedContent = Buffer.concat([
        finalPdf.subarray(byteRange[0], byteRange[0] + byteRange[1]),
        finalPdf.subarray(byteRange[2], byteRange[2] + byteRange[3]),
    ]);

    const cms = buildCms(cert, key, signedContent, nu);
    const cmsBytes = Buffer.from(cms.getBytes(), 'binary');
    if (cmsBytes.length > PLACEHOLDER_SIZE) {
        throw new Error(`CMS-handtekening (${cmsBytes.length} bytes) past niet in de placeholder (${PLACEHOLDER_SIZE} bytes)`);
    }

    // Alleen de hex-regio wordt nog vervangen; die valt buiten het gesigneerde bereik.
    finalPdf.write(cmsBytes.toString('hex').padEnd(placeholderHex.length, '0'), contentStart, 'ascii');

    return finalPdf;
}
