import fs from 'fs';
import path from 'path';
import { verifyPdfSignature } from './pdf-verify.js';

function usage() {
    console.log(`Gebruik:
node _scripts/verifieer-inschrijvingsbewijs.js <pdf-bestand>

Verifieert de digitale PAdES-handtekening van een PDF.
Exit code 0 = handtekening geldig, 1 = ongeldig of fout.
`);
}

const pdfPath = process.argv[2];
if (!pdfPath) {
    usage();
    process.exit(1);
}

const resolved = path.resolve(process.cwd(), pdfPath);
if (!fs.existsSync(resolved)) {
    console.error(`Bestand niet gevonden: ${resolved}`);
    process.exit(1);
}

try {
    const bytes = fs.readFileSync(resolved);
    const resultaat = verifyPdfSignature(bytes);

    console.log(`Bestand:      ${path.basename(resolved)}`);
    console.log(`Ondertekenaar: ${resultaat.ondertekenaar}`);
    if (resultaat.ondertekendOp) console.log(`Ondertekend:   ${resultaat.ondertekendOp}`);
    if (resultaat.plaats) console.log(`Plaats:        ${resultaat.plaats}`);
    if (resultaat.reden) console.log(`Reden:         ${resultaat.reden}`);
    console.log(`Certificaat:   ${resultaat.certificaat.onderwerp}`);
    console.log(`  geldig van:  ${resultaat.certificaat.geldigVan.toISOString()}`);
    console.log(`  geldig tot:  ${resultaat.certificaat.geldigTot.toISOString()}`);
    if (resultaat.certificaat.zelfOndertekend) {
        console.log(`  opmerking:   zelf-ondertekend certificaat; verifieer het certificaat afzonderlijk (bv. via de vingerafdruk)`);
    }
    console.log(`Digest:        ${resultaat.digestKlopt ? 'klopt' : 'KLOPT NIET'}`);
    console.log(`Signatuur:     ${resultaat.handtekeningGeldig ? 'geldig' : 'ONGELDIG'}`);

    if (resultaat.fouten.length > 0) {
        console.log('\nProblemen:');
        for (const fout of resultaat.fouten) console.log(`  - ${fout}`);
    }

    console.log(`\nConclusie:     ${resultaat.geldig ? 'HANDTEKENING GELDIG' : 'HANDTEKENING ONGELDIG'}`);
    process.exit(resultaat.geldig ? 0 : 1);
} catch (err) {
    console.error(`Fout bij verificatie: ${err.message}`);
    process.exit(1);
}
