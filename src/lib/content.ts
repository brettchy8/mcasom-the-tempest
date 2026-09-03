import raw from '../generated/content.json';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
export { isPoetry } from '../../scripts/text.mjs';

export interface Issue {
  year: string;
  description: string;
  pdf: string;
  heroCredit: string;
  featuredWorks: string[];
  sections: { title: string; page: number }[];
  cover: string;
  coverWidth: number;
  coverHeight: number;
  pageCount: number;
  pageRatio: number;
  fileSize: string;
  status: string;
}
export interface Work {
  slug: string;
  title: string;
  author: string;
  issue: string;
  category: string;
  order: number | null;
  excerpt: string;
  body: string;
  pdfPage: number | null;
  about: string;
  artworks: { image: string; alt: string; caption: string }[];
  recordings: { file: string; title: string; description: string }[];
  status: string;
}
export interface Author {
  slug: string;
  name: string;
  bio: string;
  portrait: string;
  status: string;
}
export const content = raw as {
  preview: boolean;
  site: typeof raw.site;
  issues: Issue[];
  works: Work[];
  authors: Author[];
};
export const { site, issues, works, authors, preview } = content;
export const currentIssue = issues.find((i) => i.year === site.currentIssue) || issues[0];
export const url = (p = '/') =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
export const issueUrl = (i: Issue | string) =>
  url(`/issues/${typeof i === 'string' ? i : i.year}/`);
export const readerUrl = (i: Issue | string, page?: number | null) =>
  `${issueUrl(i)}reader/${page ? `?page=${page}` : ''}`;
export const authorFor = (w: Work) => authors.find((a) => a.slug === w.author)!;
export const worksFor = (i: Issue) => works.filter((w) => w.issue === i.year);
export const initials = (s: string) =>
  s
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
export function prose(value: string) {
  return sanitizeHtml(marked.parse(value, { async: false }) as string, {
    allowedTags: ['p', 'br', 'em', 'strong', 'a', 'blockquote', 'ul', 'ol', 'li', 'h2', 'h3', 'hr'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
  });
}
