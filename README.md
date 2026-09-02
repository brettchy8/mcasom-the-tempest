# The Tempest

The annual creative arts publication of Mayo Clinic Alix School of Medicine. This Astro redesign puts the current issue first, with companion works, author profiles, and an archive. The PDF reader displays the original pages in a desktop flipbook and a continuous mobile view.

## Development

Use Node 24 LTS.

```sh
npm ci
npm run dev
```

Open `http://localhost:4321`. Development includes clearly marked sample works so the full design can be reviewed. Their text and names are placeholders; they are not extracted from the magazine. The sample recording comes from the previous demo site and is labeled accordingly.

```sh
npm test                  # Publication rules and content relationships
npm run build             # Published content only; excludes samples and drafts
npm run check             # Astro and TypeScript diagnostics
npm run build:preview     # Includes samples and drafts; keep private for real content
npm run preview           # Serve the most recent build locally
```

The prepare script validates JSON, copies only media referenced by included records, generates PDF covers, and checks reader page numbers. Run it again or restart the dev server after editing content. Cover images are cached by PDF hash. Generated files are ignored by Git.

## Editing and publishing

Use the separate [private editorial workspace](https://github.com/qais8r/tempest-editorial). Its [Pages CMS dashboard](https://app.pagescms.org/qais8r/tempest-editorial/main) provides forms for Issues, Works, Authors, and Site settings. See [the editor guide](editorial/README.md) and [setup notes](docs/editorial-workspace.md).

Saving a CMS record commits it privately. **Preview website** builds a private downloadable artifact. **Publish website** builds only records marked Ready to publish and pushes static files to a separate public GitHub Pages repository through a repository-specific deploy key. GitHub Pages preview URLs are public; unpublished material must not be deployed there. A protected browser preview can be added later with another host.

The `content/` folder here is a public development fixture. It includes the supplied 2018, 2019, 2020, 2021, 2022, 2023, and 2026 PDFs. It is not the live editorial database. All future drafts and uploads belong in the private workspace. To build against it locally:

```sh
CONTENT_DIR=/absolute/path/to/tempest-editorial/content npm run dev
```

## Content model

| Record | Fields                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Issue  | Year, title, introduction, PDF, cover title and credit, ordered featured works, PDF contents links                              |
| Work   | Title, permanent slug, one author, one issue, category, reading order, text, artwork gallery, MP3 recordings, optional PDF page |
| Author | Name, permanent slug, biography, optional portrait                                                                              |
| Site   | Publication name, school, current issue, description, About copy, footer statement                                              |

Every issue, work, and author has Draft/Ready status and a sample flag. Sample content is always excluded from production. A ready work requires a ready author and a published issue. The first PDF page supplies the cover and its proportions. Work excerpts are generated from the opening text, up to 120 characters with `...` for longer text. The first gallery image supplies the thumbnail; works without artwork use a gradient. The Poetry category preserves line breaks and indentation; prose and biographies support sanitized Markdown. Missing portraits use initials. Past PDFs can be published without entering individual works.

## Hosting

Static output is in `dist/`. No application server or database is required. Set `SITE_URL` to the origin and `BASE_PATH` to the repository path for GitHub Pages, for example:

```sh
SITE_URL=https://qais8r.github.io BASE_PATH=/tempest-preview npm run build
```

The current official site still uses the `main` branch with legacy GitHub Pages. Do not merge and assume Jekyll will build Astro. Before the official cutover, choose a Pages deployment branch or Actions deployment, update the editorial destination, then change the official Pages settings. The review site is separate.

PDFs, images, and MP3s are committed directly to GitHub. A 25 MiB per-file build limit keeps the workflow compatible with browser uploads and a possible later Cloudflare Pages move. Larger future files need optimization or a separate media store. The original `/issues/2026/tempest-2026.pdf` path remains available, and the old flipbook and demo-work URLs redirect.

## Implementation

Astro generates the pages. PDF.js renders and supplies selectable text for the PDF reader; StPageFlip handles desktop page turns. The reader loads nearby pages, releases distant canvases, supports keyboard navigation, contents links, zoom, downloads, and reduced motion. It switches to scrolling below 760px. Typography is self-hosted Cormorant Garamond and Manrope.

`editorial/` contains the private workspace's CMS configuration and workflow templates. Run `node scripts/make-cms-config.mjs` after changing its field generator, then copy the updated configuration into the private workspace. Code changes should go through a pull request. Publication errors stop before deployment and preserve the last successful site.
