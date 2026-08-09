// ===== OAuth2 Authorization Script =====
// Run this ONCE to authorize and get a refresh token.
// After running, a token.json file will be saved.
// 
// Usage: npx tsx src/auth.ts

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';

const CREDENTIALS_PATH = resolve(__dirname, '../credentials.json');
const TOKEN_PATH = resolve(__dirname, '../token.json');
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];
const PORT = 3333;

async function authorize() {
  // Check if already authorized
  if (existsSync(TOKEN_PATH)) {
    console.log('✅ token.json already exists. Delete it to re-authorize.');
    return;
  }

  // Load credentials
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    `http://localhost:${PORT}`,
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh_token
  });

  console.log('');
  console.log('===================================');
  console.log('  Google Sheets Authorization');
  console.log('===================================');
  console.log('');
  console.log('Opening browser for authorization...');
  console.log('');
  console.log('If browser does not open, visit this URL:');
  console.log('');
  console.log(authUrl);
  console.log('');

  // Open browser
  const { exec } = await import('child_process');
  exec(`start "" "${authUrl}"`);

  // Start local server to receive the callback
  return new Promise<void>((resolvePromise, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://localhost:${PORT}`);
        const code = url.searchParams.get('code');

        if (!code) {
          res.writeHead(400);
          res.end('Missing authorization code');
          return;
        }

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        // Save tokens
        writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        console.log('');
        console.log('✅ Authorization successful!');
        console.log(`✅ Token saved to: ${TOKEN_PATH}`);
        console.log('');
        console.log('You can now run the crawler.');
        console.log('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #eee;">
            <h1>✅ Authorized!</h1>
            <p>Token saved. You can close this tab and return to the terminal.</p>
          </body>
          </html>
        `);

        server.close();
        resolvePromise();
      } catch (error) {
        console.error('Authorization error:', error);
        res.writeHead(500);
        res.end('Authorization failed');
        server.close();
        reject(error);
      }
    });

    server.listen(PORT, () => {
      console.log(`Waiting for authorization callback on port ${PORT}...`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout (5 minutes)'));
    }, 5 * 60 * 1000);
  });
}

authorize().catch(error => {
  console.error('Failed:', error.message);
  process.exit(1);
});
