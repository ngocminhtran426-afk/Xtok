// ===== Config =====

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, '../../.env') });

export interface AppConfig {
  // Google Sheets
  sheets: {
    spreadsheetId: string;
  };
  
  // Crawler
  crawler: {
    enabled: boolean;
    maxPagesPerRun: number;
    defaultCrawlInterval: number; // seconds
    maxConcurrentWorkers: number;
    maxRetryAttempts: number;
  };
  
  // Source
  source: {
    baseUrl: string;
    type: string;
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    sheets: {
      spreadsheetId: requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID'),
    },
    crawler: {
      enabled: process.env.CRAWLER_ENABLED !== 'false',
      maxPagesPerRun: parseInt(process.env.MAX_PAGES_PER_RUN || '20'),
      defaultCrawlInterval: parseInt(process.env.DEFAULT_CRAWL_INTERVAL || '1800'),
      maxConcurrentWorkers: parseInt(process.env.MAX_CONCURRENT_WORKERS || '3'),
      maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
    },
    source: {
      baseUrl: process.env.SOURCE_BASE_URL || 'https://example.com',
      type: process.env.SOURCE_TYPE || 'mock',
    },
  };
}
