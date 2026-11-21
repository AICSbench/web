// Maps the export's pages to SvelteKit routes. Paths come from pages.json
// unchanged: entries() splits each path into the route's parameters, and the
// load finds the page whose path splits into the same parameters. No path or
// slug is ever built here, so any spelling the export uses survives.
import { loadExport, pageAt, ExportError } from '../load-export.ts';
import type { Page, TrialRow } from '../types/export.ts';

/** The route that renders each page kind. */
export const ROUTES = {
	home: '/',
	leaderboard: '/leaderboard',
	compare: '/compare',
	methodology: '/methodology',
	task: '/tasks/[task]',
	harness: '/tasks/[task]/harnesses/[harness]',
	model: '/tasks/[task]/models/[model]',
	stack: '/tasks/[task]/stacks/[stack]',
	run: '/runs/[run_id]'
} as const satisfies Record<Page['kind'], string>;

type Kind = keyof typeof ROUTES;

function segments(routeId: string): string[] {
	return routeId.split('/').filter(Boolean);
}

/** The route parameters `page.path` gives for `kind`'s route, or null when it does not fit. */
function paramsOf(kind: Kind, page: Page): Record<string, string> | null {
	const pattern = segments(ROUTES[kind]);
	const parts = segments(page.path);
	if (parts.length !== pattern.length) return null;
	const params: Record<string, string> = {};
	for (const [index, segment] of pattern.entries()) {
		const name = /^\[(\w+)\]$/.exec(segment)?.[1];
		if (name) params[name] = decodeURIComponent(parts[index]);
		else if (segment !== parts[index]) return null;
	}
	return params;
}

/** Route parameters for every page of `kind`, taken from the page paths. */
export function entriesFor(kind: Kind): Record<string, string>[] {
	return loadExport()
		.pages.filter((page) => page.kind === kind)
		.map((page) => {
			const params = paramsOf(kind, page);
			if (!params) {
				throw new ExportError(
					`pages.json: ${kind} page ${page.path} does not fit route ${ROUTES[kind]}`
				);
			}
			return params;
		});
}

/** Absolute URL of an export path ("/tasks/x/") under the export's base_url. */
export function absolute(path: string): string {
	const base = loadExport().info.base_url;
	return (base.endsWith('/') ? base : `${base}/`) + path.replace(/^\//, '');
}

const LICENSE = 'https://creativecommons.org/licenses/by/4.0/';

/** schema.org JSON-LD: WebSite on /, Dataset on result pages, WebPage elsewhere. */
function jsonLd(page: Page): object {
	const site = loadExport();
	const url = absolute(page.path);
	const base = {
		'@context': 'https://schema.org',
		name: page.title,
		description: page.description,
		url
	};
	if (page.kind === 'home') return { ...base, '@type': 'WebSite' };
	if (page.kind === 'compare' || page.kind === 'methodology')
		return { ...base, '@type': 'WebPage' };
	return {
		...base,
		'@type': 'Dataset',
		license: LICENSE,
		isAccessibleForFree: true,
		creator: { '@type': 'Organization', name: 'AICSbench', url: absolute('/') },
		dateModified: site.info.built_at,
		distribution: [
			{
				'@type': 'DataDownload',
				encodingFormat: 'application/json',
				contentUrl: absolute('/data/trials.json')
			}
		]
	};
}

/** Python's model_key: lower case, with only OpenCode's provider prefix removed. */
function modelKey(row: TrialRow): string {
	const label = row.model.toLowerCase();
	if (row.harness === 'opencode') {
		const slash = label.indexOf('/');
		if (slash > 0 && slash < label.length - 1) return label.slice(slash + 1);
	}
	return label;
}

/** The value a section's `by` dimension gives a trial (comparison.dimension_value). */
function dimensionValue(row: TrialRow, by: string): string {
	switch (by) {
		case 'harness':
			return row.harness;
		case 'harness_version':
			return `${row.harness} ${row.harness_version ?? 'unknown'}`;
		case 'model':
			return row.model;
		case 'harness_model':
			return `${row.harness} + ${row.model}`;
		case 'stack':
			return row.stack;
		case 'language':
			return row.language;
		case 'framework':
			return row.framework;
		case 'provider':
			return row.provider ?? 'unknown';
		case 'task':
			return row.task;
		default:
			return '';
	}
}

/** True when a trial belongs to a section's fixed values and verified pool. */
function inSection(row: TrialRow, page: Page, section: Page['sections'][number]): boolean {
	if (row.verified !== section.verified_only) return false;
	const fixed: Record<string, string | undefined> = { ...page.params, ...section.fixed };
	if (fixed.task !== undefined && row.task !== fixed.task) return false;
	if (fixed.task_version !== undefined && row.task_version !== fixed.task_version) return false;
	if (fixed.tooling_mode !== undefined && row.tooling_mode !== fixed.tooling_mode) return false;
	if (fixed.auth_mode !== undefined && row.auth_mode !== fixed.auth_mode) return false;
	if (fixed.max_repairs !== undefined && row.max_repairs !== Number(fixed.max_repairs)) {
		return false;
	}
	if (fixed.max_parallel !== undefined && row.max_parallel !== Number(fixed.max_parallel)) {
		return false;
	}
	if (fixed.suite_sha256 !== undefined && row.suite_sha256 !== fixed.suite_sha256) return false;
	if (fixed.stack !== undefined && row.stack !== fixed.stack) return false;
	if (fixed.harness !== undefined && row.harness !== fixed.harness) return false;
	if (fixed.model !== undefined && modelKey(row) !== fixed.model) return false;
	if (page.params.run_id !== undefined && row.run_id !== page.params.run_id) return false;
	return true;
}

/**
 * The provider to show next to each row of a section. Rows that are a harness
 * or a harness + model package hold one provider; model and stack rows may
 * pool several, so they get no badge. Legacy trials have no provider and show
 * as "unknown" (the component labels it "provider not recorded").
 */
function sectionProviders(
	page: Page,
	section: Page['sections'][number],
	trials: TrialRow[]
): Record<string, string> {
	if (!['harness', 'harness_version', 'harness_model'].includes(section.by)) return {};
	const providers = new Map<string, Set<string>>();
	for (const row of trials) {
		if (!inSection(row, page, section)) continue;
		const value = dimensionValue(row, section.by);
		const seen = providers.get(value) ?? new Set<string>();
		seen.add(row.provider ?? 'unknown');
		providers.set(value, seen);
	}
	return Object.fromEntries(
		[...providers].flatMap(([value, seen]) => (seen.size === 1 ? [[value, [...seen][0]]] : []))
	);
}

/** Everything a page template needs: the page, its SEO fields, and per-kind extras. */
export function pageData(kind: Kind, params: Record<string, string> = {}) {
	const site = loadExport();
	const page = pageFor(kind, params);
	const runPages = site.pages.filter((candidate) => candidate.kind === 'run');
	const runOf = (runId: string) => site.trials.find((trial) => trial.run_id === runId);
	return {
		page,
		canonical: absolute(page.path),
		jsonLd: jsonLd(page),
		// A provider badge for harness and harness + model rows, where one row holds one provider.
		providers: page.sections.map((section) => sectionProviders(page, section, site.trials)),
		// The task's versions from data/meta.json (every page under /tasks/<task>/ has params.task).
		versions: site.meta.tasks.filter((task) => task.id === page.params.task),
		// Home: the newest submissions first, as listed by the export's run pages.
		latestRuns:
			kind === 'home'
				? runPages
						.map((run) => ({ run, first: runOf(run.params.run_id ?? '') }))
						.filter((entry) => entry.first !== undefined)
						// submitted_at may carry any UTC offset, so compare instants, not strings.
						.sort(
							(a, b) =>
								Date.parse(b.first?.submitted_at ?? '') - Date.parse(a.first?.submitted_at ?? '')
						)
						.slice(0, 10)
						.map(({ run, first }) => ({
							path: run.path,
							title: run.title,
							task: first?.task ?? '',
							task_version: first?.task_version ?? '',
							submitted_at: first?.submitted_at ?? '',
							verified: first?.verified ?? false
						}))
				: [],
		run:
			kind === 'run'
				? {
						trials: site.trials.filter((trial) => trial.run_id === page.params.run_id),
						submission: site.submission(page.params.run_id ?? ''),
						bundle: page.params.bundle ?? null,
						files: site.downloads.filter((file) => file.startsWith(`runs/${page.params.run_id}/`))
					}
				: null
	};
}

/** The page of `kind` whose path splits into these route parameters. */
export function pageFor(kind: Kind, params: Record<string, string> = {}): Page {
	const wanted = Object.entries(params);
	const page = loadExport().pages.find((candidate) => {
		const found = paramsOf(kind, candidate);
		return (
			found !== null &&
			Object.keys(found).length === wanted.length &&
			wanted.every(([name, value]) => found[name] === value)
		);
	});
	if (!page)
		throw new ExportError(`pages.json lists no ${kind} page for ${JSON.stringify(params)}`);
	return pageAt(page.path, kind);
}
