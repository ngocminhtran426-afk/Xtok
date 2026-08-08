import { loadConfig } from './config';
import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter';

async function seed() {
  const config = loadConfig();
  const db = new GoogleSheetsAdapter(config.sheets.spreadsheetId);
  await db.connect();
  
  console.log('Adding valid seed page...');
  await db.createPage({
    url: 'https://example.com/',
    priority: 'high'
  });
  console.log('✅ Seed page added!');

  await db.disconnect();
}

seed().catch(console.error);
