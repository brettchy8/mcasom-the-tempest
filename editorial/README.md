# The Tempest editorial workspace

This private repository holds issues, works, authors, and uploaded files. Open it in [Pages CMS](https://app.pagescms.org/qais8r/tempest-editorial/main) to edit using forms.

## Publish an issue

1. Open **Issues** and add the year and PDF. Upload a file such as `2027.pdf`. The first PDF page is used automatically as the cover at its original proportions. Add its image title and credit if needed.
2. Open **Authors** and add each contributor's name, biography, and optional portrait.
3. Open **Works**. Choose one issue and one author, enter the work, and add any artwork or MP3 recordings. Choose the Poetry category to preserve line breaks and indentation. Preview excerpts come from the written work automatically, and the first gallery artwork becomes the preview image. Works without artwork use the full card width for text. A PDF page number adds a link into the reader; count the cover as page 1.
4. Return to the issue and select its featured works in the order they should appear. Reader contents can link to PDF page numbers. The newest published year becomes the homepage issue automatically. Use **Site settings → Homepage issue override** only to feature an older issue; clear it to return to automatic selection.
5. Set the issue, its authors, and the works you want to show to **Ready to publish**. Leave unfinished records as **Draft**. Test entries are ordinary drafts. Delete them when testing is complete, or leave them as Draft to keep them off the published site.
6. Use **Build private preview** to build a private downloadable preview. The current GitHub Pages setup cannot host private drafts in the browser; ask the maintainer to open this artifact locally. A protected hosted preview is a future hosting option.
7. Click **Publish website**. Only ready content appears on the public site. Drafts and their unused files stay private. The result link appears in the action's run summary.

Saving an edit does not change the public website. Publish when the complete set of changes is ready. Authors can contribute to several issues. An issue can contain just a PDF with no companion works.

## About and occasional settings

Use **About** to edit the publication description and footer statement. Line breaks in the footer are preserved.

**Site settings** holds the school name, search-engine description, and optional homepage issue override. These rarely need changing.

Works normally follow their starting PDF page number. Works without a page follow in alphabetical title order. The optional **Reading order override** uses your number instead of the PDF page for sorting. The issue's featured-work selection has its own order.

## Files and corrections

PDFs, images, and audio live in GitHub. Keep individual files below 25 MiB. Upload PDFs named for their year. Image descriptions are required for gallery artwork. Recording titles are optional; the player uses Audio recording when no title is provided. Use the description for reader credits or other context.

Web addresses are generated automatically when you create a work or author. Editing a title or name later keeps the existing address and links. Entries with the same title or name receive distinct addresses automatically. To remove a published work, change it to Draft and publish again. Previously public material remains in the public site's Git history; do not publish confidential content as a test.

Every saved edit has Git history. The maintainer can restore earlier revisions. A publishing error leaves the last successful public build in place. Its action log explains missing authors, missing files, or invalid PDF page numbers.

## First connection and handoff

Sign in to Pages CMS with GitHub and install its GitHub App for **this repository only**. Select the `main` branch. Future editors can receive access through Pages CMS or be added as GitHub collaborators.

The maintainer sets repository variables `SOURCE_REPO`, `SOURCE_REF`, `PUBLIC_SITE_REPO`, `SITE_URL`, and `BASE_PATH`. A repository-specific write deploy key is stored as the `PAGES_DEPLOY_KEY` Actions secret. It can update the public site's files only. No personal GitHub token is stored.

The current destination is a separate review website. Moving to the official site requires the maintainer to change the destination and authorize a deploy key there. Code changes are reviewed in the public Astro repository.
