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

// Het rapport betreft de week die net is afgerond (maandag t/m zondag).
// De job draait op zondagavond (UTC), wat lokaal al maandag kan zijn,
// dus ankeren we op de meest recente zondag: vandaag als het zondag is,
// anders de zondag van de voorafgaande week.
const now = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
})();
const endWeekDisplay = new Date(now);
if (now.getDay() !== 0) {
    endWeekDisplay.setDate(now.getDate() - now.getDay()); // meest recente zondag
}
const startWeek = new Date(endWeekDisplay);
startWeek.setDate(endWeekDisplay.getDate() - 6); // maandag
const endWeek = new Date(endWeekDisplay);
endWeek.setDate(endWeekDisplay.getDate() + 1); // maandag erop, exclusief einde

// Parseert de Timestamp kolom: kan een Date object, een Google/Excel
// serial (aantal dagen sinds 30/12/1899) of een datumstring zijn.
// Google Sheets levert de formattedValue op in de locale van het
// spreadsheet, hier M/D/YYYY [H:mm[:ss]] (bv "1/9/2026 16:13:50" = 9
// januari 2026), dus de maand komt EERST.
function parseInschrijfDatum(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) return isNaN(value) ? null : value;
    if (typeof value === 'number') return new Date((value - 25569) * 86400000);
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const iso = new Date(s);
        return isNaN(iso) ? null : iso;
    }
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const [, mo, d, y, h, mi, sec] = m;
        const year = y.length === 2 ? 2000 + Number(y) : Number(y);
        const date = new Date(year, mo - 1, d, Number(h || 0), Number(mi || 0), Number(sec || 0));
        return isNaN(date) ? null : date;
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

console.log(`Totaal aantal inschrijvingen: ${totaalAantal}, nieuwe inschrijvingen vorige week: ${newMembers.length}`);

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
        console.log('Geen nieuwe inschrijvingen vorige week, er wordt geen e-mail verstuurd.');
}
