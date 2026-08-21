import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import ejs from 'ejs';
import puppeteer from 'puppeteer';

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
node _scripts/inschrijvingsbewijs.js --date <datum> --price <prijs> --event <naam> --place <plaats> --paid-date <betalingsdatum> [--name <naam>]

Opties:
  --date       Datum van het evenement (bijv. 2026-08-21 of 21/08/2026)
  --price      Prijs van het evenement in euro (bijv. 45)
  --event      Naam van het evenement (bijv. Cluiplein 2026)
  --place      Plaats voor de handtekening van de secretaris (bijv. Brussel)
  --paid-date  Datum van betaling (bijv. 2026-08-21 of 21/08/2026)
  --name       (optioneel) Naam van de ingeschreven lid
`);
}

async function generateInschrijvingsbewijs(args) {
    const { date, price, event, place, name } = args;
    const paidDate = args['paid-date'];
    if (!date || !price || !event || !place || !paidDate) {
        usage();
        process.exit(1);
    }

    const datum = parseDatum(date);
    if (!datum) {
        console.error(`Ongeldige datum: ${date}`);
        process.exit(1);
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

    const sanitizedEvent = event.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `VDC_Inschrijvingsbewijs_${sanitizedEvent}_${datum.replaceAll('/', '-')}`;

    const prijsFormatted = prijs.toLocaleString('nl-BE');
    console.log(`Genereren inschrijvingsbewijs voor "${event}" op ${datum} (${prijsFormatted} EUR)...`);
    const html = ejs.render(template, {
        fileName,
        logo: getLogo(),
        naam: name,
        evenement: event,
        datum,
        prijsFormatted,
        betalingsdatum,
        plaats: place,
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
    console.log(`Inschrijvingsbewijs opgeslagen als ${fileName}.html en ${fileName}.pdf`);
}

const args = parseArgs(process.argv.slice(2));
generateInschrijvingsbewijs(args)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
