// ===== GoogleSheetsAdapter =====
// Implements DatabaseAdapter using Google Sheets as storage.
// Maps each tab to a "table", each row to a record.
// After migration: replace with SupabaseAdapter without changing business logic.

import { DatabaseAdapter } from '../database.adapter';
import { SheetsClient } from './client';
import { Page, CreatePageInput, UpdatePageInput, PageFilter } from '../../models/page';
import { Video, CreateVideoInput, UpdateVideoInput, VideoFilter, VideoListFilter } from '../../models/video';
import { CrawlJob, CreateCrawlJobInput, UpdateCrawlJobInput, DailyStats } from '../../models/crawl-job';

// Sheet tab names
const TABS = {
  VIDEOS: 'videos',
  PAGES: 'pages',
  CRAWL_JOBS: 'crawl_jobs',
  SETTINGS: 'settings',
  STATS: 'stats',
} as const;

// Header definitions for each tab
const HEADERS = {
  [TABS.VIDEOS]: [
    'id', 'source_id', 'source_page', 'title',
    'video_url', 'thumbnail_url'
  ],
  [TABS.PAGES]: [
    'id', 'url', 'status', 'priority', 'last_crawled_at',
    'last_success_at', 'last_content_hash', 'next_crawl_at',
    'crawl_interval', 'error_count', 'last_error',
    'created_at', 'updated_at',
  ],
  [TABS.CRAWL_JOBS]: [
    'id', 'page_id', 'url', 'status', 'attempt',
    'started_at', 'finished_at', 'error', 'created_at',
  ],
  [TABS.SETTINGS]: ['key', 'value'],
  [TABS.STATS]: [
    'date', 'pages_crawled', 'pages_failed', 'videos_found',
    'videos_new', 'videos_duplicate', 'captcha_detected',
  ],
};

// Auto-increment ID counters (in-memory, loaded from sheet on connect)
let videoIdCounter = 10000;
let pageIdCounter = 1000;
let jobIdCounter = 0;

export class GoogleSheetsAdapter implements DatabaseAdapter {
  private client: SheetsClient;
  
  // In-memory cache to reduce API calls
  private videosCache: Map<string, { data: Video; rowIndex: number }> = new Map();
  private pagesCache: Map<string, { data: Page; rowIndex: number }> = new Map();
  private cacheLoaded = false;

  constructor(spreadsheetId: string) {
    this.client = new SheetsClient({ spreadsheetId });
  }

  // ===== Connection =====

  async connect(): Promise<void> {
    await this.client.connect();
    
    // Initialize all tabs with headers
    for (const [tabName, headers] of Object.entries(HEADERS)) {
      await this.client.initializeSheet(tabName, headers);
    }

    // Load existing data into cache and set ID counters
    await this.loadCache();
    console.log('[GoogleSheetsAdapter] Ready');
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
    this.videosCache.clear();
    this.pagesCache.clear();
    this.cacheLoaded = false;
  }

  public async refreshCache(): Promise<void> {
    this.videosCache.clear();
    this.pagesCache.clear();
    await this.loadCache();
  }

  private async loadCache(): Promise<void> {
    // Load videos
    const videoRows = await this.client.getRows(TABS.VIDEOS);
    if (videoRows.length > 1) {
      const headers = videoRows[0];
      for (let i = 1; i < videoRows.length; i++) {
        const video = this.rowToVideo(headers, videoRows[i]);
        if (video) {
          this.videosCache.set(video.id, { data: video, rowIndex: i + 1 });
          const numId = parseInt(video.id);
          if (!isNaN(numId) && numId >= videoIdCounter) {
            videoIdCounter = numId + 1;
          }
        }
      }
    }

    // Load pages
    const pageRows = await this.client.getRows(TABS.PAGES);
    if (pageRows.length > 1) {
      const headers = pageRows[0];
      for (let i = 1; i < pageRows.length; i++) {
        const page = this.rowToPage(headers, pageRows[i]);
        if (page) {
          this.pagesCache.set(page.id, { data: page, rowIndex: i + 1 });
          const numId = parseInt(page.id);
          if (!isNaN(numId) && numId >= pageIdCounter) {
            pageIdCounter = numId + 1;
          }
        }
      }
    }

    // Load crawl jobs for counter
    const jobRows = await this.client.getRows(TABS.CRAWL_JOBS);
    if (jobRows.length > 1) {
      jobIdCounter = jobRows.length - 1;
    }

    this.cacheLoaded = true;
    console.log(`[GoogleSheetsAdapter] Cache loaded: ${this.videosCache.size} videos, ${this.pagesCache.size} pages`);
  }

  // ===== Pages =====

  async getPage(id: string): Promise<Page | null> {
    const cached = this.pagesCache.get(id);
    return cached?.data || null;
  }

  async getPages(filter?: PageFilter): Promise<Page[]> {
    let pages = Array.from(this.pagesCache.values()).map(v => v.data);
    
    if (filter?.status) {
      pages = pages.filter(p => p.status === filter.status);
    }
    if (filter?.priority) {
      pages = pages.filter(p => p.priority === filter.priority);
    }
    
    return pages;
  }

  async getPagesNeedingCrawl(): Promise<Page[]> {
    const now = new Date().toISOString();
    return Array.from(this.pagesCache.values())
      .map(v => v.data)
      .filter(p => p.status === 'active' && (!p.nextCrawlAt || p.nextCrawlAt <= now));
  }

  async createPage(input: CreatePageInput): Promise<Page> {
    const now = new Date().toISOString();
    const id = String(pageIdCounter++);
    
    const page: Page = {
      id,
      url: input.url,
      status: input.status || 'active',
      priority: input.priority || 'medium',
      lastCrawledAt: '',
      lastSuccessAt: '',
      lastContentHash: '',
      nextCrawlAt: now, // crawl immediately
      crawlInterval: input.crawlInterval || 1800,
      errorCount: 0,
      lastError: '',
      createdAt: now,
      updatedAt: now,
    };

    const row = this.pageToRow(page);
    await this.client.appendRow(TABS.PAGES, row);
    
    // Update cache
    const rowIndex = this.pagesCache.size + 2; // +1 header, +1 for 1-indexed
    this.pagesCache.set(id, { data: page, rowIndex });
    
    return page;
  }

  async updatePage(id: string, data: UpdatePageInput): Promise<Page> {
    const cached = this.pagesCache.get(id);
    if (!cached) {
      throw new Error(`Page ${id} not found`);
    }

    const updated: Page = {
      ...cached.data,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const row = this.pageToRow(updated);
    await this.client.updateRow(TABS.PAGES, cached.rowIndex, row);
    
    this.pagesCache.set(id, { data: updated, rowIndex: cached.rowIndex });
    return updated;
  }

  // ===== Videos =====

  async findVideo(filter: VideoFilter): Promise<Video | null> {
    for (const { data } of this.videosCache.values()) {
      if (filter.sourceId && data.sourceId === filter.sourceId) return data;
      if (filter.videoUrl && data.videoUrl === filter.videoUrl) return data;
      if (filter.contentHash && data.contentHash === filter.contentHash) return data;
    }
    return null;
  }

  async findVideos(filter?: VideoListFilter): Promise<{ items: Video[]; nextCursor?: string }> {
    let videos = Array.from(this.videosCache.values()).map(v => v.data);
    
    // Filter
    if (filter?.status) {
      videos = videos.filter(v => v.status === filter.status);
    }
    if (filter?.sourcePage) {
      videos = videos.filter(v => v.sourcePage === filter.sourcePage);
    }

    // Sort by ID descending (newest first)
    videos.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    // Cursor pagination
    const limit = filter?.limit || 10;
    let startIndex = 0;
    
    if (filter?.cursor) {
      startIndex = videos.findIndex(v => v.id === filter.cursor);
      if (startIndex === -1) startIndex = 0;
      else startIndex += 1; // start after cursor
    }

    const items = videos.slice(startIndex, startIndex + limit);
    const nextCursor = items.length === limit && startIndex + limit < videos.length
      ? items[items.length - 1].id
      : undefined;

    return { items, nextCursor };
  }

  async createVideo(input: CreateVideoInput): Promise<Video> {
    const now = new Date().toISOString();
    const id = String(videoIdCounter++);
    
    const video: Video = {
      id,
      sourceId: input.sourceId,
      sourcePage: input.sourcePage,
      title: input.title,
      description: input.description,
      videoUrl: input.videoUrl,
      thumbnailUrl: input.thumbnailUrl,
      duration: input.duration,
      publishedAt: input.publishedAt,
      discoveredAt: now,
      contentHash: input.contentHash,
      status: 'active',
      views: 0,
      likes: 0,
      createdAt: now,
      updatedAt: now,
    };

    const row = this.videoToRow(video);
    await this.client.appendRow(TABS.VIDEOS, row);
    
    const rowIndex = this.videosCache.size + 2;
    this.videosCache.set(id, { data: video, rowIndex });
    
    console.log(`[GoogleSheetsAdapter] Created video ${id}: ${video.title}`);
    return video;
  }

  async updateVideo(id: string, data: UpdateVideoInput): Promise<Video> {
    const cached = this.videosCache.get(id);
    if (!cached) {
      throw new Error(`Video ${id} not found`);
    }

    const updated: Video = {
      ...cached.data,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const row = this.videoToRow(updated);
    await this.client.updateRow(TABS.VIDEOS, cached.rowIndex, row);
    
    this.videosCache.set(id, { data: updated, rowIndex: cached.rowIndex });
    return updated;
  }

  // ===== Crawl Jobs =====

  async createCrawlJob(input: CreateCrawlJobInput): Promise<CrawlJob> {
    const now = new Date().toISOString();
    const id = `job_${String(++jobIdCounter).padStart(6, '0')}`;
    
    const job: CrawlJob = {
      id,
      pageId: input.pageId,
      url: input.url,
      status: input.status || 'pending',
      attempt: input.attempt || 1,
      startedAt: now,
      finishedAt: '',
      error: '',
      createdAt: now,
    };

    const row = this.crawlJobToRow(job);
    await this.client.appendRow(TABS.CRAWL_JOBS, row);
    
    return job;
  }

  async updateCrawlJob(id: string, data: UpdateCrawlJobInput): Promise<CrawlJob> {
    // For crawl jobs, we need to find the row
    const rows = await this.client.getRows(TABS.CRAWL_JOBS);
    const headers = rows[0];
    const idIdx = headers.indexOf('id');
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === id) {
        const existing = this.rowToCrawlJob(headers, rows[i]);
        if (!existing) throw new Error(`CrawlJob ${id} parse error`);
        
        const updated: CrawlJob = { ...existing, ...data };
        const row = this.crawlJobToRow(updated);
        await this.client.updateRow(TABS.CRAWL_JOBS, i + 1, row);
        return updated;
      }
    }
    
    throw new Error(`CrawlJob ${id} not found`);
  }

  // ===== Settings =====

  async getSetting(key: string): Promise<string | null> {
    const rows = await this.client.getRows(TABS.SETTINGS);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        return rows[i][1] || null;
      }
    }
    return null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const rows = await this.client.getRows(TABS.SETTINGS);
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        await this.client.updateRow(TABS.SETTINGS, i + 1, [key, value]);
        return;
      }
    }
    
    // Key doesn't exist, append
    await this.client.appendRow(TABS.SETTINGS, [key, value]);
  }

  // ===== Stats =====

  async recordStats(stats: DailyStats): Promise<void> {
    const row = [
      stats.date,
      String(stats.pagesCrawled),
      String(stats.pagesFailed),
      String(stats.videosFound),
      String(stats.videosNew),
      String(stats.videosDuplicate),
      String(stats.captchaDetected),
    ];
    await this.client.appendRow(TABS.STATS, row);
  }

  // ===== Row ↔ Object Mapping =====

  private rowToVideo(headers: string[], row: string[]): Video | null {
    if (!row || row.length === 0) return null;
    const get = (key: string) => row[headers.indexOf(key)] || '';
    
    return {
      id: get('id'),
      sourceId: get('source_id'),
      sourcePage: get('source_page'),
      title: get('title'),
      description: get('description'),
      videoUrl: get('video_url'),
      thumbnailUrl: get('thumbnail_url'),
      duration: parseInt(get('duration')) || 0,
      publishedAt: get('published_at'),
      discoveredAt: get('discovered_at'),
      contentHash: get('content_hash'),
      status: (get('status') as Video['status']) || 'active',
      views: parseInt(get('views')) || 0,
      likes: parseInt(get('likes')) || 0,
      createdAt: get('created_at'),
      updatedAt: get('updated_at'),
    };
  }

  private videoToRow(video: Video): string[] {
    return [
      video.id,
      video.sourceId,
      video.sourcePage,
      video.title,
      video.videoUrl,
      video.thumbnailUrl,
    ];
  }

  private rowToPage(headers: string[], row: string[]): Page | null {
    if (!row || row.length === 0) return null;
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      if (idx === -1 || row[idx] === undefined) return '';
      return String(row[idx]).trim();
    };
    
    return {
      id: get('id'),
      url: get('url'),
      status: (get('status') as Page['status']) || 'active',
      priority: (get('priority') as Page['priority']) || 'medium',
      lastCrawledAt: get('last_crawled_at'),
      lastSuccessAt: get('last_success_at'),
      lastContentHash: get('last_content_hash'),
      nextCrawlAt: get('next_crawl_at'),
      crawlInterval: parseInt(get('crawl_interval')) || 1800,
      errorCount: parseInt(get('error_count')) || 0,
      lastError: get('last_error'),
      createdAt: get('created_at'),
      updatedAt: get('updated_at'),
    };
  }

  private pageToRow(page: Page): string[] {
    return [
      page.id,
      page.url,
      page.status,
      page.priority,
      page.lastCrawledAt,
      page.lastSuccessAt,
      page.lastContentHash,
      page.nextCrawlAt,
      String(page.crawlInterval),
      String(page.errorCount),
      page.lastError,
      page.createdAt,
      page.updatedAt,
    ];
  }

  private rowToCrawlJob(headers: string[], row: string[]): CrawlJob | null {
    if (!row || row.length === 0) return null;
    const get = (key: string) => row[headers.indexOf(key)] || '';
    
    return {
      id: get('id'),
      pageId: get('page_id'),
      url: get('url'),
      status: (get('status') as CrawlJob['status']) || 'pending',
      attempt: parseInt(get('attempt')) || 1,
      startedAt: get('started_at'),
      finishedAt: get('finished_at'),
      error: get('error'),
      createdAt: get('created_at'),
    };
  }

  private crawlJobToRow(job: CrawlJob): string[] {
    return [
      job.id,
      job.pageId,
      job.url,
      job.status,
      String(job.attempt),
      job.startedAt,
      job.finishedAt,
      job.error,
      job.createdAt,
    ];
  }
}
