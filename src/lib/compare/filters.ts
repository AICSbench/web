// In-memory filters and version selection. These mirror ResultFilter.matches
// and the version choice in comparison.compare_matrix; the numbers still come
// from query.sql.
import type { TrialRow } from '#lib/types/export.ts';
import { modelKey } from './dimensions.ts';
import type { FilterState } from './types.ts';

function oneOf(values: readonly string[], value: string): boolean {
	return values.length === 0 || values.includes(value);
}

function oneOfNumbers(values: readonly number[], value: number): boolean {
	return values.length === 0 || values.includes(value);
}

/** True when a trial passes every filter. `suite` is already a full hash. */
export function matchesFilters(trial: TrialRow, filters: FilterState): boolean {
	if (filters.verified && !trial.verified) return false;
	if (!filters.includeRateLimited && trial.rate_limited) return false;
	if (filters.since !== null) {
		const since = Date.parse(`${filters.since}T00:00:00Z`);
		if (!Number.isFinite(since) || Date.parse(trial.submitted_at) < since) return false;
	}
	if (filters.suite !== null && trial.suite_sha256 !== filters.suite) return false;
	if (!oneOf(filters.harness, trial.harness)) return false;
	if (!oneOf(filters.harness_version, trial.harness_version ?? 'unknown')) return false;
	if (
		filters.model.length > 0 &&
		!filters.model.some((value) => value === trial.model || value.toLowerCase() === modelKey(trial))
	) {
		return false;
	}
	if (!oneOf(filters.stack, trial.stack)) return false;
	if (!oneOf(filters.language, trial.language)) return false;
	if (!oneOf(filters.framework, trial.framework)) return false;
	if (!oneOf(filters.provider, trial.provider ?? 'unknown')) return false;
	if (!oneOf(filters.mode, trial.tooling_mode)) return false;
	if (!oneOf(filters.auth, trial.auth_mode)) return false;
	if (!oneOfNumbers(filters.repairs, trial.max_repairs)) return false;
	if (!oneOfNumbers(filters.parallel, trial.max_parallel)) return false;
	return true;
}

/** Distinct values of a field, sorted for a stable control order. */
export function distinct<T extends string | number>(values: readonly T[]): T[] {
	return [...new Set(values)].sort((a, b) =>
		typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
	);
}

/** Distinct suite hashes, sorted. */
export function suitesOf(rows: readonly TrialRow[]): string[] {
	return distinct(rows.map((trial) => trial.suite_sha256));
}

/** Task versions, newest first. */
export function versionsOf(rows: readonly TrialRow[], task: string): string[] {
	return distinct(
		rows.filter((trial) => trial.task === task).map((trial) => trial.task_version)
	).sort((a, b) => compareVersions(b, a));
}

/** Python's comparison.version_key: dot-separated parts, numbers before text. */
type VersionPart = [0, number] | [1, string];

export function versionKey(version: string): VersionPart[] {
	return version
		.split('.')
		.map((part): VersionPart => (/^\d+$/.test(part) ? [0, Number(part)] : [1, part]));
}

function comparePart(a: VersionPart, b: VersionPart): number {
	if (a[0] !== b[0]) return a[0] - b[0];
	if (a[0] === 0 && b[0] === 0) return a[1] - b[1];
	if (a[0] === 1 && b[0] === 1) {
		const left = a[1];
		const right = b[1];
		return left < right ? -1 : left > right ? 1 : 0;
	}
	return 0;
}

export function compareVersions(a: string, b: string): number {
	const left = versionKey(a);
	const right = versionKey(b);
	for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
		const compared = comparePart(left[index], right[index]);
		if (compared !== 0) return compared;
	}
	return left.length - right.length;
}

/** The newest version among the filtered trials of `task`, or null. */
export function newestVersion(
	rows: readonly TrialRow[],
	task: string,
	filters: FilterState
): string | null {
	const versions = distinct(
		rows
			.filter((trial) => trial.task === task && matchesFilters(trial, filters))
			.map((trial) => trial.task_version)
	);
	versions.sort((a, b) => compareVersions(b, a));
	return versions[0] ?? null;
}
