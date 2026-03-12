import type { ExtractedArticle } from '../../shared/types';

export interface WebsiteAdapter {
  name: string;
  matches(url: string): boolean;
  extract(document: Document, location: Location): ExtractedArticle;
}
