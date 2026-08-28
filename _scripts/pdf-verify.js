import forge from 'node-forge';

// OID's
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';

function formatDn(dn) {
    return (dn?.attributes || [])
        .map(a => `${a.shortName || a.name}=${a.value}`)
        .join(', ');
}

function derSequenceLength(buf, offset) {
    // offset wijst naar het SEQUENCE-tag; de lengte staat op offset+1
    const first = buf[offset + 1];
    if (first < 0x80) return { length: first, headerSize: 2 };
    const numBytes = first & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) length = length * 256 + buf[offset + 2 + i];
    return { length, headerSize: 2 + numBytes };
}

function findSignatureDictionaries(s) {
    const matches = [...s.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
    return matches.map(m => [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
}

/**
 * Verifieert de (laatste) PAdES-handtekening van een PDF.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {{
 *   geldig: boolean,
 *   ondertekenaar: string,
 *   ondertekendOp: string|null,
 *   plaats: string|null,
 *   reden: string|null,
 *   digestKlopt: boolean,
 *   handtekeningGeldig: boolean,
 *   certificaat: { onderwerp: string, geldigVan: Date, geldigTot: Date, zelfOndertekend: boolean },
 *   fouten: string[]
 * }}
 */
export function verifyPdfSignature(pdfBytes) {
    const buf = Buffer.from(pdfBytes);
    const s = buf.toString('latin1');
    const fouten = [];

    const ranges = findSignatureDictionaries(s);
    if (ranges.length === 0) {
        throw new Error('Geen /ByteRange gevonden: deze PDF heeft geen digitale handtekening');
    }
    // /ByteRange [offset1, lengte1, offset2, lengte2]
    const [a, b, c, d] = ranges[ranges.length - 1];
    if (a !== 0 || c + d !== buf.length || c <= a + b) {
        fouten.push('ByteRange is inconsistent met de grootte van het bestand');
    }

    // De hex-string ligt tussen < en >; het openende < staat op het einde van
    // het eerste bereik of één byte ervoor, afhankelijk van de producer.
    const contentStart = a + b;
    const contentEnd = c;
    const openPos = s[contentStart] === '<' ? contentStart : contentStart - 1;
    const closePos = s[contentEnd - 1] === '>' ? contentEnd - 1 : contentEnd;
    if (s[openPos] !== '<' || s[closePos] !== '>') {
        throw new Error('Handtekeninginhoud niet correct gevonden in het bestand');
    }

    // CMS-DER oplossen: de DER-Sequence heeft een vaste lengte, de rest is null-padding
    const cmsHex = s.slice(openPos + 1, closePos);
    const der = Buffer.from(cmsHex, 'hex');
    const outer = derSequenceLength(der, 0);
    const cmsDer = der.subarray(0, outer.headerSize + outer.length);

    const contentInfo = forge.asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')));
    const signedData = contentInfo.value[1].value[0];
    const nodes = signedData.value;

    const certsNode = nodes.find(n => n.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && n.type === 0);
    const signerInfosNode = nodes[nodes.length - 1];
    if (!certsNode || !signerInfosNode) {
        throw new Error('CMS-structuur onherkenbaar (geen certificaten of SignerInfo)');
    }

    // Het certificaat staat in [0] of in een SET in [0] (conforme CMS)
    let certNode = certsNode.value[0];
    if (certNode.tagClass === forge.asn1.Class.UNIVERSAL && certNode.type === forge.asn1.Type.SET) {
        certNode = certNode.value[0];
    }
    const cert = forge.pki.certificateFromAsn1(certNode);

    // SignerInfo: [versie, issuerAndSerial, digestAlgoritme, [0] signedAttrs?, signAlgoritme, signatuur]
    const si = signerInfosNode.value[0].value;
    let signedAttrs = null;
    for (const node of si) {
        if (node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 0) {
            // [0] IMPLICIT SET OF Attribute: de attributes staan direct in .value
            signedAttrs = node;
        }
    }
    // De signatuur is het laatste element van de SignerInfo: een OCTET STRING
    // (zoals pyHanko/openssl die schrijven) of een BIT STRING (RFC 5652).
    let signatureBytes = null;
    for (let i = si.length - 1; i >= 0; i--) {
        const node = si[i];
        if (node.tagClass !== forge.asn1.Class.UNIVERSAL) continue;
        if (node.type === forge.asn1.Type.OCTETSTRING) {
            signatureBytes = node.value;
            break;
        }
        if (node.type === forge.asn1.Type.BITSTRING) {
            signatureBytes = node.value.length > 1 ? node.value.slice(1) : node.value;
            break;
        }
    }
    if (!signatureBytes) throw new Error('Geen signatuur gevonden in de SignerInfo');

    // signedAttrs is de [0] IMPLICIT SET OF Attribute: de attributes staan direct
    // in .value (of, bij een expliciete encode, in één SET-erf)
    let attrList = signedAttrs.value;
    if (attrList.length === 1
        && attrList[0].tagClass === forge.asn1.Class.UNIVERSAL
        && attrList[0].type === forge.asn1.Type.SET) {
        attrList = attrList[0].value;
    }
    let attrs = {};
    for (const attr of attrList) {
        const typeOid = forge.asn1.derToOid(attr.value[0].value);
        const valueNode = attr.value[1].value[0];
        if (typeOid === OID_MESSAGE_DIGEST) {
            attrs.messageDigest = valueNode.value;
        } else if (typeOid === OID_SIGNING_TIME) {
            attrs.signingTime = valueNode.value;
        }
    }

    // 1) Digest van het ByteRange-gehalte vergelijken met het messageDigest-attribuut
    const signedContent = Buffer.concat([
        buf.subarray(a, a + b),
        buf.subarray(c, c + d),
    ]);
    const md = forge.md.sha256.create();
    md.update(signedContent.toString('binary'));
    const digestKlopt = attrs.messageDigest ? md.digest().data === attrs.messageDigest : false;
    if (!digestKlopt) fouten.push('De digest van het document komt niet overeen met de handtekening (document is gewijzigd)');

    // 2) RSA-signatuur over de signedAttributes verifiëren met de open sleutel uit het certificaat.
    //    Het digest gaat over een expliciete SET van de attributes (niet de [0]-verpakking).
    let handtekeningGeldig = false;
    if (signedAttrs) {
        const attrsSet = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, signedAttrs.value);
        const signedAttrsDer = forge.asn1.toDer(attrsSet).getBytes();
        const attrMd = forge.md.sha256.create();
        attrMd.update(signedAttrsDer);
        handtekeningGeldig = cert.publicKey.verify(attrMd.digest().data, signatureBytes, 'RSASSA-PKCS1-V1_5');
    }
    if (!handtekeningGeldig) fouten.push('De RSA-signatuur kan niet geverifieerd worden met het certificaat');

    // 3) /M (ondertekeningsdatum), /Naam, /Plaats uit de /Sig-structuur (na /Contents)
    const sigDict = s.slice(contentEnd, Math.min(s.length, contentEnd + 2000));
    let ondertekendOp = null, plaats = null, reden = null;
    const mMatch = sigDict.match(/\/M\s*\((D:[^)]*)\)/);
    if (mMatch) {
        ondertekendOp = mMatch[1].replace(/^D:/, '').replace(/([+-]\d{2})'(\d{2})'$/, ' $1:$2');
    }
    const nameMatch = sigDict.match(/\/Name\s*\(([^)]*)\)/);
    const locMatch = sigDict.match(/\/Location\s*\(([^)]*)\)/);
    const reasonMatch = sigDict.match(/\/Reason\s*\(([^)]*)\)/);
    if (locMatch) plaats = locMatch[1];
    if (reasonMatch) reden = reasonMatch[1];

    const onderwerp = formatDn(cert.subject);
    const zelfOndertekend = onderwerp === formatDn(cert.issuer);

    return {
        geldig: digestKlopt && handtekeningGeldig && fouten.length === 0,
        ondertekenaar: nameMatch ? nameMatch[1] : onderwerp,
        ondertekendOp: ondertekendOp,
        plaats,
        reden,
        digestKlopt,
        handtekeningGeldig,
        certificaat: {
            onderwerp,
            uitgever: formatDn(cert.issuer),
            geldigVan: cert.validity.notBefore,
            geldigTot: cert.validity.notAfter,
            zelfOndertekend,
        },
        fouten,
    };
}
