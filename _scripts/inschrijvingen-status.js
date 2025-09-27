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
endWeek.setDate(startWeek.getDate() + 6); // Set to Sunday (end of week)

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
    const inschrijfDatum = new Date(row.get('Timestamp'));
    return inschrijfDatum >= startWeek && inschrijfDatum < endWeek;
});

let aantalBetaald = 0;
let newMembers = [];
for (const row of rows) {
    const firstName = row.get('Voornaam');
    const lastName = row.get('Achternaam');
    const email = row.get('E-mail');
    const type = row.get('Optie');
    const inschrijfDatum = new Date(row.get('Timestamp'));
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

if (newMembers.length > 0) {
    sendEmail(
        "vdc_rvb@googlegroups.com",
        `Wekelijks overzicht inschrijvingen (${startWeek.toLocaleDateString('nl-BE')} - ${endWeek.toLocaleDateString('nl-BE')})`,
        "email_status",
        { start: startWeek.toLocaleDateString('nl-BE'), end: endWeek.toLocaleDateString('nl-BE'), inschrijvingen : newMembers, count: {
            betaald: aantalBetaald,
            totaal: totaalAantal
        } },
        []
    ).catch(err => {
        console.error('Failed to send status email:', err);
    });
}
