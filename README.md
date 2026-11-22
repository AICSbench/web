# aicsbench/web

The public website of [AICSbench](https://github.com/aicsbench/aicsbench), served at
<https://aicsbench.github.io/web/>.

It is a SvelteKit app built with `adapter-static`. Every content page is prerendered to plain
HTML from the site export that `aicsbench site export` writes, so the pages work without
JavaScript and show exactly the CLI's numbers. The site computes nothing. Submissions and the
published export live in [aicsbench/data](https://github.com/aicsbench/data) (its `export` branch).

## Preview locally

Requires the Node version in `.nvmrc` and the pnpm version pinned in `package.json`
(`packageManager`). Node 25 and later no longer ship Corepack, so install that pnpm version
directly:

```bash
npm install --global pnpm@12.0.0
```

```bash
pnpm install && pnpm dev
```

`pnpm dev` renders the fixture export in `tests/fixtures/export/`. To build another export, such as
a checkout of the data repository's `export` branch:

```bash
EXPORT_DIR=/path/to/export pnpm build && pnpm preview
```

The build validates the schema-backed export files (`export.json`, `data/trials.json`,
`data/meta.json` and `pages.json`) against the export's own `schema/*.schema.json` and stops
with the file and JSON path of the first problem. It refuses an `export_schema` other than 1.
`BASE_PATH=/web` builds for the GitHub Pages path.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm check        # svelte-check
pnpm lint         # Prettier and ESLint
pnpm test         # Vitest, including builds of edited exports
pnpm build
pnpm exec playwright install --with-deps chromium   # once per machine
pnpm test:e2e     # Playwright against pnpm preview, with and without JavaScript
```

`src/lib/types/export.ts` is generated from the fixture's JSON Schemas with `pnpm gen:types`; CI
fails when it is stale. `tests/fixtures/export/` is a verbatim copy of
`tests/fixtures/site-export/` in aicsbench/aicsbench; replace it when that fixture changes.

## Deploy

`.github/workflows/deploy.yml` builds the data repository's `export` branch and deploys it to
GitHub Pages on a `data-published` repository dispatch, on push to `main`, and by hand. Pages must
use **GitHub Actions** as its source.

### Pull request previews

`PR preview` builds the exact base and head commits against the same published export. It
compares full-page Chromium screenshots at desktop and mobile sizes and keeps only changed,
added, or removed pages. Download the build and the `pr-preview-report/index.html` gallery
from the workflow summary. This comparison covers the default view of each prerendered route,
not every interaction or filter combination.

For live previews, create a separate Cloudflare Pages **Direct Upload** project with `main`
as its production branch. Set the GitHub Actions variable `CLOUDFLARE_PREVIEW_PROJECT` to its
name, and add the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets (token permission:
**Account → Cloudflare Pages → Edit**). Same-repository PRs deploy to branch `pr-<number>`;
a single PR comment links the exact deployment and gallery and embeds up to 12 before/after
pairs. Without Cloudflare configuration the comment links the Actions artifact instead. Fork
PRs produce an Actions artifact only. Production GitHub Pages is unchanged.

Results data is published under CC BY 4.0; the code is under the MIT licence in `LICENSE`.
