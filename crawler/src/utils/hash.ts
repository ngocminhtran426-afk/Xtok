// ===== Content Hash Utility =====
// Creates SHA-256 hash of video content for deduplication and change detection.

import { createHash } from 'crypto';

/**
 * Generate a content hash from video metadata.
 * Used to detect if content has changed since last crawl.
 * 
 * hash(title + video_url + thumbnail_url)
 */
export function contentHash(title: string, videoUrl: string, thumbnailUrl: string): string {
  const input = `${title}|${videoUrl}|${thumbnailUrl}`;
  return createHash('sha256').update(input).digest('hex');
}
