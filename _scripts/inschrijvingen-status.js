import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import ejs from 'ejs';

dotenv.config();

/**
 * Verzend een e-mail met Mailgun via HTTP API
 * @param {*} to 
 * @param {*} subject 
 * @param {*} template 
 * @param {*} templateData 
 * @param {*} attachments 
 * @returns 
 */
async function sendEmail(to, subject, template, templateData, attachments = []) {
    const templatePath = path.resolve(process.cwd(), '_emails', `${template}.ejs`);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const body = ejs.render(templateContent, templateData);

    // Prepare form data using FormData (like curl -F)
    const formData = new FormData();
    formData.append('from', process.env.MAILGUN_FROM_EMAIL);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', body);

    // Add attachments if provided
    for (const attachment of attachments) {
        // attachment: { filename, path }
        formData.append('attachment', fs.createReadStream(attachment.path), { filename: attachment.filename });
    }

    const response = await fetch(`https://api.eu.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64'),
            // Do not set Content-Type, let FormData handle it
            ...formData.getHeaders()
        },
        body: formData
    });

    if (!response.ok) {
        // Get error text from response
        const errorText = await response.text();
        // Log the request
        console.error('Mailgun API request failed:', {
            errorText,
            status: response.status,
            statusText: response.statusText,
            to,
            from: process.env.MAILGUN_FROM_EMAIL,
            subject,
            attachments: attachments.map(a => a.filename)
        });
        throw new Error(errorText);
    } else {
        console.log(`Email sent to ${to} with subject "${subject}"`);
    }
}

const startWeek = (() => {
    const now = new Date();
    const day = now.getDay();
    // getDay(): 0 (Sunday) - 6 (Saturday)
    // Monday is 1, so calculate difference
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + diff);
    return monday;
})();
const endWeek = new Date(startWeek);
endWeek.setDate(startWeek.getDate() + 7); // Set to Monday of the following week (exclusive end)
const endWeekDisplay = new Date(startWeek);
endWeekDisplay.setDate(startWeek.getDate() + 6); // Sunday, for display only

// Parseert de Timestamp kolom: kan een Date object, epoch of een Belgische
// datumstring (d/M/yyyy [H:mm[:ss]]) zijn. new Date("4/5/2026") zou 4/5
// (maart-stijl MM/DD) interpreteren, dus die interpreteren we zelf.
function parseInschrijfDatum(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) return isNaN(value) ? null : value;
    if (typeof value === 'number') return new Date(value);
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const iso = new Date(s);
        return isNaN(iso) ? null : iso;
    }
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const [, d, mo, y, h, mi, sec] = m;
        const year = y.length === 2 ? 2000 + Number(y) : Number(y);
        return new Date(year, mo - 1, d, Number(h || 0), Number(mi || 0), Number(sec || 0));
    }
    const fallback = new Date(s);
    return isNaN(fallback) ? null : fallback;
}

// Loop through all inschrijvingen
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
await doc.loadInfo();
const sheet = doc.sheetsByIndex[0];
let rows = await sheet.getRows();
let totaalAantal = rows.length;
rows = rows.filter(row => {
    const inschrijfDatum = parseInschrijfDatum(row.get('Timestamp'));
    return inschrijfDatum !== null && inschrijfDatum >= startWeek && inschrijfDatum < endWeek;
});

let aantalBetaald = 0;
let newMembers = [];
for (const row of rows) {
    const firstName = row.get('Voornaam');
    const lastName = row.get('Achternaam');
    const email = row.get('E-mail');
    const type = row.get('Optie');
    const inschrijfDatum = parseInschrijfDatum(row.get('Timestamp'));
    const betaald = row.get('Betaald');
    if (betaald && betaald.toLowerCase() === 'ja') {
        aantalBetaald++;
    }
    newMembers.push({
        firstName,
        lastName,
        email,
        type,
        inschrijfDatum: inschrijfDatum.toLocaleDateString('nl-BE', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
}

console.log(`Totaal aantal inschrijvingen: ${totaalAantal}, nieuwe inschrijvingen deze week: ${newMembers.length}`);

if (newMembers.length > 0) {
    try {
        await sendEmail(
            "vdc_rvb@googlegroups.com",
            `Wekelijks overzicht inschrijvingen (${startWeek.toLocaleDateString('nl-BE')} - ${endWeekDisplay.toLocaleDateString('nl-BE')})`,
            "email_status",
            { start: startWeek.toLocaleDateString('nl-BE'), end: endWeekDisplay.toLocaleDateString('nl-BE'), inschrijvingen: newMembers, count: {
                betaald: aantalBetaald,
                totaal: totaalAantal
            } },
            []
        );
    } catch (err) {
        console.error('Failed to send status email:', err);
        process.exit(1);
    }
} else {
    console.log('Geen nieuwe inschrijvingen deze week, er wordt geen e-mail verstuurd.');
}
