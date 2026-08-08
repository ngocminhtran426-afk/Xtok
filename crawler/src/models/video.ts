// ===== Video Model =====

export interface NormalizedVideo {
  sourceId: string;
  sourcePage: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: string;
}

export interface Video extends NormalizedVideo {
  id: string;
  contentHash: string;
  status: 'active' | 'inactive' | 'removed';
  views: number;
  likes: number;
  discoveredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVideoInput {
  sourceId: string;
  sourcePage: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: string;
  contentHash: string;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  contentHash?: string;
  status?: 'active' | 'inactive' | 'removed';
  views?: number;
  likes?: number;
}

export interface VideoFilter {
  sourceId?: string;
  videoUrl?: string;
  contentHash?: string;
}

export interface VideoListFilter {
  status?: string;
  sourcePage?: string;
  cursor?: string;
  limit?: number;
}
