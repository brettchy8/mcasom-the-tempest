import { writeFile } from 'node:fs/promises';
import YAML from 'yaml';
const f = (name, label, type = 'string', more = {}) => ({ name, label, type, ...more });
const ref = (name, label, collection, value, display, multiple = false) =>
  f(name, label, 'reference', {
    options: {
      collection,
      value: value === 'path' ? '{path}' : `{fields.${value}}`,
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
const image = (name, label) => f(name, label, 'image', { options: { media: 'images' } });
const collection = (name, label, primary, fields) => ({
  name,
  label,
  type: 'collection',
  path: `content/${name}`,
  format: 'json',
  filename: { template: '{primary}.json', field: false },
  subfolders: false,
  view: { primary, fields: [primary, 'status'], sort: primary },
  fields,
  operations: { rename: false },
});
const fieldsIssue = [
  f('year', 'Year', 'string', { required: true, pattern: '^\\d{4}$' }),
  status,
  f('description', 'Introduction', 'text'),
  f('pdf', 'Issue PDF', 'file', {
    required: true,
    description:
      'Upload single pages, named by year, such as 2026.pdf. Maximum 25 MiB. The first page automatically becomes the cover image.',
    options: { media: 'pdfs', extensions: ['pdf'], rename: false },
  }),
  f('heroCredit', 'Image title and credit', 'string'),
  ref('featuredWorks', 'Featured works, in homepage order', 'works', 'path', 'title', true),
  f('sections', 'Reader contents', 'object', {
    list: true,
    fields: [
      f('title', 'Section title', 'string', { required: true }),
      f('page', 'PDF page number', 'number', { required: true, options: { min: 1 } }),
    ],
    description: 'Use the PDF page number, counting the cover as page 1.',
  }),
];
const fieldsAuthor = [
  f('name', 'Name', 'string', { required: true }),
  status,
  image('portrait', 'Portrait'),
  f('bio', 'About the author', 'rich-text', { options: { format: 'markdown', media: false } }),
];
const fieldsWork = [
  f('title', 'Title', 'string', { required: true }),
  status,
  { ...ref('issue', 'Issue', 'issues', 'year', 'year'), required: true },
  { ...ref('author', 'Author', 'authors', 'path', 'name'), required: true },
  f('category', 'Category', 'select', {
    required: true,
    options: { values: ['Poetry', 'Prose', 'Photography', 'Visual art', 'Other'] },
  }),
  f('body', 'The written work', 'text', {
    description:
      'The opening text becomes the preview excerpt automatically. Choose Poetry to preserve line breaks and indentation. For other categories, separate paragraphs with a blank line; Markdown emphasis is supported.',
  }),
  f('artworks', 'Artwork gallery', 'object', {
    list: true,
    description:
      'The first artwork is used in previews. Without artwork, the text fills the preview card.',
    fields: [
      { ...image('image', 'Artwork'), required: true },
      f('alt', 'Image description', 'string', { required: true }),
      f('caption', 'Caption and credit', 'text'),
    ],
  }),
  f('recordings', 'Audio recordings', 'object', {
    list: true,
    fields: [
      f('title', 'Recording title override', 'string', {
        description: 'Optional. Leave empty to use Audio recording.',
      }),
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
  f('order', 'Reading order override', 'number', {
    options: { min: 0 },
    description:
      'Optional. Normally works follow PDF page order, then title for works without a page. Enter a number to use instead of the PDF page when sorting. Homepage selections have their own order.',
  }),
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
      name: 'about',
      label: 'About',
      type: 'file',
      path: 'content/about.json',
      format: 'json',
      fields: [
        f('about', 'About the publication', 'rich-text', {
          options: { format: 'markdown', media: false },
        }),
        f('tagline', 'Footer statement', 'text', {
          description: 'Line breaks are preserved in the footer.',
        }),
      ],
    },
    {
      name: 'site',
      label: 'Site settings',
      type: 'file',
      path: 'content/site.json',
      format: 'json',
      fields: [
        f('school', 'School name'),
        f('description', 'Site description', 'text'),
        {
          ...ref('currentIssue', 'Homepage issue override', 'issues', 'year', 'year'),
          description: 'Optional. Leave empty to show the newest published issue automatically.',
        },
        f('editorialRepo', 'Editorial repository', 'string', { hidden: true }),
      ],
    },
  ],
  actions: [
    { name: 'preview', label: 'Build private preview', workflow: 'preview.yml', confirm: false },
    {
      name: 'publish',
      label: 'Publish website',
      workflow: 'publish.yml',
      confirm: {
        title: 'Publish the approved website?',
        message: 'This publishes all content marked Ready to publish. Drafts stay private.',
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
