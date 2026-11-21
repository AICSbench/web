# Compare fixture

This is an `aicsbench site export` used by the unit, build and Playwright tests
and by `tests/contract/compare_contract.py`. It starts from the core
repository's `tests/fixtures/site-data` fixture and adds the cases the compare
page needs:

- `task-management-api` has two acceptance suites (`bdb9517a…` and `ffffffff…`)
  for version 2, so a comparison refuses until a suite filter selects one.
- `url-shortener-api` has two harness + model packages on `fastapi-latest` and
  Codex on `laravel`, for harness and stack refusals.
- `auth-api` has Codex and OpenCode on one model key and one provider, for a
  valid harness comparison.
- `notes-api` has direct, `openrouter` gateway and legacy-provider trials for
  provider display, the provider filter and the provider refusals.
- `misc-api` has passed trials without agent time, so a mean stays unavailable.

The export was produced by `aicsbench site export` from AICSbench core
`3a234a9` (the exporter owns the rows, page paths and schemas). Do not hand-edit
`data/trials.json`, `data/meta.json`, `pages.json` or `schema/`; regenerate the
export instead so the site keeps testing the real contract.
