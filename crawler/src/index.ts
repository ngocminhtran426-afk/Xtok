// ===== Crawler Main Entry Point =====
// 
// Flow:
// START → Load config → Connect Google Sheets → Load pages
// → Scheduler chọn pages cần crawl (next_crawl_at <= NOW)
// → Đưa vào queue → Workers xử lý → Done

import { loadConfig } from './config';
import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter';
import { DatabaseAdapter } from './adapters/database.adapter';
import { Scheduler } from './scheduler';
import { Queue } from './queue';
import { Worker, WorkerResult } from './crawler/worker';
import { GenericParser } from './parser/generic.parser';
import { SourceParser } from './parser/base.parser';
import { Page } from './models/page';
import { DailyStats } from './models/crawl-job';
import { CrawlerConfig } from './config/crawler.config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('===================================');
  console.log('  Video Crawler v1.0');
  console.log('  Google Sheets Database');
  console.log('===================================');
  console.log();

  // 1. Load config
  const config = loadConfig();
  console.log('[Main] Config loaded');

  // 2. Create database adapter
  const db: DatabaseAdapter = new GoogleSheetsAdapter(config.sheets.spreadsheetId);

  // 3. Connect to Google Sheets
  await db.connect();

  // 4. Check if crawler is enabled
  if (!config.crawler.enabled) {
    console.log('[Main] Crawler is disabled. Exiting.');
    await db.disconnect();
    return;
  }

  // 5. Select parser based on source type
  const parser: SourceParser = selectParser(config.source.type);
  console.log(`[Main] Using parser: ${parser.name}`);

  // 6. Create scheduler
  const scheduler = new Scheduler(db, config.crawler.maxPagesPerRun);

  // 7. Get pages to crawl
  const pagesToCrawl = await scheduler.getPagesToCrawl();
  
  if (pagesToCrawl.length === 0) {
    console.log('[Main] No pages need crawling. Exiting.');
    await db.disconnect();
    return;
  }

  console.log(`[Main] ${pagesToCrawl.length} pages to crawl`);

  // 8. Create worker and queue
  const worker = new Worker(db, parser);
  const queue = new Queue<Page>({ concurrency: config.crawler.maxConcurrentWorkers });

  // Track results for stats
  const results: WorkerResult[] = [];

  queue.onProcess(async (page) => {
    const result = await worker.processPage(page);
    results.push(result);
  });

  // 9. Add pages to queue
  queue.add(pagesToCrawl);

  // 10. Wait for all pages to be processed
  await queue.drain();

  // 11. Record daily stats
  const stats: DailyStats = {
    date: new Date().toISOString().split('T')[0],
    pagesCrawled: results.filter(r => r.status === 'success').length,
    pagesFailed: results.filter(r => r.status === 'failed').length,
    videosFound: results.reduce((sum, r) => sum + r.videosFound, 0),
    videosNew: results.reduce((sum, r) => sum + r.videosNew, 0),
    videosDuplicate: results.reduce((sum, r) => sum + r.videosDuplicate, 0),
    captchaDetected: results.filter(r => r.status === 'captcha_detected').length,
  };

  await db.recordStats(stats);

  // 12. Summary
  console.log();
  console.log('===================================');
  console.log('  Crawl Summary');
  console.log('===================================');
  console.log(`  Pages crawled:    ${stats.pagesCrawled}`);
  console.log(`  Pages failed:     ${stats.pagesFailed}`);
  console.log(`  CAPTCHA detected: ${stats.captchaDetected}`);
  console.log(`  Videos found:     ${stats.videosFound}`);
  console.log(`  Videos new:       ${stats.videosNew}`);
  console.log(`  Videos duplicate: ${stats.videosDuplicate}`);
  console.log('===================================');

  // 13. Disconnect
  await db.disconnect();
  console.log('[Main] Done.');
}

function selectParser(sourceType: string): SourceParser {
  switch (sourceType) {
    case 'generic':
      return new GenericParser();
    default:
      console.warn(`[Main] Using GenericParser as default parser (configured via crawler.config.ts)`);
      return new GenericParser();
  }
}

// Run
main().catch(error => {
  console.error('[Main] Fatal error:', error);
  process.exit(1);
});
