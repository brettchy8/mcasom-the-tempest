import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Run once for each editorial checkout when upgrading to the simplified forms.
// Filenames remain unchanged to preserve published URLs and references.
export async function simplifyEditorial(root) {
  const read = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const write = async (file, data) => {
    const target = path.join(root, file);
    const next = JSON.stringify(data, null, 2) + '\n';
    const previous = await readFile(target, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (previous !== next) await writeFile(target, next);
  };
  const reference = (collection, value) =>
    value.startsWith(`content/${collection}/`) ? value : `content/${collection}/${value}.json`;
  const publishedYears = [];
  for (const collection of ['issues', 'authors', 'works']) {
    for (const filename of (await readdir(path.join(root, collection))).filter((f) =>
      f.endsWith('.json'),
    )) {
      const file = `${collection}/${filename}`;
      const entry = await read(file);
      if (entry.demo) entry.status = 'draft';
      delete entry.demo;
      if (collection === 'issues') {
        delete entry.title;
        entry.featuredWorks = (entry.featuredWorks || []).map((id) => reference('works', id));
        if (entry.status === 'published') publishedYears.push(entry.year);
      } else {
        delete entry.slug;
        if (collection === 'works') {
          entry.author = reference('authors', entry.author);
          // The former zero was a default, not an intentional override.
          if (entry.order === 0) delete entry.order;
        }
      }
      await write(file, entry);
    }
  }
  const site = await read('site.json');
  const about = await read('about.json').catch((error) => {
    if (error.code === 'ENOENT') return { about: site.about, tagline: site.tagline };
    throw error;
  });
  delete site.title;
  delete site.about;
  delete site.tagline;
  if (!site.currentIssue || site.currentIssue === publishedYears.sort().at(-1))
    site.currentIssue = null;
  await write('about.json', about);
  await write('site.json', site);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2])
    throw new Error('Usage: node scripts/simplify-editorial.mjs CONTENT_DIRECTORY');
  await simplifyEditorial(path.resolve(process.argv[2]));
}
