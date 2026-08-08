// ===== Page Model =====

export interface Page {
  id: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  priority: 'high' | 'medium' | 'low';
  lastCrawledAt: string;
  lastSuccessAt: string;
  lastContentHash: string;
  nextCrawlAt: string;
  crawlInterval: number; // seconds
  errorCount: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageInput {
  url: string;
  status?: 'active' | 'inactive';
  priority?: 'high' | 'medium' | 'low';
  crawlInterval?: number;
}

export interface UpdatePageInput {
  status?: 'active' | 'inactive' | 'error';
  priority?: 'high' | 'medium' | 'low';
  lastCrawledAt?: string;
  lastSuccessAt?: string;
  lastContentHash?: string;
  nextCrawlAt?: string;
  crawlInterval?: number;
  errorCount?: number;
  lastError?: string;
}

export interface PageFilter {
  status?: string;
  priority?: string;
}
