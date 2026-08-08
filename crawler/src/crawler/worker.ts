// ===== Crawler Worker =====
// Processes a single page: fetch → detect CAPTCHA → parse → deduplicate → save.

// import { chromium } from 'playwright';
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
import { DatabaseAdapter } from '../adapters/database.adapter';
import { SourceParser } from '../parser/base.parser';
import { detectCaptcha } from './captcha-detector';
import { contentHash } from '../utils/hash';
import { NormalizedVideo } from '../models/video';
import { Page } from '../models/page';

export interface WorkerResult {
  pageId: string;
  status: 'success' | 'failed' | 'captcha_detected';
  videosFound: number;
  videosNew: number;
  videosDuplicate: number;
  error?: string;
}

export class Worker {
  private db: DatabaseAdapter;
  private parser: SourceParser;

  constructor(db: DatabaseAdapter, parser: SourceParser) {
    this.db = db;
    this.parser = parser;
  }

  /**
   * Process a page in a continuous loop:
   * 1. Go to page 1
   * 2. Extract videos
   * 3. Click "Tiếp theo"
   * 4. Repeat 2-3
   * 5. Every 5 minutes, go back to page 1 to check for new videos, then resume where it left off.
   */
  async processPage(page: Page): Promise<WorkerResult> {
    const result: WorkerResult = {
      pageId: page.id,
      status: 'success',
      videosFound: 0,
      videosNew: 0,
      videosDuplicate: 0,
    };

    // Create crawl job
    const job = await this.db.createCrawlJob({
      pageId: page.id,
      url: page.url,
      status: 'running',
    });

    try {
      console.log(`[Worker] Processing page ${page.id}: ${page.url}`);

      // CHUYỆN GÌ CŨNG ĐỂ GOOGLE CHROME THẬT LO!
      // Kết nối với Google Chrome thật đang chạy ẩn ở cổng 9222
      let browser;
      try {
        browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log('[Worker] Đã kết nối với Chrome đang chạy ở port 9222.');
      } catch (e) {
        console.log('[Worker] Không tìm thấy Chrome ở port 9222. Đang khởi chạy trình duyệt nội bộ ẩn (Headless)...');
        // Fallback cho môi trường server / Github Actions
        browser = await chromium.launch({ headless: true });
      }
      
      const browserContext = browser.contexts().length > 0 ? browser.contexts()[0] : await browser.newContext();
      const browserPage = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
      
      let body = '';
      let statusCode = 200;
      let headers: Record<string, string> = {};

      const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
      let lastCheckPage1 = Date.now();
      let currentPageUrl = page.url;
      
      // Start continuous loop
      while (true) {
        try {
          console.log(`[Worker] Navigating to: ${currentPageUrl}`);
          let response = await browserPage.goto(currentPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Kiểm tra xem có bị Cloudflare chặn không bằng cách quét mã nguồn
          let currentHtml = await browserPage.content();
          if (currentHtml.includes('challenge-platform') || currentHtml.includes('cf-browser-verification')) {
            console.log('[Worker] ⚠️ PHÁT HIỆN CAPTCHA (Cloudflare)! Vui lòng giải CAPTCHA thủ công trên cửa sổ trình duyệt...');
            console.log('[Worker] ⏳ Hệ thống sẽ chờ tối đa 60 giây...');
            
            try {
              // Chờ cho đến khi Cloudflare biến mất khỏi HTML (tức là đã giải xong CAPTCHA)
              await browserPage.waitForFunction(
                () => !document.body.innerHTML.includes('challenge-platform') && !document.body.innerHTML.includes('cf-browser-verification'),
                { timeout: 60000 }
              );
              console.log('[Worker] ✅ Đã giải xong CAPTCHA! Đang tải dữ liệu...');
              await browserPage.waitForLoadState('networkidle', { timeout: 15000 });
            } catch (e) {
              console.log('[Worker] ❌ Hết thời gian chờ giải CAPTCHA.');
            }
          } else {
            // Nếu không có CAPTCHA, vẫn cần chờ trang tải xong
            console.log('[Worker] Không có CAPTCHA, đang chờ trang tải hoàn tất...');
            try {
              await browserPage.waitForLoadState('networkidle', { timeout: 10000 });
            } catch(e) {}
            // Đợi thêm 2 giây cho chắc ăn dữ liệu đã render
            await browserPage.waitForTimeout(2000);
          }

          // Lấy lại response cuối cùng sau khi reload/render
          body = await browserPage.content();
          statusCode = 200;
          
          // 2. Check CAPTCHA
          const captchaResult = detectCaptcha(statusCode, body, headers);
          if (captchaResult.detected) {
             console.warn(`[Worker] CAPTCHA detected on page ${page.id}: ${captchaResult.message}`);
             // Sleep and retry instead of exiting
             console.log(`[Worker] Sleeping for 60s before retrying...`);
             await new Promise(r => setTimeout(r, 60000));
             continue;
          }

          // 4. Parse videos
          const parsedData = this.parser.parse(body, currentPageUrl);
          const normalizedVideos = Array.isArray(parsedData) ? parsedData : parsedData.videos;

          result.videosFound = normalizedVideos.length;
          console.log(`[Worker] Found ${normalizedVideos.length} videos on ${currentPageUrl}`);

          // 5. Deduplicate and save
          for (const video of normalizedVideos) {
            const saved = await this.deduplicateAndSave(video);
            if (saved === 'new') {
              result.videosNew++;
            } else {
              result.videosDuplicate++;
            }
          }
          
          console.log(`[Worker] Progress: ${result.videosNew} new, ${result.videosDuplicate} duplicate totally.`);
          
          // Update Page 1 hash just in case
          if (currentPageUrl === page.url) {
             const now = new Date().toISOString();
             const newHash = contentHash(page.url, String(result.videosFound), now);
             await this.db.updatePage(page.id, {
               lastCrawledAt: now,
               lastSuccessAt: now,
               lastContentHash: newHash,
               errorCount: 0,
             });
          }

          // Check if we need to return to Page 1
          const timeSinceCheck = Date.now() - lastCheckPage1;
          if (timeSinceCheck >= CHECK_INTERVAL) {
             console.log(`[Worker] ⏰ 5 minutes passed! Returning to Page 1 to fetch new videos...`);
             lastCheckPage1 = Date.now();
             
             // Save current position
             const savedPositionUrl = browserPage.url();
             
             // Go to Page 1
             await browserPage.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
             await browserPage.waitForTimeout(3000);
             let p1Body = await browserPage.content();
             const p1Data = this.parser.parse(p1Body, page.url);
             const p1Videos = Array.isArray(p1Data) ? p1Data : p1Data.videos;
             
             console.log(`[Worker] Found ${p1Videos.length} newest videos on Page 1.`);
             for (const video of p1Videos) {
                const saved = await this.deduplicateAndSave(video);
                if (saved === 'new') result.videosNew++;
                else result.videosDuplicate++;
             }
             
             console.log(`[Worker] Returning to where we left off: ${savedPositionUrl}`);
             currentPageUrl = savedPositionUrl;
             // Vòng lặp sẽ gọi goto(currentPageUrl) ở đầu vòng tiếp theo
             continue;
          }

          // Move to next page via Playwright click
          console.log(`[Worker] Looking for "Tiếp theo" button...`);
          // Tìm nút có chữ "Tiếp theo"
          const nextBtn = await browserPage.$('a:has-text("Tiếp theo")');
          if (nextBtn) {
             console.log(`[Worker] Found "Tiếp theo" button! Clicking...`);
             // Random delay 2-4 seconds to simulate human
             await browserPage.waitForTimeout(2000 + Math.random() * 2000);
             
             await Promise.all([
               browserPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
               nextBtn.click()
             ]);
             
             currentPageUrl = browserPage.url();
             console.log(`[Worker] Advanced to: ${currentPageUrl}`);
          } else {
             console.log(`[Worker] "Tiếp theo" button not found. End of pagination or stuck. Resetting to Page 1.`);
             currentPageUrl = page.url;
             lastCheckPage1 = Date.now(); // Reset timer since we are going to page 1 anyway
             await browserPage.waitForTimeout(5000);
          }
          
        } catch (innerError) {
           console.error(`[Worker] Error during loop iteration:`, innerError);
           console.log(`[Worker] Retrying in 10 seconds...`);
           await new Promise(r => setTimeout(r, 10000));
        }
      }
      console.log(`[Worker] Found ${normalizedVideos.length} videos on page ${page.id}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.status = 'failed';
      result.error = errorMsg;

      console.error(`[Worker] Fatal error for page ${page.id}: ${errorMsg}`);
    }
    
    return result;
  }

  /**
   * Deduplication logic:
   * 1. Check source_id → if exists, UPDATE
   * 2. Check video_url/hash → if exists, skip
   * 3. Otherwise → INSERT
   */
  private async deduplicateAndSave(video: NormalizedVideo): Promise<'new' | 'duplicate'> {
    const hash = contentHash(video.title, video.videoUrl, video.thumbnailUrl);

    // Check by source_id first
    const existingBySourceId = await this.db.findVideo({ sourceId: video.sourceId });
    if (existingBySourceId) {
      // Check if content changed
      if (existingBySourceId.contentHash !== hash) {
        await this.db.updateVideo(existingBySourceId.id, {
          title: video.title,
          description: video.description,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          contentHash: hash,
        });
        console.log(`[Worker] Updated video ${existingBySourceId.id} (content changed)`);
        // Chống dội bom API Google Sheets (giới hạn 60 req/phút)
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
      return 'duplicate';
    }

    // Check by URL
    const existingByUrl = await this.db.findVideo({ videoUrl: video.videoUrl });
    if (existingByUrl) {
      return 'duplicate';
    }

    // Check by hash
    const existingByHash = await this.db.findVideo({ contentHash: hash });
    if (existingByHash) {
      return 'duplicate';
    }

    // New video — INSERT
    await this.db.createVideo({
      ...video,
      contentHash: hash,
    });
    
    // Chống dội bom API Google Sheets (giới hạn 60 req/phút)
    await new Promise(resolve => setTimeout(resolve, 1200));

    return 'new';
  }
}
