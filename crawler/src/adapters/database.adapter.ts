// ===== DatabaseAdapter Interface =====
// This is the most important abstraction in the system.
// Crawler and Web API code ONLY interact with this interface.
// Swap GoogleSheetsAdapter → SupabaseAdapter without touching business logic.

import { Page, CreatePageInput, UpdatePageInput, PageFilter } from '../models/page';
import { Video, CreateVideoInput, UpdateVideoInput, VideoFilter, VideoListFilter } from '../models/video';
import { CrawlJob, CreateCrawlJobInput, UpdateCrawlJobInput, DailyStats } from '../models/crawl-job';

export interface DatabaseAdapter {
  // ===== Connection =====
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // ===== Pages =====
  getPage(id: string): Promise<Page | null>;
  getPages(filter?: PageFilter): Promise<Page[]>;
  getPagesNeedingCrawl(): Promise<Page[]>;
  createPage(page: CreatePageInput): Promise<Page>;
  updatePage(id: string, data: UpdatePageInput): Promise<Page>;

  // ===== Videos =====
  findVideo(filter: VideoFilter): Promise<Video | null>;
  findVideos(filter?: VideoListFilter): Promise<{ items: Video[]; nextCursor?: string }>;
  createVideo(video: CreateVideoInput): Promise<Video>;
  updateVideo(id: string, data: UpdateVideoInput): Promise<Video>;

  // ===== Crawl Jobs =====
  createCrawlJob(job: CreateCrawlJobInput): Promise<CrawlJob>;
  updateCrawlJob(id: string, data: UpdateCrawlJobInput): Promise<CrawlJob>;

  // ===== Settings =====
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // ===== Stats =====
  recordStats(stats: DailyStats): Promise<void>;
}
