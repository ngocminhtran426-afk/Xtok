import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CREDENTIALS_PATH = resolve(__dirname, '../credentials.json');
const TOKEN_PATH = resolve(__dirname, '../token.json');

async function createSheet() {
  try {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    const { client_id, client_secret } = credentials.installed;

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3333');
    oauth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    console.log('Creating new Google Sheet "VideoPlatformDB"...');
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'VideoPlatformDB'
        }
      }
    });

    const spreadsheetId = response.data.spreadsheetId;
    const spreadsheetUrl = response.data.spreadsheetUrl;
    
    console.log('✅ Spreadsheet created successfully!');
    console.log(`ID: ${spreadsheetId}`);
    console.log(`URL: ${spreadsheetUrl}`);

    // Update .env file automatically
    const envPath = resolve(__dirname, '../../.env');
    let envContent = '';
    try {
      envContent = readFileSync(envPath, 'utf-8');
    } catch (e) {
      // .env doesn't exist, read from .env.example
      envContent = readFileSync(resolve(__dirname, '../../.env.example'), 'utf-8');
    }

    envContent = envContent.replace(
      /GOOGLE_SHEETS_SPREADSHEET_ID=.*/,
      `GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}`
    );

    writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with the new Spreadsheet ID.');

  } catch (error) {
    console.error('Error creating spreadsheet:', error);
  }
}

createSheet();
