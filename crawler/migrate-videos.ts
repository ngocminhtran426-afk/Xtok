import 'dotenv/config';
import { loadConfig } from './src/config/index.js';
import { GoogleSheetsAdapter } from './src/adapters/google-sheets/adapter.js';
import mongoose from 'mongoose';
import { Video } from './src/db.js';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect('mongodb+srv://ngocminhtran426_db_user:cTezqk6ZENFJJu39@cluster0.dkjy0jm.mongodb.net/?appName=Cluster0');
  console.log('Connected to MongoDB.');

  const config = loadConfig();
  const db = new GoogleSheetsAdapter(config.sheets.spreadsheetId);
  await db.connect();
  console.log('Connected to Google Sheets.');

  const { items } = await db.findVideos({ limit: 100 });
  
  // Transform and insert
  const videos = items.map(v => ({
    id: parseInt(v.id) || Math.floor(Math.random() * 1000000),
    thumb_url: v.thumbnailUrl,
    file_url: v.videoUrl,
    description: v.description || v.title,
    music: 'Original sound - VideoPlatform',
    likes_count: v.likes || Math.floor(Math.random() * 10000),
    comments_count: Math.floor(Math.random() * 1000),
    shares_count: Math.floor(Math.random() * 500)
  }));

  console.log(`Found ${videos.length} videos. Inserting...`);
  
  for (const v of videos) {
    try {
      await Video.findOneAndUpdate({ id: v.id }, v, { upsert: true });
    } catch (e) {
      console.error('Error inserting video', v.id, e);
    }
  }

  console.log('Done migrating videos to MongoDB!');
  process.exit(0);
}

main().catch(console.error);
