// The compare page's URL contract: raw data values, comma-separated lists,
// parameters in a fixed order, defaults left out. Unknown parameters are
// ignored; unknown dimensions are left for normalizeDimensions to report.
import type { TrialRow } from '#lib/types/export.ts';
import { canonicalBy } from './dimensions.ts';
import { distinct, newestVersion, suitesOf } from './filters.ts';
import {
	DEFAULT_BY,
	type Dimension,
	type FilterState,
	type Selection,
	type TaskChoice
} from './types.ts';

export interface ParsedSelection extends Selection {
	suiteError: string | null;
}

export function defaultFilters(): FilterState {
	return {
		harness: [],
		harness_version: [],
		model: [],
		stack: [],
		language: [],
		framework: [],
		provider: [],
		mode: [],
		auth: [],
		repairs: [],
		parallel: [],
		verified: true,
		includeRateLimited: false,
		since: null,
		suite: null
	};
}

export function defaultSelection(): Selection {
	return {
		view: 'single',
		task: null,
		version: null,
		tasks: [],
		by: [...DEFAULT_BY],
		filters: defaultFilters()
	};
}

function splitList(value: string | null): string[] {
	return value === null || value === '' ? [] : value.split(',').filter(Boolean);
}

function numbers(value: string | null): number[] {
	return splitList(value)
		.map((item) => Number(item))
		.filter((item) => Number.isInteger(item));
}

function parseTask(entry: string): TaskChoice | null {
	if (entry === '') return null;
	const at = entry.indexOf('@');
	if (at === -1) return { id: entry, version: null };
	const id = entry.slice(0, at);
	const version = entry.slice(at + 1);
	return id === '' ? null : { id, version: version === '' ? null : version };
}

export function resolveSuite(
	raw: string,
	rows: readonly TrialRow[]
): { suite: string | null; error: string | null } {
	const value = raw.toLowerCase();
	if (!/^[0-9a-f]{8,}$/.test(value)) {
		return { suite: null, error: 'suite must be at least 8 hex characters' };
	}
	const matches = suitesOf(rows).filter((suite) => suite.startsWith(value));
	if (matches.length === 0) {
		return { suite: null, error: `no acceptance suite matches ${raw}` };
	}
	if (matches.length > 1) {
		return {
			suite: null,
			error: `suite prefix ${raw} matches several acceptance suites; use more characters`
		};
	}
	return { suite: matches[0], error: null };
}

/** Read a selection from a query string. Task versions are resolved later. */
export function parseSelection(search: string, rows: readonly TrialRow[]): ParsedSelection {
	const params = new URLSearchParams(search);
	const rawTask = params.get('task') ?? '';
	const view = params.get('view') === 'matrix' ? 'matrix' : 'single';
	const tasks =
		view === 'matrix'
			? splitList(rawTask)
					.map(parseTask)
					.filter((task): task is TaskChoice => task !== null)
			: [];
	const rawBy = splitList(params.get('by'));
	const by = (rawBy.length === 0 ? [...DEFAULT_BY] : rawBy) as Dimension[];
	const since = params.get('since');
	const suite = params.get('suite');
	const resolved =
		suite === null || suite === '' ? { suite: null, error: null } : resolveSuite(suite, rows);
	return {
		view,
		task: view === 'single' ? rawTask || null : null,
		version: view === 'single' ? params.get('v') || null : null,
		tasks,
		by,
		filters: {
			harness: splitList(params.get('harness')),
			harness_version: splitList(params.get('harness_version')),
			model: splitList(params.get('model')),
			stack: splitList(params.get('stack')),
			language: splitList(params.get('language')),
			framework: splitList(params.get('framework')),
			provider: splitList(params.get('provider')),
			mode: splitList(params.get('mode')),
			auth: splitList(params.get('auth')),
			repairs: numbers(params.get('repairs')),
			parallel: numbers(params.get('parallel')),
			verified: params.get('verified') !== '0',
			includeRateLimited: params.get('rl') === '1',
			since: since !== null && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : null,
			suite: resolved.suite
		},
		suiteError: resolved.error
	};
}

function encodeValue(value: string): string {
	// @ is valid in a query value and keeps the readable task@version form.
	return encodeURIComponent(value).replaceAll('%40', '@');
}

function listParam(values: readonly (string | number)[]): string {
	return values.map((value) => encodeValue(String(value))).join(',');
}

/** The suite the selected task(s) use when there is only one. */
function onlySuite(rows: readonly TrialRow[], selection: Selection): string | null {
	const tasks =
		selection.view === 'matrix'
			? selection.tasks.map((task) => task.id)
			: selection.task === null
				? []
				: [selection.task];
	const suites = distinct(
		rows.filter((trial) => tasks.includes(trial.task)).map((trial) => trial.suite_sha256)
	);
	return suites.length === 1 ? suites[0] : null;
}

/** The canonical query string for a selection, without the leading "?". */
export function canonicalSearch(selection: Selection, rows: readonly TrialRow[]): string {
	const params: [string, string][] = [];
	const filters = selection.filters;
	if (selection.view === 'matrix') params.push(['view', 'matrix']);
	if (selection.view === 'matrix') {
		const tasks = selection.tasks.map((task) => {
			const newest = newestVersion(rows, task.id, filters);
			const version = task.version === null || task.version === newest ? null : task.version;
			return version === null ? task.id : `${task.id}@${version}`;
		});
		if (tasks.length > 0) params.push(['task', listParam(tasks)]);
	} else if (selection.task !== null) {
		params.push(['task', encodeValue(selection.task)]);
		const newest = newestVersion(rows, selection.task, filters);
		if (selection.version !== null && selection.version !== newest) {
			params.push(['v', encodeValue(selection.version)]);
		}
	}
	const by = canonicalBy(selection);
	if (by !== DEFAULT_BY.join(',')) params.push(['by', listParam(by.split(','))]);
	for (const key of [
		'harness',
		'harness_version',
		'model',
		'stack',
		'language',
		'framework',
		'provider'
	] as const) {
		if (filters[key].length > 0) params.push([key, listParam([...filters[key]].sort())]);
	}
	if (filters.mode.length > 0) params.push(['mode', listParam([...filters.mode].sort())]);
	if (filters.auth.length > 0) params.push(['auth', listParam([...filters.auth].sort())]);
	if (filters.repairs.length > 0) {
		params.push(['repairs', listParam([...filters.repairs].sort((a, b) => a - b))]);
	}
	if (filters.parallel.length > 0) {
		params.push(['parallel', listParam([...filters.parallel].sort((a, b) => a - b))]);
	}
	if (!filters.verified) params.push(['verified', '0']);
	if (filters.includeRateLimited) params.push(['rl', '1']);
	if (filters.since !== null) params.push(['since', filters.since]);
	if (filters.suite !== null && filters.suite !== onlySuite(rows, selection)) {
		params.push(['suite', encodeValue(filters.suite)]);
	}
	return params.map(([key, value]) => `${key}=${value}`).join('&');
}

/** A compare URL for a selection, under the site's base path. */
export function compareHref(
	pathname: string,
	selection: Selection,
	rows: readonly TrialRow[]
): string {
	const search = canonicalSearch(selection, rows);
	return search === '' ? pathname : `${pathname}?${search}`;
}

/** Short display label for a suite hash. */
export function suiteLabel(suite: string): string {
	return suite.slice(0, 8);
}
