import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const year = z.string().regex(/^\d{4}$/);
const media = z
  .string()
  .refine(
    (v) =>
      !v ||
      (v.startsWith('/media/') &&
        !v.includes('..') &&
        !v.includes('\\') &&
        !v.includes('?') &&
        !v.includes('#')),
    'Choose a file in the media library',
  );
const common = {
  status: z.enum(['draft', 'published']).default('draft'),
  demo: z.boolean().default(false),
};
export const issueSchema = z.object({
  ...common,
  year,
  title: z.string().min(1),
  description: z.string().default(''),
  pdf: media.refine((v) => v.endsWith('.pdf')),
  heroImage: media.default(''),
  heroCredit: z.string().default(''),
  featuredWorks: z.array(slug).default([]),
  sections: z
    .array(z.object({ title: z.string().min(1), page: z.number().int().positive() }))
    .default([]),
});
export const authorSchema = z.object({
  ...common,
  slug,
  name: z.string().min(1),
  bio: z.string().default(''),
  portrait: media.default(''),
});
export const workSchema = z.object({
  ...common,
  slug,
  title: z.string().min(1),
  author: slug,
  issue: year,
  category: z.string().min(1),
  order: z.number().default(0),
  excerpt: z.string().default(''),
  body: z.string().default(''),
  format: z.enum(['poetry', 'prose']).default('prose'),
  image: media.default(''),
  pdfPage: z.number().int().positive().nullable().default(null),
  about: z.string().default(''),
  artworks: z
    .array(
      z.object({
        image: media.refine(Boolean),
        alt: z.string().min(1),
        caption: z.string().default(''),
      }),
    )
    .default([]),
  recordings: z
    .array(
      z.object({
        file: media.refine((v) => v.endsWith('.mp3')),
        title: z.string().min(1),
        description: z.string().default(''),
      }),
    )
    .default([]),
});
const siteSchema = z.object({
  title: z.string(),
  school: z.string(),
  description: z.string(),
  currentIssue: year,
  tagline: z.string(),
  about: z.string(),
  editorialRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
});

async function collection(root, name, schema) {
  const files = (await readdir(path.join(root, name))).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (f) => {
      const result = schema.safeParse(JSON.parse(await readFile(path.join(root, name, f), 'utf8')));
      if (!result.success) throw new Error(`${name}/${f}: ${result.error.message}`);
      const id = result.data.slug || result.data.year;
      if (f !== `${id}.json`) throw new Error(`${name}/${f}: filename must match ${id}.json`);
      return result.data;
    }),
  );
}

export async function loadContent(root, preview = false) {
  const [issues, works, authors, rawSite] = await Promise.all([
    collection(root, 'issues', issueSchema),
    collection(root, 'works', workSchema),
    collection(root, 'authors', authorSchema),
    readFile(path.join(root, 'site.json'), 'utf8'),
  ]);
  const visible = (item) => preview || (item.status === 'published' && !item.demo);
  const publishedIssues = issues.filter(visible).sort((a, b) => b.year.localeCompare(a.year));
  const publishedAuthors = authors.filter(visible);
  const publishedWorks = works
    .filter(visible)
    .filter((w) => publishedIssues.some((i) => i.year === w.issue));
  for (const w of works) {
    if (!issues.some((i) => i.year === w.issue))
      throw new Error(`${w.slug}: issue ${w.issue} does not exist`);
    if (!authors.some((a) => a.slug === w.author))
      throw new Error(`${w.slug}: author ${w.author} does not exist`);
  }
  for (const w of publishedWorks) {
    if (!publishedAuthors.some((a) => a.slug === w.author))
      throw new Error(`${w.slug}: publish the author before publishing their work`);
  }
  const site = siteSchema.parse(JSON.parse(rawSite));
  if (!publishedIssues.length) throw new Error('At least one issue must be published');
  if (!publishedIssues.some((i) => i.year === site.currentIssue))
    site.currentIssue = publishedIssues[0].year;
  return {
    preview,
    site,
    issues: publishedIssues.map((i) => ({
      ...i,
      featuredWorks: i.featuredWorks.filter((s) =>
        publishedWorks.some((w) => w.slug === s && w.issue === i.year),
      ),
    })),
    works: publishedWorks.sort((a, b) => a.order - b.order),
    authors: publishedAuthors,
  };
}

export function referencedMedia(data) {
  return new Set(
    [
      ...data.issues.flatMap((i) => [i.pdf, i.heroImage]),
      ...data.authors.map((a) => a.portrait),
      ...data.works.flatMap((w) => [
        w.image,
        ...w.artworks.map((a) => a.image),
        ...w.recordings.map((a) => a.file),
      ]),
    ].filter(Boolean),
  );
}

export function mediaPath(root, url) {
  if (!url.startsWith('/media/') || url.includes('..') || url.includes('\\'))
    throw new Error('Invalid media path');
  const resolved = path.resolve(root, url.slice(1));
  if (!resolved.startsWith(path.resolve(root, 'media') + path.sep))
    throw new Error('Media must stay in the media library');
  return resolved;
}
