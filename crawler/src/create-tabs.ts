import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: resolve(__dirname, '../.env') });

const CREDENTIALS_PATH = resolve(__dirname, '../credentials.json');
const TOKEN_PATH = resolve(__dirname, '../token.json');

async function createTabs() {
  try {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    const { client_id, client_secret } = credentials.installed;

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3333');
    oauth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!spreadsheetId || spreadsheetId === 'your_spreadsheet_id_here') {
      throw new Error('Please set GOOGLE_SHEETS_SPREADSHEET_ID in .env');
    }

    const tabsToCreate = ['videos', 'pages', 'crawl_jobs', 'settings', 'stats'];
    
    console.log('Fetching existing sheets...');
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTabs = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

    const requests = [];
    for (const tab of tabsToCreate) {
      if (!existingTabs.includes(tab)) {
        requests.push({
          addSheet: {
            properties: { title: tab }
          }
        });
      }
    }

    if (requests.length > 0) {
      console.log('Creating tabs...');
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
      console.log(`✅ Created tabs: ${requests.map(r => r.addSheet.properties.title).join(', ')}`);
    } else {
      console.log('✅ All tabs already exist.');
    }

    // Try to delete default tab if it exists
    const defaultTab = existingTabs.find(t => t?.startsWith('Sheet') || t?.startsWith('Trang tính'));
    if (defaultTab) {
      const sheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === defaultTab)?.properties?.sheetId;
      if (sheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ deleteSheet: { sheetId } }]
          }
        });
        console.log(`✅ Deleted default tab: ${defaultTab}`);
      }
    }
  } catch (error) {
    console.error('Error creating tabs:', error);
  }
}

createTabs();
