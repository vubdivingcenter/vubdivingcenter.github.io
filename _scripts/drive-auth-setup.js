import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import readline from 'readline';

dotenv.config();

const clientId = process.env.OAUTH_CLIENT_ID;
const clientSecret = process.env.OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
    console.error('OAUTH_CLIENT_ID en OAUTH_CLIENT_SECRET moeten gezet worden in .env (Desktop OAuth client uit Google Cloud Console).');
    process.exit(1);
}

const client = new OAuth2Client(clientId, clientSecret, 'http://localhost');
const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('Stap 1: Open de onderstaande URL in je browser en log in met het Google-account dat eigenaar is van de Drive-map:\n');
console.log(authUrl);
console.log();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = await new Promise(resolve => rl.question('Stap 2: Plak hier de code die Google geeft en druk op enter: ', answer => {
    rl.close();
    resolve(answer.trim());
}));

const { tokens } = await client.getToken(code);
client.setCredentials(tokens);

if (!tokens.refresh_token) {
    console.error('Geen refresh token teruggekregen. Verwijder eerst eventuele eerdere toegang voor deze client (myaccount.google.com/connections) en probeer opnieuw.');
    process.exit(1);
}

// Valideer dat het token echt werkt
const headers = await client.getRequestHeaders();
const folderId = process.env.GOOGLE_DRIVE_VDC_FOLDER_ID;
if (folderId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`, { headers });
    if (res.ok) {
        console.log(`\nValidatie geslaagd: toegang tot map "${(await res.json()).name}".`);
    } else {
        console.warn(`\nLet op: map ${folderId} niet toegankelijk met dit account (${res.status}).`);
    }
}

console.log('\nStap 3: Zet onderstaande waarde als DRIVE_REFRESH_TOKEN in .env (en als secret in GitHub):');
console.log();
console.log(tokens.refresh_token);
