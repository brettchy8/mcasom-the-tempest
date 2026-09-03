# Editorial workspace setup

Edit real content in `qais8r/tempest-editorial`, a private repository. The public Astro repository contains development fixtures only.

## Connect the editor

Open https://app.pagescms.org, sign in with GitHub, and grant the Pages CMS GitHub App access to the private editorial repository. Select its `main` branch. The checked-in `.pages.yml` defines the complete editing UI, media folders, relationships, and Build private preview/Publish website actions. Pages CMS must have Actions write permission for its action buttons.

The setup can be transferred to a school-owned GitHub account later. Transfer repository ownership, update `editorialRepo` in Site settings, and update the variables and deploy key below.

## GitHub Pages destination

The review destination is `qais8r/tempest-preview`, with GitHub Pages serving its `gh-pages` branch. The official maintainer's existing site remains unchanged.

Private editorial repository Actions variables:

| Variable           | Review value                                 |
| ------------------ | -------------------------------------------- |
| `SOURCE_REPO`      | `brettchy8/mcasom-the-tempest`               |
| `SOURCE_REF`       | The reviewed source commit or feature branch |
| `PUBLIC_SITE_REPO` | `qais8r/tempest-preview`                     |
| `SITE_URL`         | `https://qais8r.github.io`                   |
| `BASE_PATH`        | `/tempest-preview`                           |

`PAGES_DEPLOY_KEY` is an SSH private key stored as an encrypted Actions secret. Its public key is registered as a write deploy key on the destination repository only. Do not use a broad personal access token. The workflow checks out private content, builds published records, and copies only `dist/` into the public `gh-pages` branch.

The Build private preview action uploads an artifact inside this private repository. It never writes drafts to GitHub Pages. Download and extract it, then serve the folder with a local static server to review drafts. This currently requires a maintainer. A future Cloudflare Pages + Access setup can replace that artifact with a protected browser URL while keeping the same editor.

## Official cutover

After design and content approval, create a destination deploy key for the official repository, update these variables and `BASE_PATH`, initialize its `gh-pages` branch, and select that branch in GitHub Pages settings. Run Publish website. If using a custom domain, add it in GitHub Pages and maintain the `CNAME` file as part of the build. Test old issue URLs and PDF downloads before retiring the former site.

A code PR alone does not switch hosting. Keep `SOURCE_REF` pinned to the reviewed commit until an intentional code upgrade. Saving or uploading content does not deploy; publication remains an explicit action.

## Upgrading existing editorial content

For the simplified CMS forms, run `node scripts/simplify-editorial.mjs /path/to/editorial/content` before upgrading `SOURCE_REF`. The migration keeps filenames and URLs, converts existing samples to drafts, removes unused titles and stored slugs, converts author/featured-work references to repository paths, and separates `about.json` from `site.json`. It clears the current-issue selection only when it already matches the latest published year. Existing deliberate reading-order values are preserved; old default zeroes are cleared. The migration can be run again without changing the result.

Regenerate `.pages.yml` with `node scripts/make-cms-config.mjs`, copy `editorial/.pages.yml` and `editorial/README.md` into the private repository, and commit the content migration with the configuration. Keep draft builds out of the public Pages branch. Removing the Sample content field does not add a second publication rule; Draft/Ready is the sole editorial status.

The automatic naming and reference configuration follows [Pages CMS filename templates](https://pagescms.org/docs/configuration/content/filename/) and [reference fields](https://pagescms.org/docs/configuration/fields/reference/).
