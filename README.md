# aicsbench/web

The public website of [AICSbench](https://github.com/aicsbench/aicsbench), served at
<https://aicsbench.github.io/web/>.

It is a SvelteKit app built with `adapter-static`. Every content page is prerendered to plain
HTML from the site export that `aicsbench site export` writes, so the pages work without
JavaScript and show exactly the CLI's numbers. The site computes nothing. Submissions and the
published export live in [aicsbench/data](https://github.com/aicsbench/data) (its `export` branch).

## Preview locally

Requires the Node version in `.nvmrc` and the pnpm version in `package.json` (`corepack enable`).

```bash
pnpm install && pnpm dev
```

`pnpm dev` renders the fixture export in `tests/fixtures/export/`. To build another export, such as
a checkout of the data repository's `export` branch:

```bash
EXPORT_DIR=/path/to/export pnpm build && pnpm preview
```

The build validates every export file against the export's own `schema/*.schema.json` and stops
with the file and JSON path of the first problem. It refuses an `export_schema` other than 1.
`BASE_PATH=/web` builds for the GitHub Pages path.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm check        # svelte-check
pnpm lint         # Prettier and ESLint
pnpm test         # Vitest, including builds of edited exports
pnpm build
pnpm test:e2e     # Playwright against pnpm preview, with and without JavaScript
```

`src/lib/types/export.ts` is generated from the fixture's JSON Schemas with `pnpm gen:types`; CI
fails when it is stale. `tests/fixtures/export/` is a verbatim copy of
`tests/fixtures/site-export/` in aicsbench/aicsbench; replace it when that fixture changes.

## Deploy

`.github/workflows/deploy.yml` builds the data repository's `export` branch and deploys it to
GitHub Pages on a `data-published` repository dispatch, on push to `main`, and by hand. Pages must
use **GitHub Actions** as its source.

Results data is published under CC BY 4.0; the code is under the MIT licence in `LICENSE`.
