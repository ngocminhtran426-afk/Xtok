// ===== Scheduler =====
// Selects pages that need crawling: next_crawl_at <= NOW()
// Does NOT crawl all 12,000 pages every run.

import { DatabaseAdapter } from '../adapters/database.adapter';
import { Page } from '../models/page';

export class Scheduler {
  private db: DatabaseAdapter;
  private maxPagesPerRun: number;

  constructor(db: DatabaseAdapter, maxPagesPerRun: number = 20) {
    this.db = db;
    this.maxPagesPerRun = maxPagesPerRun;
  }

  /**
   * Get pages that are due for crawling.
   * Returns pages sorted by priority (high first) then by next_crawl_at.
   * Limited to maxPagesPerRun.
   */
  async getPagesToCrawl(): Promise<Page[]> {
    // Check if crawler is enabled via settings
    const enabled = await this.db.getSetting('crawler_enabled');
    if (enabled === 'false') {
      console.log('[Scheduler] Crawler is disabled via settings');
      return [];
    }

    // Override max pages from settings if available
    const maxFromSettings = await this.db.getSetting('max_pages_per_run');
    const limit = maxFromSettings ? parseInt(maxFromSettings) : this.maxPagesPerRun;

    // Get pages where next_crawl_at <= NOW()
    const pages = await this.db.getPagesNeedingCrawl();

    const pagesToCrawl = pages.filter(page => {
      if (!page.nextCrawlAt) return true;
      return true; // TEMPORARY FORCE CRAWL
    });

    // Sort: high priority first, then earliest next_crawl_at
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    pagesToCrawl.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return (a.nextCrawlAt || '').localeCompare(b.nextCrawlAt || '');
    });

    const selected = pagesToCrawl.slice(0, limit);
    console.log(`[Scheduler] Selected ${selected.length}/${pagesToCrawl.length} pages to crawl (limit: ${limit})`);
    
    return selected;
  }
}
