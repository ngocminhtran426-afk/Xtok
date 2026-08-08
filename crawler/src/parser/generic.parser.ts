import * as cheerio from 'cheerio';
import { SourceParser } from './base.parser';
import { NormalizedVideo } from '../models/video';
import { CrawlerConfig } from '../config/crawler.config';

export class GenericParser implements SourceParser {
  name = 'GenericParser';
  
  parse(html: string, sourceUrl: string): NormalizedVideo[] {
    const $ = cheerio.load(html);
    const videos: NormalizedVideo[] = [];
    const selectors = CrawlerConfig.Selectors;

    // Lặp qua từng thẻ bao ngoài của video
    const items = $(selectors.videoItem);
    console.log(`[GenericParser] Found ${items.length} items matching selector "${selectors.videoItem}"`);
    
    items.each((index, element) => {
      try {
        const item = $(element);
        
        // Trích xuất dữ liệu dựa trên Selector
        const videoUrl = item.find(selectors.videoUrl).attr(selectors.videoUrlAttr) || '';
        const thumbnailUrl = item.find(selectors.thumbnailUrl).attr(selectors.thumbnailUrlAttr) || '';
        const title = item.find(selectors.title).text().trim() || `Video ${index + 1}`;
        const authorName = item.find(selectors.authorName).text().trim() || 'Unknown User';
        const authorAvatar = item.find(selectors.authorAvatar).attr(selectors.authorAvatarAttr) || '';
        
        const viewsStr = item.find(selectors.viewsCount).text().trim();
        const viewsCount = parseInt(viewsStr.replace(/\D/g, '')) || Math.floor(Math.random() * 1000);
        
        // Tạo unique ID
        const sourceId = videoUrl ? require('crypto').createHash('md5').update(videoUrl).digest('hex').substring(0, 20) : `vid_${Date.now()}_${index}`;

        // Bỏ qua nếu ko tìm thấy video URL
        if (!videoUrl) {
          console.log(`[GenericParser] ⚠️ Bỏ qua item ${index}: Không tìm thấy Video URL bằng thẻ '${selectors.videoUrl}' (thuộc tính '${selectors.videoUrlAttr}')`);
          return;
        }
        
        // Sửa lỗi link tương đối
        const fullVideoUrl = videoUrl.startsWith('http') ? videoUrl : (CrawlerConfig.TARGET_URL.replace(/\/$/, '') + (videoUrl.startsWith('/') ? '' : '/') + videoUrl);
        const fullThumbnailUrl = thumbnailUrl.startsWith('http') ? thumbnailUrl : (CrawlerConfig.TARGET_URL.replace(/\/$/, '') + (thumbnailUrl.startsWith('/') ? '' : '/') + thumbnailUrl);

        const rawVideo: any = {
          sourceId,
          title,
          description: title,
          videoUrl: fullVideoUrl,
          thumbnailUrl: fullThumbnailUrl,
          duration: 0,
          authorId: authorName,
          authorName,
          authorAvatar,
          musicId: 'music_1',
          musicTitle: 'Original Sound - ' + authorName,
          likesCount: viewsCount,
          commentsCount: Math.floor(viewsCount / 10),
          sharesCount: Math.floor(viewsCount / 20),
          publishedAt: new Date().toISOString()
        };

        const processedVideo = typeof (CrawlerConfig as any).processItem === 'function' 
          ? (CrawlerConfig as any).processItem(rawVideo) 
          : rawVideo;

        videos.push(processedVideo as NormalizedVideo);
      } catch (err) {
        console.error(`[GenericParser] Error parsing item ${index}:`, err);
      }
    });
    let nextPageUrl: string | undefined = undefined;
    const nextConfig = CrawlerConfig.Selectors as any;
    if (nextConfig.nextPage) {
      const nextHref = $(nextConfig.nextPage).attr(nextConfig.nextPageAttr || 'href');
      if (nextHref) {
        nextPageUrl = nextHref.startsWith('http') ? nextHref : (CrawlerConfig.TARGET_URL.replace(/\/$/, '') + (nextHref.startsWith('/') ? '' : '/') + nextHref);
      }
    }

    return { videos, nextPageUrl };
  }
}
