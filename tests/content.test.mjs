import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadContent, referencedMedia, mediaPath, workSchema } from '../scripts/content.mjs';

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
        image: '/media/images/unpublished.jpg',
      },
      {
        slug: 'sample-poem',
        title: 'Sample words',
        issue: '2026',
        author: 'writer',
        category: 'Poetry',
        status: 'published',
        demo: true,
        image: '/media/images/sample.jpg',
      },
      {
        slug: 'next-issue',
        title: 'Next issue',
        issue: '2027',
        author: 'writer',
        category: 'Prose',
        status: 'published',
        image: '/media/images/future.jpg',
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

test('production excludes draft and sample records, assets and homepage references', async (t) => {
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
test('private preview includes drafts and sample content', async (t) => {
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
    format: 'poetry',
    artworks: [{ image: '/media/images/a.jpg', alt: 'Description' }],
    recordings: [
      { file: '/media/audio/a.mp3', title: 'First' },
      { file: '/media/audio/b.mp3', title: 'Second' },
    ],
  });
  assert.equal(work.body, body);
  assert.equal(work.recordings.length, 2);
  assert.equal(work.pdfPage, null);
});
