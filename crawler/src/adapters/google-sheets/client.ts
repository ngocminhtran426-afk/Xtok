// ===== Google Sheets API Client =====
// Handles OAuth2 authentication and low-level spreadsheet operations.
// Uses credentials.json + token.json (from auth.ts script).

import { google, sheets_v4 } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CREDENTIALS_PATH = resolve(__dirname, '../../../credentials.json');
const TOKEN_PATH = resolve(__dirname, '../../../token.json');

export interface SheetsClientConfig {
  spreadsheetId: string;
}

export class SheetsClient {
  private sheets: sheets_v4.Sheets | null = null;
  private config: SheetsClientConfig;

  constructor(config: SheetsClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Load credentials
    if (!existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        `credentials.json not found at ${CREDENTIALS_PATH}.\n` +
        'Place your Google OAuth credentials file in the crawler/ directory.'
      );
    }

    if (!existsSync(TOKEN_PATH)) {
      throw new Error(
        `token.json not found at ${TOKEN_PATH}.\n` +
        'Run "npx tsx src/auth.ts" first to authorize.'
      );
    }

    const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    const { client_id, client_secret } = credentials.installed;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      'http://localhost:3333',
    );
    
    oauth2Client.setCredentials(tokens);

    // Auto-refresh token if expired
    oauth2Client.on('tokens', (newTokens) => {
      const { writeFileSync } = require('fs');
      const merged = { ...tokens, ...newTokens };
      writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      console.log('[SheetsClient] Token refreshed and saved');
    });

    this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    console.log('[SheetsClient] Connected to Google Sheets (OAuth2)');
  }

  disconnect(): void {
    this.sheets = null;
    console.log('[SheetsClient] Disconnected');
  }

  private getSheets(): sheets_v4.Sheets {
    if (!this.sheets) {
      throw new Error('SheetsClient not connected. Call connect() first.');
    }
    return this.sheets;
  }

  // Read all rows from a sheet tab
  async getRows(sheetName: string): Promise<string[][]> {
    const response = await this.getSheets().spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: `${sheetName}!A:Z`,
    });
    return (response.data.values as string[][]) || [];
  }

  // Read a specific range
  async getRange(range: string): Promise<string[][]> {
    const response = await this.getSheets().spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range,
    });
    return (response.data.values as string[][]) || [];
  }

  // Append a new row to a sheet
  async appendRow(sheetName: string, values: string[]): Promise<void> {
    await this.getSheets().spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [values],
      },
    });
  }

  // Append multiple rows at once (batch)
  async appendRows(sheetName: string, rows: string[][]): Promise<void> {
    if (rows.length === 0) return;
    await this.getSheets().spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });
  }

  // Update a specific row (1-indexed, row 1 = header)
  async updateRow(sheetName: string, rowIndex: number, values: string[]): Promise<void> {
    await this.getSheets().spreadsheets.values.update({
      spreadsheetId: this.config.spreadsheetId,
      range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [values],
      },
    });
  }

  // Initialize a sheet with header row if empty
  async initializeSheet(sheetName: string, headers: string[]): Promise<void> {
    try {
      const existing = await this.getRows(sheetName);
      if (existing.length === 0) {
        await this.appendRow(sheetName, headers);
        console.log(`[SheetsClient] Initialized ${sheetName} with headers`);
      }
    } catch (error: any) {
      // If tab doesn't exist, the error will say "Unable to parse range"
      if (error.message?.includes('Unable to parse range') || error.code === 400) {
        console.error(`[SheetsClient] Tab "${sheetName}" does not exist in the spreadsheet.`);
        console.error(`  → Please create it manually in Google Sheets.`);
        throw new Error(`Sheet tab "${sheetName}" not found. Create it in Google Sheets first.`);
      }
      throw error;
    }
  }
}
