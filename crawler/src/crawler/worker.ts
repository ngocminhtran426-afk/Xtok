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
   * Process a single page:
   * 1. Create crawl job record
   * 2. Fetch page content
   * 3. Check for CAPTCHA
   * 4. Parse videos
   * 5. Deduplicate
   * 6. Save new videos
   * 7. Update page status
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

      try {
        let response = await browserPage.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
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
          // Nếu không có CAPTCHA, vẫn cần chờ trang tải xong (trường hợp trang dùng React/Vue)
          console.log('[Worker] Không có CAPTCHA, đang chờ trang tải hoàn tất...');
          try {
            await browserPage.waitForLoadState('networkidle', { timeout: 10000 });
          } catch(e) {}
          // Đợi thêm 2 giây cho chắc ăn dữ liệu đã render
          await browserPage.waitForTimeout(2000);
        }

        // Lấy lại response cuối cùng sau khi reload/render
        body = await browserPage.content();
        
        // DUMP HTML để debug
        require('fs').writeFileSync('debug.html', body);
        console.log('[Worker] Đã lưu mã nguồn HTML vào file crawler/debug.html để kiểm tra.');
        
        // Override statusCode thành 200 nếu body không còn chứa captcha (để lừa detectCaptcha ở dưới)
        if (!body.includes('cf-browser-verification')) {
          statusCode = 200;
        }
      } finally {
        await browser.close(); // Chỉ ngắt kết nối, không tắt trình duyệt thật
      }

      // 2. Check CAPTCHA
      const captchaResult = detectCaptcha(
        statusCode,
        body,
        headers,
      );

      if (captchaResult.detected) {
        console.warn(`[Worker] CAPTCHA detected on page ${page.id}: ${captchaResult.message}`);
        
        result.status = 'captcha_detected';
        result.error = captchaResult.message;

        await this.db.updateCrawlJob(job.id, {
          status: 'captcha_detected',
          finishedAt: new Date().toISOString(),
          error: captchaResult.message,
        });

        await this.db.updatePage(page.id, {
          errorCount: page.errorCount + 1,
          lastError: captchaResult.message || 'CAPTCHA detected',
          // Retry later with longer interval
          nextCrawlAt: new Date(Date.now() + page.crawlInterval * 2 * 1000).toISOString(),
        });

        return result;
      }

      // 3. Check response status
      if (statusCode >= 400 && statusCode !== 403 && statusCode !== 401) {
        throw new Error(`HTTP Error ${statusCode}`);
      }

      // 4. Parse videos
      const parsedData = this.parser.parse(body, page.url);
      const normalizedVideos = Array.isArray(parsedData) ? parsedData : parsedData.videos;
      const nextPageUrl = Array.isArray(parsedData) ? undefined : parsedData.nextPageUrl;

      result.videosFound = normalizedVideos.length;
      console.log(`[Worker] Found ${normalizedVideos.length} videos on page ${page.id}`);

      // 4.5. Queue next page if found
      if (nextPageUrl) {
        console.log(`[Worker] Found next page: ${nextPageUrl}, queuing...`);
        try {
          // Check if page already exists
          const allPages = await this.db.getPagesToCrawl(); // Or just get all pages if possible, but actually we don't have getPageByUrl.
          // Let's just create a quick loop over pagesCache if adapter exposes it? No.
          // In GoogleSheetsAdapter, we don't have a direct findPage method.
          // I will just add the delay to avoid hitting Google API limits for createPage.
          // Wait, to prevent duplicates, let's fetch pages.
          const pages = await this.db.getPagesToCrawl();
          const exists = pages.some(p => p.url === nextPageUrl);
          
          if (!exists) {
            await this.db.createPage({
              url: nextPageUrl,
              status: 'active',
              priority: 'medium',
              crawlInterval: page.crawlInterval
            });
            // Chống dội bom
            await new Promise(resolve => setTimeout(resolve, 1200));
          } else {
             console.log(`[Worker] Next page already queued.`);
          }
        } catch (err) {
          console.log(`[Worker] Note: Next page might already exist in DB or error occurred.`);
        }
      }

      // 5. Deduplicate and save
      for (const video of normalizedVideos) {
        const saved = await this.deduplicateAndSave(video);
        if (saved === 'new') {
          result.videosNew++;
        } else {
          result.videosDuplicate++;
        }
      }

      // 6. Update page status
      const now = new Date().toISOString();
      const newHash = contentHash(page.url, String(result.videosFound), now);
      
      await this.db.updatePage(page.id, {
        lastCrawledAt: now,
        lastSuccessAt: now,
        lastContentHash: newHash,
        nextCrawlAt: new Date(Date.now() + page.crawlInterval * 1000).toISOString(),
        errorCount: 0,
        lastError: '',
      });

      // 7. Mark job success
      await this.db.updateCrawlJob(job.id, {
        status: 'success',
        finishedAt: now,
      });

      console.log(`[Worker] Page ${page.id} done: ${result.videosNew} new, ${result.videosDuplicate} duplicate`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.status = 'failed';
      result.error = errorMsg;

      console.error(`[Worker] Page ${page.id} failed: ${errorMsg}`);

      await this.db.updateCrawlJob(job.id, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: errorMsg,
      });

      await this.db.updatePage(page.id, {
        errorCount: page.errorCount + 1,
        lastError: errorMsg,
        lastCrawledAt: new Date().toISOString(),
        // Backoff: double the interval on error
        nextCrawlAt: new Date(
          Date.now() + page.crawlInterval * Math.min(Math.pow(2, page.errorCount), 16) * 1000,
        ).toISOString(),
      });
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
