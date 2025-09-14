import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import sgMail from '@sendgrid/mail';
dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function getBedrag(type, vdc) {
    switch (type) {
        case 'Nieuw lid':
            return vdc.lidgeld.lid + vdc.lidgeld.opleiding;
        case 'Bestaand lid':
            return vdc.lidgeld.lid;
        case 'Steunend lid':
            return vdc.lidgeld.steunend;
    }
}

/**
 * Send an email using SendGrid
 * @param {*} to 
 * @param {*} subject 
 * @param {*} template 
 * @param {*} templateData 
 * @param {*} attachments 
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

// Load vdc data from /_data/vdc.json
const vdcDataPath = path.resolve(process.cwd(), '_data', 'vdc.json');
const vdcData = JSON.parse(fs.readFileSync(vdcDataPath, 'utf8'));

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);

await doc.loadInfo();
const sheet = doc.sheetsByIndex[0];

// Get all rows
let rows = await sheet.getRows();
// Filter rows where 'Lidkaart verzonden' is not 'ja'
rows = rows.filter(row => row.get('Lidkaart verzonden') !== 'ja');

const lidkaartTemplatePath = path.resolve(process.cwd(), '_templates', 'ledenkaart.ejs');
const lidkaartTemplate = fs.readFileSync(lidkaartTemplatePath, 'utf8');
const outputDir = path.resolve(process.cwd(), '_output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Generate HTML files
for (const row of rows) {
    const firstName = row.get('Voornaam');
    const lastName = row.get('Achternaam');
    const email = row.get('E-mail');
    const firstNameSanitized = firstName.replace(/[^a-zA-Z0-9]/g, '');
    const lastNameSanitized = lastName.replace(/[^a-zA-Z0-9]/g, '');
    const type = row.get('Optie');

    // If Betalingsverzoek verzonden is not 'ja'
    if (row.get('Betalingsverzoek verzonden') !== 'ja') {
        console.log(`Sending betalingsverzoek to ${firstName} ${lastName} <${email}>`);

        // Send email with instructions
        sendEmail(
            email,
            `Welkom bij het VUB Diving Center (${vdcData.lidjaar.start}-${vdcData.lidjaar.einde})`,
            "email_betalingsverzoek",
            { firstName, lastName, vdc: vdcData, type: `${type} (${getBedrag(type, vdcData)} euro)` },
            []
        ).then(async () => {
            // Mark row as 'Betalingsverzoek verzonden' = 'ja'
            row.set('Betalingsverzoek verzonden', 'ja');
            // Bij steunend lid, markeer ook lidkaart verzonden
            if (type === 'Steunend lid') {
                row.set('Lidkaart verzonden', 'ja');
            }
            await row.save();
            console.log(`Betalingsverzoek sent to ${firstName} ${lastName}`);
        }).catch(err => {
            console.error(`Failed to send betalingsverzoek to ${firstName} ${lastName}:`, err);
        });
    } else {
        // If betaald is ja
        if (row.get('Betaald') === 'ja') {
            const fileName = `VDC_${lastNameSanitized}${firstNameSanitized}_${vdcData.lidjaar.start}-${vdcData.lidjaar.einde}`;
            console.log(`Generating lidkaart voor ${firstName} ${lastName} <${email}>`);

            // Render HTML from EJS template
            const html = ejs.render(lidkaartTemplate, {
                row,
                fileName,
                start: vdcData.lidjaar.start,
                einde: vdcData.lidjaar.einde,
                voornaam: firstName.toUpperCase(),
                achternaam: lastName.toUpperCase(),
            });

            // Save HTML to file
            const outputPath = path.join(outputDir, `${fileName}.html`);
            fs.writeFileSync(outputPath, html, 'utf8');

            // Save HTML to PDF (A4)
            const pdfPath = path.join(outputDir, `${fileName}.pdf`);
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true
            });
            await browser.close();

            // Send email with PDF attachment
            sendEmail(
                email,
                `Uw VDC Lidkaart voor ${vdcData.lidjaar.start}-${vdcData.lidjaar.einde}`,
                "email_ledenkaart",
                { firstName, lastName, vdc: vdcData },
                [{
                    path: pdfPath,
                    filename: `${fileName}.pdf`,
                    type: 'application/pdf'
                }]
            ).then(async () => {
                // Mark row as 'Lidkaart verzonden' = 'ja'
                row.set('Lidkaart verzonden', 'ja');
                await row.save();
                console.log(`Lidkaart voor ${firstName} ${lastName} opgeslagen als ${fileName}.html en ${fileName}.pdf`);
            }).catch(err => {
                console.error(`Failed to send ledenkaart to ${firstName} ${lastName}:`, err);
            });
        }
    }
}