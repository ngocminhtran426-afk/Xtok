// ===== Mock Parser =====
// Used for development and testing.
// Returns fake video data with public test video URLs.
// Replace with real SourceParser for production.

import { SourceParser } from './base.parser';
import { NormalizedVideo } from '../models/video';

// Public test videos that support HTTP Range requests
const TEST_VIDEOS = [
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    title: 'Big Buck Bunny',
    duration: 596,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    title: 'Elephants Dream',
    duration: 653,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
    title: 'For Bigger Blazes',
    duration: 15,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
    title: 'For Bigger Escapes',
    duration: 15,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
    title: 'For Bigger Fun',
    duration: 60,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg',
    title: 'For Bigger Joyrides',
    duration: 15,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg',
    title: 'For Bigger Meltdowns',
    duration: 15,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
    title: 'Sintel',
    duration: 888,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
    title: 'Subaru Outback On Street And Dirt',
    duration: 596,
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
    title: 'Tears of Steel',
    duration: 734,
  },
];

export class MockParser implements SourceParser {
  name = 'MockParser';

  canHandle(url: string): boolean {
    return url.includes('example.com') || url.includes('mock');
  }

  parse(content: string, pageUrl: string): { videos: NormalizedVideo[]; nextPageUrl?: string } {
    // Generate a deterministic set of videos based on page URL
    const pageHash = this.simpleHash(pageUrl);
    const videoCount = 3 + (pageHash % 8); // 3-10 videos per page
    
    const videos: NormalizedVideo[] = [];
    
    for (let i = 0; i < videoCount; i++) {
      const videoIdx = (pageHash + i) % TEST_VIDEOS.length;
      const testVideo = TEST_VIDEOS[videoIdx];
      
      videos.push({
        sourceId: `mock_${pageHash}_${i}`,
        sourcePage: pageUrl,
        title: `${testVideo.title} - Page ${pageHash} #${i + 1}`,
        description: `Mock video from ${pageUrl} (index ${i})`,
        videoUrl: testVideo.url,
        thumbnailUrl: testVideo.thumbnail,
        duration: testVideo.duration,
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    return { videos, nextPageUrl: undefined };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
