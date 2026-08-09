import fs from 'fs';
import { loadConfig } from './config/index.js';
import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter.js';

async function main() {
  const config = loadConfig();
  const db = new GoogleSheetsAdapter(config.sheets.spreadsheetId);
  await db.connect();
  const { items } = await db.findVideos({ limit: 100 });
  fs.writeFileSync('src/videos.json', JSON.stringify(items, null, 2));
  console.log(`Saved ${items.length} videos to src/videos.json`);
}

main().catch(console.error);
