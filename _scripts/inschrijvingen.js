import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import ejs from 'ejs';
import puppeteer from 'puppeteer';

const DEBUG = false;
const DEBUG_EMAIL = '';

class MailgunError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MailgunError';
    }
}

dotenv.config();

const vdcDataPath = path.resolve(process.cwd(), '_data', 'vdc.json');
const vdcData = JSON.parse(fs.readFileSync(vdcDataPath, 'utf8'));
const lidkaartTemplatePath = path.resolve(process.cwd(), '_templates', 'ledenkaart.ejs');
const lidkaartTemplate = fs.readFileSync(lidkaartTemplatePath, 'utf8');
const outputDir = path.resolve(process.cwd(), '_output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

/**
 * Bereken het bedrag op basis van het type lidmaatschap
 * @param {*} type 
 * @param {*} vdc 
 * @returns 
 */
function getBedrag(type, vdc) {
    switch (type) {
        case 'Nieuw lid': return vdc.lidgeld.lid + vdc.lidgeld.opleiding;
        case 'Bestaand lid': return vdc.lidgeld.lid;
        case 'Steunend lid': return vdc.lidgeld.steunend;
        default: return 0;
    }
}

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
    if (DEBUG) {
        console.log(`DEBUG: Email to ${to} changed to ${DEBUG_EMAIL}`);
        to = DEBUG_EMAIL;
        if (DEBUG_EMAIL === '') {
            console.log('DEBUG_EMAIL is empty, skipping email send.');
            return;
        }
    }
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

    let response;
    try {
        response = await fetch(`https://api.eu.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64'),
                // Do not set Content-Type, let FormData handle it
                ...formData.getHeaders()
            },
            body: formData
        });
    } catch (err) {
        throw new MailgunError(`Network error contacting Mailgun for "${subject}" to ${to}: ${err.message}`);
    }

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
        throw new MailgunError(`Mailgun API request failed (${response.status}): ${errorText}`);
    } else {
        console.log(`Email sent to ${to} with subject "${subject}"`);
    }
}

/**
 * Verstuur een betalingsverzoek
 * @param {*} row 
 * @param {*} vdcData 
 */
async function sendBetalingsverzoek(row, vdcData) {
    const firstName = row.get('Voornaam');
    const lastName = row.get('Achternaam');
    const email = row.get('E-mail');
    const type = row.get('Optie');
    console.log(`Sending betalingsverzoek to ${firstName} ${lastName} <${email}>`);
    await sendEmail(
        email,
        `Welkom bij het VUB Diving Center (${vdcData.lidjaar.start}-${vdcData.lidjaar.einde})`,
        "email_betalingsverzoek",
        { firstName, lastName, vdc: vdcData, type: `${type} (${getBedrag(type, vdcData)} euro)` },
        []
    );
    row.set('Betalingsverzoek verzonden', 'ja');
    if (type === 'Steunend lid') row.set('Lidkaart verzonden', 'ja');
    if (!DEBUG)
        await row.save();
    console.log(`Betalingsverzoek sent to ${firstName} ${lastName}`);
}

/**
 * Genereer en verstuur de lidkaart
 * @param {*} row 
 * @param {*} vdcData 
 */
async function generateAndSendLidkaart(row, vdcData) {
    const firstName = row.get('Voornaam');
    const lastName = row.get('Achternaam');
    const email = row.get('E-mail');
    const type = row.get('Optie');
    const firstNameSanitized = firstName.replace(/[^a-zA-Z0-9]/g, '');
    const lastNameSanitized = lastName.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `VDC_${lastNameSanitized}${firstNameSanitized}_${vdcData.lidjaar.start}-${vdcData.lidjaar.einde}`;

    // Veiligheid, kijk nogmaals of type geen steunend lid is
    if (type === 'Steunend lid') {
        console.log(`Type is 'Steunend lid', geen lidkaart nodig voor ${firstName} ${lastName}, overslaan...`);
        return;
    }
    
    console.log(`Generating lidkaart voor ${firstName} ${lastName} <${email}>`);
    const html = ejs.render(lidkaartTemplate, {
        row,
        fileName,
        start: vdcData.lidjaar.start,
        einde: vdcData.lidjaar.einde,
        voornaam: firstName.toUpperCase(),
        achternaam: lastName.toUpperCase(),
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
    console.log(`Lidkaart voor ${firstName} ${lastName} opgeslagen als ${fileName}.html en ${fileName}.pdf`);
    // Bewaar PDF op Google Drive
    await saveLidkaartToDrive(pdfPath, vdcData);
    // Verstuur email met bijlage
    await sendEmail(
        email,
        `Uw VDC Lidkaart voor ${vdcData.lidjaar.start}-${vdcData.lidjaar.einde}`,
        "email_ledenkaart",
        { firstName, lastName, vdc: vdcData },
        [{ path: pdfPath, filename: `${fileName}.pdf`, type: 'application/pdf' }]
    );
    row.set('Lidkaart verzonden', 'ja');
    if (!DEBUG)
        await row.save();
}

function getDriveAuth() {
    return new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
}

async function driveRequest(auth, url, options = {}) {
    const headers = await auth.getRequestHeaders();
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            ...headers
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Drive API request failed (${response.status}): ${errorText}`);
    }
    return response;
}

async function findOrCreateDriveFolder(auth, name, parentFolderId) {
    const query = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`);
    const response = await driveRequest(auth, `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`);
    const { files } = await response.json();
    if (files && files.length > 0) {
        return files[0].id;
    }
    const createResponse = await driveRequest(auth, 'https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        })
    });
    const folder = await createResponse.json();
    console.log(`Google Drive folder "${name}" aangemaakt (id: ${folder.id})`);
    return folder.id;
}

async function deleteExistingDriveFile(auth, name, folderId) {
    const query = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
    const response = await driveRequest(auth, `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`);
    const { files } = await response.json();
    for (const file of files || []) {
        await driveRequest(auth, `https://www.googleapis.com/drive/v3/files/${file.id}`, { method: 'DELETE' });
        console.log(`Bestaand bestand "${file.name}" (id: ${file.id}) verwijderd voor overschrijven`);
    }
}

async function saveLidkaartToDrive(pdfPath, vdcData) {
    const baseFolderId = process.env.GOOGLE_DRIVE_VDC_FOLDER_ID;
    if (!baseFolderId) {
        console.warn('No Google Drive folder ID provided, skipping Google Drive upload.');
        return;
    }
    const auth = getDriveAuth();
    const fileName = path.basename(pdfPath);
    const yearFolder = `${vdcData.lidjaar.start}-${vdcData.lidjaar.einde}`;

    try {
        const yearFolderId = await findOrCreateDriveFolder(auth, yearFolder, baseFolderId);
        await deleteExistingDriveFile(auth, fileName, yearFolderId);
        const fileContents = fs.readFileSync(pdfPath);
        const boundary = `----vdbcboundary${Date.now()}`;
        const metadata = JSON.stringify({ name: fileName, parents: [yearFolderId] });
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
            fileContents,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);
        await driveRequest(auth, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body
        });
        console.log(`Lidkaart uploaded to Google Drive: ${yearFolder}/${fileName}`);
    } catch (err) {
        console.error('Error uploading to Google Drive:', err);
    }
}

async function processInschrijvingen() {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    let rows = await sheet.getRows();
    // Validate the secret code if 'paid' is set to true
    for (const row of rows) {
        const securityCode = row.get('CODE');
        const betaald = row.get('Betaald');
        if (securityCode !== process.env.REGISTRATION_CODE && betaald === 'ja') {
            console.warn(`Invalid security code for ${row.get('Voornaam')} ${row.get('Achternaam')}, skipping...`);
            row.set('Betaald', 'ONGELDIG');
            if (!DEBUG)
                await row.save();
        } else {
            console.log(`Valid security code for ${row.get('Voornaam')} ${row.get('Achternaam')}`);
            row.set('CODE', process.env.REGISTRATION_CODE);
            if (!DEBUG)
                await row.save();
        }
    }

    rows = rows.filter(row => row.get('Lidkaart verzonden') !== 'ja');
    const mailErrors = [];
    for (const row of rows) {
        try {
            if (row.get('Betalingsverzoek verzonden') !== 'ja') {
                await sendBetalingsverzoek(row, vdcData);
            } else if (row.get('Betaald') === 'ja') {
                await generateAndSendLidkaart(row, vdcData);
            }
        } catch (err) {
            const firstName = row.get('Voornaam');
            const lastName = row.get('Achternaam');
            const email = row.get('E-mail');
            if (err instanceof MailgunError) {
                mailErrors.push(`${firstName} ${lastName} <${email}>: ${err.message}`);
            }
            console.error(`Error processing ${firstName} ${lastName}:`, err);
        }
    }

    if (mailErrors.length > 0) {
        throw new Error(`Failing workflow: ${mailErrors.length} e-mail(s) konden niet worden verzonden via Mailgun.\n${mailErrors.map(error => ` - ${error}`).join('\n')}`);
    }
}

processInschrijvingen()
    .then(() => {
        console.log('Alle inschrijvingen verwerkt.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
