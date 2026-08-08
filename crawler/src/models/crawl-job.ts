// ===== CrawlJob Model =====

export type CrawlJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'captcha_detected';

export interface CrawlJob {
  id: string;
  pageId: string;
  url: string;
  status: CrawlJobStatus;
  attempt: number;
  startedAt: string;
  finishedAt: string;
  error: string;
  createdAt: string;
}

export interface CreateCrawlJobInput {
  pageId: string;
  url: string;
  status?: CrawlJobStatus;
  attempt?: number;
}

export interface UpdateCrawlJobInput {
  status?: CrawlJobStatus;
  attempt?: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface DailyStats {
  date: string;
  pagesCrawled: number;
  pagesFailed: number;
  videosFound: number;
  videosNew: number;
  videosDuplicate: number;
  captchaDetected: number;
}
