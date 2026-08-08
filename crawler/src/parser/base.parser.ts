// ===== Base Parser Interface =====
// Each source type implements its own parser.
// Parser converts raw HTML/JSON into NormalizedVideo[].

import { NormalizedVideo } from '../models/video';

export interface SourceParser {
  /** Human-readable name of the parser */
  name: string;
  
  /** Parse raw page content into normalized videos */
  parse(content: string, pageUrl: string): { videos: NormalizedVideo[]; nextPageUrl?: string };
  
  /** Check if this parser can handle the given URL */
  canHandle(url: string): boolean;
}
