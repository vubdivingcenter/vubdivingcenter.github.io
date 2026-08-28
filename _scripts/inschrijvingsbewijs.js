import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { signPdf } from './pdf-sign.js';

dotenv.config();

const templatePath = path.resolve(process.cwd(), '_templates', 'inschrijvingsbewijs.ejs');
const template = fs.readFileSync(templatePath, 'utf8');
const outputDir = path.resolve(process.cwd(), '_output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

/**
 * Haal de base64-logo op uit de ledenkaart-template
 * @returns 
 */
function getLogo() {
    const ledenkaartTemplatePath = path.resolve(process.cwd(), '_templates', 'ledenkaart.ejs');
    const ledenkaartTemplate = fs.readFileSync(ledenkaartTemplatePath, 'utf8');
    const match = ledenkaartTemplate.match(/data:image\/gif;base64,\s*([A-Za-z0-9+/=]+)"?/);
    if (!match) {
        throw new Error('Logo niet gevonden in ledenkaart.ejs');
    }
    return match[1];
}

/**
 * Parseer de command line argumenten
 * @param {*} argv 
 * @returns 
 */
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        const key = arg.substring(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
            args[key] = true;
        } else {
            args[key] = next;
            i++;
        }
    }
    return args;
}

/**
 * Parseert een datum (dd/MM/yyyy of yyyy-MM-dd)
 * @param {*} date 
 * @returns 
 */
function parseDatum(date) {
    let parsed = DateTime.fromISO(date, { zone: 'utc' });
    if (!parsed.isValid) parsed = DateTime.fromFormat(date, 'dd/MM/yyyy', { zone: 'utc' });
    if (!parsed.isValid) return null;
    return parsed.toFormat('dd/MM/yyyy');
}

function usage() {
    console.log(`Gebruik:
node _scripts/inschrijvingsbewijs.js --date <datum> --price <prijs> --event <naam> --paid-date <betalingsdatum> [--name <naam>] [--date-text <datumtekst>] [--event-place <plaats>] [--place <plaats>]

Opties:
  --date         Datum van het evenement (bijv. 2026-08-21 of 21/08/2026)
  --date-text    (optioneel) Vrije datumweergave, override voor --date (bijv. 4-6 september 2026)
  --price        Prijs van het evenement in euro (bijv. 45)
  --event        Naam van het evenement (bijv. Cluiplein 2026)
  --event-place  (optioneel) Plaats van het evenement (bijv. Renesse, Nederland)
  --place        (optioneel) Plaats voor de ondertekening, standaard Oudergem, Brussel
  --paid-date    Datum van betaling (bijv. 2026-08-21 of 21/08/2026)
  --name         (optioneel) Naam van de ingeschreven lid
  --cert         (optioneel) Pad naar het PEM-signeer-certificaat,
                   anders de omgevingvariabele VDC_SIGNING_CERT,
                   anders _scripts/certs/vdc-signing.crt
  --key          (optioneel) Pad naar de PEM-private key,
                   anders de omgevingvariabele VDC_SIGNING_KEY,
                   anders _scripts/certs/vdc-signing.key
  --sign         (optioneel) PDF digitaal ondertekenen met een PAdES-handtekening

De PDF wordt standaard niet ondertekend en wordt opgeslagen als
VDC_Inschrijvingsbewijs_<datum van vandaag>_<naam>.pdf in _output.
`);
}

async function generateInschrijvingsbewijs(args) {
    const { date, price, event, place, name } = args;
    const paidDate = args['paid-date'];
    const dateText = args['date-text'];
    const eventPlace = args['event-place'];
    if ((!date && !dateText) || !price || !event || !paidDate) {
        usage();
        process.exit(1);
    }

    let datum = dateText;
    if (!datum) {
        datum = parseDatum(date);
        if (!datum) {
            console.error(`Ongeldige datum: ${date}`);
            process.exit(1);
        }
    }
    const betalingsdatum = parseDatum(paidDate);
    if (!betalingsdatum) {
        console.error(`Ongeldige betalingsdatum: ${paidDate}`);
        process.exit(1);
    }

    // Valideer de prijs (Dutch/Belgian decimal comma supported)
    const prijs = Number.parseFloat(price.replace(',', '.'));
    if (!Number.isFinite(prijs) || prijs < 0) {
        console.error(`Ongeldige prijs: ${price}`);
        process.exit(1);
    }

    const vandaag = DateTime.now().toFormat('yyyy-MM-dd');
    const naamBestandsnaam = (name || 'naamloos').replace(/[^a-zA-Z0-9]+/g, '_');
    const fileName = `VDC_Inschrijvingsbewijs_${vandaag}_${naamBestandsnaam}`;

    const prijsFormatted = prijs.toLocaleString('nl-BE');
    console.log(`Genereren inschrijvingsbewijs voor "${event}" op ${datum} (${prijsFormatted} EUR)...`);
    const tekeningsdatum = DateTime.now().toFormat('dd/MM/yyyy');
    const html = ejs.render(template, {
        fileName,
        logo: getLogo(),
        naam: name,
        evenement: event,
        datum,
        plaatsEvenement: eventPlace,
        prijsFormatted,
        betalingsdatum,
        plaats: place || 'Oudergem, Brussel',
        tekeningsdatum,
    });
    const outputPath = path.join(outputDir, `${fileName}.html`);
    fs.writeFileSync(outputPath, html, 'utf8');

    const pdfPath = path.join(outputDir, `${fileName}.pdf`);
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await browser.close();

    if (args.sign) {
        const certPath = path.resolve(process.cwd(),
            args.cert || process.env.VDC_SIGNING_CERT || '_scripts/certs/vdc-signing.crt');
        const keyPath = path.resolve(process.cwd(),
            args.key || process.env.VDC_SIGNING_KEY || '_scripts/certs/vdc-signing.key');
        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
            throw new Error(
                `Signeer-certificaat of key niet gevonden (${certPath}, ${keyPath}). ` +
                'Zie de README voor de opstelling van het signeer-certificaat.'
            );
        }
        const ongetekend = fs.readFileSync(pdfPath);
        const ondertekend = await signPdf(ongetekend, {
            certPem: fs.readFileSync(certPath, 'utf8'),
            keyPem: fs.readFileSync(keyPath, 'utf8'),
            location: place || 'Oudergem, Brussel',
            reason: `Inschrijvingsbewijs ${event}`,
        });
        fs.writeFileSync(pdfPath, ondertekend);
        console.log('PDF digitaal ondertekend (PAdES, adbe.pkcs7.detached).');
    }

    console.log(`Inschrijvingsbewijs opgeslagen als ${fileName}.html en ${fileName}.pdf`);
}

const args = parseArgs(process.argv.slice(2));
generateInschrijvingsbewijs(args)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
