import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadContent, referencedMedia, mediaPath, workSchema } from '../scripts/content.mjs';
import { simplifyEditorial } from '../scripts/simplify-editorial.mjs';
import { isPoetry, workExcerpt } from '../scripts/text.mjs';

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'tempest-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const records = {
    site: {
      title: 'Test',
      school: 'School',
      description: '',
      currentIssue: '2026',
      tagline: '',
      about: '',
      editorialRepo: 'owner/editorial',
    },
    issues: [
      {
        year: '2026',
        title: '2026',
        status: 'published',
        pdf: '/media/pdfs/2026.pdf',
        featuredWorks: ['a-poem', 'secret-poem', 'sample-poem'],
      },
      { year: '2027', title: 'Secret issue', status: 'draft', pdf: '/media/pdfs/secret.pdf' },
    ],
    authors: [
      { slug: 'writer', name: 'Writer', status: 'published' },
      {
        slug: 'secret-writer',
        name: 'Private name',
        status: 'draft',
        portrait: '/media/images/secret.jpg',
      },
    ],
    works: [
      {
        slug: 'a-poem',
        title: 'A poem',
        issue: '2026',
        author: 'writer',
        category: 'Poetry',
        status: 'published',
        recordings: [{ file: '/media/audio/public.mp3', title: 'Reading' }],
      },
      {
        slug: 'secret-poem',
        title: 'Secret words',
        issue: '2026',
        author: 'secret-writer',
        category: 'Poetry',
        status: 'draft',
        artworks: [{ image: '/media/images/unpublished.jpg', alt: 'Private artwork' }],
      },
      {
        slug: 'sample-poem',
        title: 'Sample words',
        issue: '2026',
        author: 'writer',
        category: 'Poetry',
        status: 'draft',
        artworks: [{ image: '/media/images/sample.jpg', alt: 'Sample artwork' }],
      },
      {
        slug: 'next-issue',
        title: 'Next issue',
        issue: '2027',
        author: 'writer',
        category: 'Prose',
        status: 'published',
        artworks: [{ image: '/media/images/future.jpg', alt: 'Future artwork' }],
      },
    ],
    ...overrides,
  };
  await writeFile(path.join(root, 'site.json'), JSON.stringify(records.site));
  for (const name of ['issues', 'works', 'authors']) {
    await mkdir(path.join(root, name));
    for (const entry of records[name])
      await writeFile(
        path.join(root, name, `${entry.slug || entry.year}.json`),
        JSON.stringify(entry),
      );
  }
  return root;
}

test('production excludes all draft records, assets and homepage references', async (t) => {
  const data = await loadContent(await fixture(t));
  assert.deepEqual(
    data.issues.map((i) => i.year),
    ['2026'],
  );
  assert.deepEqual(
    data.works.map((w) => w.slug),
    ['a-poem'],
  );
  assert.deepEqual(
    data.authors.map((a) => a.slug),
    ['writer'],
  );
  assert.deepEqual(data.issues[0].featuredWorks, ['a-poem']);
  assert.deepEqual([...referencedMedia(data)].sort(), [
    '/media/audio/public.mp3',
    '/media/pdfs/2026.pdf',
  ]);
  assert.ok(!JSON.stringify(data).includes('Secret'));
});
test('private preview includes drafts for review', async (t) => {
  const data = await loadContent(await fixture(t), true);
  assert.equal(data.issues.length, 2);
  assert.equal(data.works.length, 4);
  assert.equal(data.authors.length, 2);
  assert.ok(referencedMedia(data).has('/media/images/secret.jpg'));
});
test('a published work cannot expose an unpublished author', async (t) => {
  const root = await fixture(t, {
    works: [
      {
        slug: 'a-poem',
        title: 'A poem',
        issue: '2026',
        author: 'secret-writer',
        category: 'Poetry',
        status: 'published',
      },
    ],
  });
  await assert.rejects(loadContent(root), /publish the author/);
});
test('broken author and issue relationships fail with an editorial error', async (t) => {
  const root = await fixture(t, {
    works: [
      { slug: 'a-poem', title: 'A poem', issue: '2026', author: 'missing', category: 'Poetry' },
    ],
  });
  await assert.rejects(loadContent(root), /author missing does not exist/);
});
test('draft current issue falls back to the latest published issue', async (t) => {
  const root = await fixture(t);
  const site = {
    title: 'Test',
    school: 'School',
    description: '',
    currentIssue: '2027',
    tagline: '',
    about: '',
    editorialRepo: 'owner/editorial',
  };
  await writeFile(path.join(root, 'site.json'), JSON.stringify(site));
  assert.equal((await loadContent(root)).site.currentIssue, '2026');
});
test('media paths cannot escape the content library', () => {
  for (const url of [
    '/media/../../.env',
    '/media/../private.json',
    '/etc/passwd',
    '/media/images\\secret',
  ])
    assert.throws(() => mediaPath('/content', url));
  assert.equal(mediaPath('/content', '/media/pdfs/2026.pdf'), '/content/media/pdfs/2026.pdf');
});
test('works preserve poetry spacing and support multiple artworks and recordings', () => {
  const body = 'First line\n  indented line\n\nLast stanza';
  const work = workSchema.parse({
    slug: 'a-poem',
    title: 'Poem',
    issue: '2026',
    author: 'writer',
    category: 'Poetry',
    body,
    artworks: [{ image: '/media/images/a.jpg', alt: 'Description' }],
    recordings: [
      { file: '/media/audio/a.mp3', title: 'First' },
      { file: '/media/audio/b.mp3', title: 'Second' },
    ],
  });
  assert.equal(work.body, body);
  assert.ok(isPoetry(work.category));
  assert.equal(work.recordings.length, 2);
  assert.equal(work.pdfPage, null);
});

test('previews derive from the written work and only current gallery assets are published', async (t) => {
  const data = await loadContent(
    await fixture(t, {
      issues: [
        {
          year: '2026',
          title: '2026',
          status: 'published',
          pdf: '/media/pdfs/2026.pdf',
          heroImage: '/media/images/old-cover.jpg',
        },
      ],
      works: [
        {
          slug: 'a-poem',
          title: 'A poem',
          issue: '2026',
          author: 'writer',
          category: 'Poetry',
          status: 'published',
          body: 'First line\n  indented line\n\nLast stanza',
          excerpt: 'Old manual excerpt',
          image: '/media/images/old-thumb.jpg',
          format: 'prose',
          artworks: [
            { image: '/media/images/first.jpg', alt: 'First artwork' },
            { image: '/media/images/second.jpg', alt: 'Second artwork' },
          ],
        },
      ],
    }),
  );
  assert.equal(data.works[0].excerpt, 'First line indented line Last stanza');
  assert.equal(data.works[0].artworks[0].image, '/media/images/first.jpg');
  assert.ok(isPoetry(data.works[0].category));
  assert.deepEqual([...referencedMedia(data)].sort(), [
    '/media/images/first.jpg',
    '/media/images/second.jpg',
    '/media/pdfs/2026.pdf',
  ]);
});

test('prose excerpts omit markup and hidden content while retaining readable punctuation', () => {
  const body =
    '# A **quiet** room\n\n[Listen](https://example.com) &amp; breathe.<br>Again.\n\n<script>hidden()</script>\n\n![Artwork](photo.jpg)';
  assert.equal(workExcerpt(body, 'Prose'), 'A quiet room Listen & breathe. Again.');
  assert.equal(
    workExcerpt('*A literal poem*\n  & a pause', 'Poetry'),
    '*A literal poem* & a pause',
  );
  assert.equal(workExcerpt('', 'Visual art'), '');
});

test('long excerpts truncate at words with three dots and leave short text intact', () => {
  assert.equal(
    workExcerpt('First morning light falls across the table.', 'Prose', 24),
    'First morning light...',
  );
  assert.equal(workExcerpt('A brief work.', 'Prose'), 'A brief work.');
  assert.equal(workExcerpt('🌊'.repeat(30), 'Poetry', 12), '🌊'.repeat(9) + '...');
});

test('saved filenames keep addresses and references stable after names change', async (t) => {
  const root = await fixture(t);
  const work = {
    title: 'A new title',
    issue: '2026',
    author: 'content/authors/writer.json',
    category: 'Poetry',
    status: 'published',
  };
  await writeFile(path.join(root, 'works/a-poem.json'), JSON.stringify(work));
  await writeFile(path.join(root, 'works/a-poem-1.json'), JSON.stringify(work));
  await writeFile(
    path.join(root, 'authors/writer.json'),
    JSON.stringify({ name: 'New display name', status: 'published' }),
  );
  const issue = {
    year: '2026',
    pdf: '/media/pdfs/2026.pdf',
    status: 'published',
    featuredWorks: ['content/works/a-poem-1.json', 'content/works/a-poem.json'],
  };
  await writeFile(path.join(root, 'issues/2026.json'), JSON.stringify(issue));
  const data = await loadContent(root);
  assert.deepEqual(
    data.works.map((w) => w.slug),
    ['a-poem', 'a-poem-1'],
  );
  assert.ok(data.works.every((w) => w.author === 'writer'));
  assert.equal(data.authors[0].name, 'New display name');
  assert.deepEqual(data.issues[0].featuredWorks, ['a-poem-1', 'a-poem']);
});

test('works sort by PDF page, then title, with optional position overrides', async (t) => {
  const base = { issue: '2026', author: 'writer', category: 'Prose', status: 'published' };
  const data = await loadContent(
    await fixture(t, {
      works: [
        { ...base, slug: 'z-web', title: 'Z web' },
        { ...base, slug: 'late', title: 'Late', pdfPage: 20, order: '' },
        { ...base, slug: 'early', title: 'Early', pdfPage: 2, order: null },
        { ...base, slug: 'a-web', title: 'A web', pdfPage: null },
        { ...base, slug: 'override', title: 'Override', pdfPage: 30, order: 1 },
      ],
    }),
  );
  assert.deepEqual(
    data.works.map((w) => w.slug),
    ['override', 'early', 'late', 'a-web', 'z-web'],
  );
});

test('recording labels default when omitted or cleared, and preserve custom credits', async (t) => {
  const data = await loadContent(
    await fixture(t, {
      works: [
        {
          slug: 'a-poem',
          title: 'A poem',
          issue: '2026',
          author: 'writer',
          category: 'Poetry',
          status: 'published',
          recordings: [
            { file: '/media/audio/a.mp3' },
            { file: '/media/audio/b.mp3', title: '  ' },
            { file: '/media/audio/c.mp3', title: null },
            { file: '/media/audio/d.mp3', title: 'Read by a guest' },
          ],
        },
      ],
    }),
  );
  assert.deepEqual(
    data.works[0].recordings.map((r) => r.title),
    ['Audio recording 1', 'Audio recording 2', 'Audio recording 3', 'Read by a guest'],
  );
});

test('latest published issue is automatic, with a clearable override and separate About file', async (t) => {
  const root = await fixture(t, {
    issues: [
      { year: '2025', status: 'published', pdf: '/media/pdfs/2025.pdf' },
      { year: '2026', status: 'published', pdf: '/media/pdfs/2026.pdf' },
      { year: '2027', status: 'draft', pdf: '/media/pdfs/2027.pdf' },
    ],
  });
  const site = { school: 'School', description: '', editorialRepo: 'owner/editorial' };
  await writeFile(
    path.join(root, 'about.json'),
    JSON.stringify({ about: 'About text', tagline: 'Center\nfor Humanities' }),
  );
  for (const value of [undefined, null, '', '2025', '2027']) {
    await writeFile(path.join(root, 'site.json'), JSON.stringify({ ...site, currentIssue: value }));
    const data = await loadContent(root);
    assert.equal(data.site.currentIssue, value === '2025' ? '2025' : '2026');
    assert.equal(data.site.tagline, 'Center\nfor Humanities');
    assert.equal(data.site.about, 'About text');
  }
});

test('migration removes retired fields, retains sample drafts, and preserves links on repeat runs', async (t) => {
  const root = await fixture(t);
  const file = path.join(root, 'works/sample-poem.json');
  const sample = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...sample, demo: true, status: 'published' }));
  await simplifyEditorial(root);
  const once = await readFile(file, 'utf8');
  const entry = JSON.parse(once);
  assert.equal(entry.status, 'draft');
  assert.equal(entry.demo, undefined);
  assert.equal(entry.slug, undefined);
  assert.equal(entry.author, 'content/authors/writer.json');
  assert.equal(JSON.parse(await readFile(path.join(root, 'site.json'), 'utf8')).currentIssue, null);
  assert.equal((await loadContent(root)).works.length, 1);
  assert.equal((await loadContent(root, true)).works.length, 4);
  await simplifyEditorial(root);
  assert.equal(await readFile(file, 'utf8'), once);
});
