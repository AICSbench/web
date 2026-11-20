// Maps the export's pages to SvelteKit routes. Paths come from pages.json
// unchanged: entries() splits each path into the route's parameters, and the
// load finds the page whose path splits into the same parameters. No path or
// slug is ever built here, so any spelling the export uses survives.
import { loadExport, pageAt, ExportError } from '../load-export.ts';
import type { Page } from '../types/export.ts';

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
