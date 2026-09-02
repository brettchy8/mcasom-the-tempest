import { writeFile } from 'node:fs/promises';
import YAML from 'yaml';
const f = (name, label, type = 'string', more = {}) => ({ name, label, type, ...more });
const ref = (name, label, collection, value, display, multiple = false) =>
  f(name, label, 'reference', {
    options: {
      collection,
      value: `{fields.${value}}`,
      label: `{fields.${display}}`,
      search: display,
      multiple,
    },
  });
const status = f('status', 'Publication status', 'select', {
  description: 'Draft stays private. Ready content goes live only when you click Publish website.',
  default: 'draft',
  options: {
    values: [
      { name: 'draft', label: 'Draft' },
      { name: 'published', label: 'Ready to publish' },
    ],
  },
});
const demo = f('demo', 'Sample content', 'boolean', {
  default: false,
  description: 'Sample content appears in previews only, even when marked ready.',
});
const image = (name, label) => f(name, label, 'image', { options: { media: 'images' } });
const slug = f('slug', 'Web address', 'string', {
  required: true,
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  description:
    'A short permanent address, such as anatomy-of-quiet. Use lowercase letters and hyphens.',
});
const collection = (name, label, primary, fields) => ({
  name,
  label,
  type: 'collection',
  path: `content/${name}`,
  format: 'json',
  filename: `{fields.${name === 'issues' ? 'year' : 'slug'}}.json`,
  view: { primary, fields: [primary, 'status'], sort: primary },
  fields,
  operations: { rename: false },
});
const fieldsIssue = [
  f('year', 'Year', 'string', { required: true, pattern: '^\\d{4}$' }),
  f('title', 'Title', 'string', { required: true }),
  status,
  demo,
  f('description', 'Introduction', 'text'),
  f('pdf', 'Issue PDF', 'file', {
    required: true,
    description:
      'Upload single pages, named by year, such as 2026.pdf. Maximum 25 MiB. The first page automatically becomes the cover image.',
    options: { media: 'pdfs', extensions: ['pdf'], rename: false },
  }),
  f('heroCredit', 'Image title and credit', 'string'),
  ref('featuredWorks', 'Featured works, in homepage order', 'works', 'slug', 'title', true),
  f('sections', 'Reader contents', 'object', {
    list: true,
    fields: [
      f('title', 'Section title'),
      f('page', 'PDF page number', 'number', { options: { min: 1 } }),
    ],
    description: 'Use the PDF page number, counting the cover as page 1.',
  }),
];
const fieldsAuthor = [
  slug,
  f('name', 'Name', 'string', { required: true }),
  status,
  demo,
  image('portrait', 'Portrait'),
  f('bio', 'About the author', 'rich-text', { options: { format: 'markdown', media: false } }),
];
const fieldsWork = [
  slug,
  f('title', 'Title', 'string', { required: true }),
  status,
  demo,
  { ...ref('issue', 'Issue', 'issues', 'year', 'year'), required: true },
  { ...ref('author', 'Author', 'authors', 'slug', 'name'), required: true },
  f('category', 'Category', 'select', {
    required: true,
    options: { values: ['Poetry', 'Prose', 'Photography', 'Visual art', 'Other'] },
  }),
  f('order', 'Reading order', 'number', { default: 0 }),
  f('body', 'The written work', 'text', {
    description:
      'The opening text becomes the preview excerpt automatically. Choose Poetry to preserve line breaks and indentation. For other categories, separate paragraphs with a blank line; Markdown emphasis is supported.',
  }),
  f('artworks', 'Artwork gallery', 'object', {
    list: true,
    description:
      'The first artwork is used in previews. Without artwork, a soft gradient appears instead.',
    fields: [
      image('image', 'Artwork'),
      f('alt', 'Image description', 'string', { required: true }),
      f('caption', 'Caption and credit', 'text'),
    ],
  }),
  f('recordings', 'Audio recordings', 'object', {
    list: true,
    fields: [
      f('title', 'Recording title', 'string', { required: true }),
      f('file', 'MP3 file', 'file', {
        required: true,
        options: { media: 'audio', extensions: ['mp3'] },
      }),
      f('description', 'Recording description or credit', 'text'),
    ],
  }),
  f('pdfPage', 'Starting PDF page (optional)', 'number', {
    options: { min: 1 },
    description: 'Count the cover as page 1. Leave empty for web-only companion works.',
  }),
  f('about', 'About the work', 'rich-text', { options: { format: 'markdown', media: false } }),
];
const config = {
  media: [
    {
      name: 'pdfs',
      label: 'Issue PDFs',
      input: 'content/media/pdfs',
      output: '/media/pdfs',
      extensions: ['pdf'],
      rename: false,
    },
    {
      name: 'images',
      label: 'Artwork & portraits',
      input: 'content/media/images',
      output: '/media/images',
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      rename: 'safe',
    },
    {
      name: 'audio',
      label: 'Audio recordings',
      input: 'content/media/audio',
      output: '/media/audio',
      extensions: ['mp3'],
      rename: 'safe',
    },
  ],
  content: [
    collection('issues', 'Issues', 'year', fieldsIssue),
    collection('works', 'Works', 'title', fieldsWork),
    collection('authors', 'Authors', 'name', fieldsAuthor),
    {
      name: 'site',
      label: 'Site settings & About',
      type: 'file',
      path: 'content/site.json',
      format: 'json',
      fields: [
        f('title', 'Publication name'),
        f('school', 'School name'),
        f('description', 'Site description', 'text'),
        ref('currentIssue', 'Current issue', 'issues', 'year', 'year'),
        f('tagline', 'Footer statement', 'text'),
        f('about', 'About the publication', 'rich-text', {
          options: { format: 'markdown', media: false },
        }),
        f('editorialRepo', 'Editorial repository', 'string', { hidden: true }),
      ],
    },
  ],
  actions: [
    { name: 'preview', label: 'Preview website', workflow: 'preview.yml', confirm: false },
    {
      name: 'publish',
      label: 'Publish website',
      workflow: 'publish.yml',
      confirm: {
        title: 'Publish the approved website?',
        message:
          'This publishes all content marked Ready to publish. Drafts and sample content stay private.',
        button: 'Publish website',
      },
    },
  ],
};
await writeFile('editorial/.pages.yml', YAML.stringify(config));
// The source repository contains public demonstration content. All real editing belongs in the private editorial repo.
await writeFile(
  '.pages.yml',
  YAML.stringify({
    content: [
      {
        name: 'readme',
        label: 'Editorial workspace instructions',
        type: 'file',
        path: 'docs/editorial-workspace.md',
        format: 'raw',
        fields: [f('body', 'Instructions', 'text', { readonly: true })],
      },
    ],
  }),
);
