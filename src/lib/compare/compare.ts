// Runs one single-task comparison or one comparison per matrix column. The
// refusal is decided on the export rows; the numbers come from query.sql.
import type { TrialRow } from '#lib/types/export.ts';
import { dimensionValue, normalizeDimensions } from './dimensions.ts';
import { matchesFilters, newestVersion } from './filters.ts';
import { buildMatrix } from './matrix.ts';
import { runCompareQuery } from './query.ts';
import { refusal } from './refusals.ts';
import { compareHref } from './url.ts';
import type {
	CompareData,
	Dimension,
	CompareRow,
	MatrixColumnView,
	MatrixRowView,
	Selection
} from './types.ts';

export interface SingleComparison {
	task: string | null;
	task_version: string | null;
	dimensions: Dimension[];
	rows: CompareRow[];
	refused: string | null;
	providers: Record<string, string>;
}

export interface MatrixComparison {
	dimensions: Dimension[];
	columns: MatrixColumnView[];
	rows: MatrixRowView[];
	refused: string | null;
	providers: Record<string, string>;
}

function providersFor(
	trials: readonly TrialRow[],
	dimensions: readonly Dimension[]
): Record<string, string> {
	// A provider badge makes sense only when the row is a harness or a package.
	if (!dimensions.includes('harness') && !dimensions.includes('harness_version')) return {};
	const providers = new Map<string, Set<string>>();
	for (const trial of trials) {
		const value = dimensions.map((dimension) => dimensionValue(trial, dimension)).join(' + ');
		const seen = providers.get(value) ?? new Set<string>();
		seen.add(trial.provider ?? 'unknown');
		providers.set(value, seen);
	}
	return Object.fromEntries(
		[...providers].flatMap(([value, seen]) => (seen.size === 1 ? [[value, [...seen][0]]] : []))
	);
}

function noSelection(): SingleComparison {
	return {
		task: null,
		task_version: null,
		dimensions: [],
		rows: [],
		refused: null,
		providers: {}
	};
}

/** A single-task comparison: exactly compare_trials on that task version. */
export async function compareSingle(
	data: CompareData,
	selection: Selection
): Promise<SingleComparison> {
	const normalized = normalizeDimensions(selection.by);
	if (normalized.error !== null) {
		return { ...noSelection(), task: selection.task, refused: normalized.error };
	}
	if (selection.task === null) return noSelection();
	const version = selection.version ?? newestVersion(data.rows, selection.task, selection.filters);
	const trials = data.rows.filter(
		(trial) =>
			trial.task === selection.task &&
			trial.task_version === version &&
			matchesFilters(trial, selection.filters)
	);
	const refused = refusal(trials, selection.by);
	if (refused !== null) {
		return {
			task: selection.task,
			task_version: version,
			dimensions: normalized.dimensions,
			rows: [],
			refused,
			providers: {}
		};
	}
	const rows =
		version === null
			? []
			: await runCompareQuery(
					data,
					normalized.dimensions,
					selection.filters,
					selection.task,
					version
				);
	return {
		task: selection.task,
		task_version: version,
		dimensions: normalized.dimensions,
		rows,
		refused: null,
		providers: providersFor(trials, normalized.dimensions)
	};
}

/** A matrix: each column is its own single-task comparison and refusal. */
export async function compareMatrix(
	data: CompareData,
	selection: Selection,
	pathname: string
): Promise<MatrixComparison> {
	const normalized = normalizeDimensions(selection.by);
	if (normalized.error !== null) {
		return { dimensions: [], columns: [], rows: [], refused: normalized.error, providers: {} };
	}
	const columns: MatrixColumnView[] = [];
	const displayedTrials: TrialRow[] = [];
	const seen = new Set<string>();
	for (const task of selection.tasks) {
		const version = task.version ?? newestVersion(data.rows, task.id, selection.filters);
		const key = `${task.id}\u0000${version ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const trials = data.rows.filter(
			(trial) =>
				trial.task === task.id &&
				trial.task_version === version &&
				matchesFilters(trial, selection.filters)
		);
		const refused = refusal(trials, selection.by);
		const rows =
			refused !== null || version === null
				? []
				: await runCompareQuery(data, normalized.dimensions, selection.filters, task.id, version);
		if (rows.length > 0) displayedTrials.push(...trials);
		const single: Selection = {
			view: 'single',
			task: task.id,
			version,
			tasks: [],
			by: selection.by,
			filters: selection.filters
		};
		columns.push({
			task: task.id,
			task_version: version,
			rows,
			refused,
			href: compareHref(pathname, single, data.rows)
		});
	}
	return {
		dimensions: normalized.dimensions,
		columns,
		rows: buildMatrix(columns),
		refused: null,
		providers: providersFor(displayedTrials, normalized.dimensions)
	};
}
