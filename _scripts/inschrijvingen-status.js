import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import sgMail from '@sendgrid/mail';
import ejs from 'ejs';

dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


/**
 * Verzend een e-mail met SendGrid
 * @param {*} to 
 * @param {*} subject 
 * @param {*} template 
 * @param {*} templateData 
 * @param {*} attachments 
 * @returns 
 */
function sendEmail(to, subject, template, templateData, attachments = []) {
    return new Promise((resolve, reject) => {
        const templatePath = path.resolve(process.cwd(), '_emails', `${template}.ejs`);
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const body = ejs.render(templateContent, templateData);
        const msg = {
            to,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject,
            html: body,
            attachments: attachments.map(a => ({
                content: fs.readFileSync(a.path).toString('base64'),
                filename: a.filename,
                type: a.type || 'application/pdf',
                disposition: 'attachment'
            }))
        };
        sgMail.send(msg)
            .then(() => {
                console.log(`Email sent to ${to} with subject "${subject}" and attachments: ${attachments.map(a => a.filename).join(', ')}`);
                resolve();
            })
            .catch(error => {
                console.error(`Failed to send email to ${to}:`, error);
                reject(error);
            });
    });
}

const vdcDataPath = path.resolve(process.cwd(), '_data', 'vdc.json');
const vdcData = JSON.parse(fs.readFileSync(vdcDataPath, 'utf8'));

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
endWeek.setDate(startWeek.getDate() + 7);

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
rows = rows.filter(row => {
    const inschrijfDatum = new Date(row.get('Timestamp'));
    return inschrijfDatum >= startWeek && inschrijfDatum < endWeek;
});

let newMembers = [];
for (const row of rows) {
    const firstName = row.get('Voornaam');
    const lastName = row.get('Achternaam');
    const email = row.get('E-mail');
    const type = row.get('Optie');
    const inschrijfDatum = new Date(row.get('Timestamp'));
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
        "info@vubdivingcenter.be",
        `Wekelijks overzicht inschrijvingen (${startWeek.toLocaleDateString('nl-BE')} - ${endWeek.toLocaleDateString('nl-BE')})`,
        "email_status",
        { start: startWeek.toLocaleDateString('nl-BE'), end: endWeek.toLocaleDateString('nl-BE'), inschrijvingen : newMembers },
        []
    ).catch(err => {
        console.error('Failed to send status email:', err);
    });
}