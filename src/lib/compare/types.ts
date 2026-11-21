// The compare page's selection, filter and result types. The SQL result shape
// mirrors comparison.ComparisonRow; the matrix shape mirrors compare_matrix.
import type { Row, TrialRow } from '#lib/types/export.ts';

export const DIMENSIONS = [
	'harness',
	'harness_version',
	'model',
	'harness_model',
	'stack',
	'language',
	'framework',
	'provider'
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
	harness: 'Harness',
	harness_version: 'Harness version',
	model: 'Model',
	harness_model: 'Harness + model',
	stack: 'Stack',
	language: 'Language',
	framework: 'Framework',
	provider: 'Provider'
};

/** The order canonical URLs and table headers use for dimensions. */
export const DIMENSION_ORDER: Dimension[] = [...DIMENSIONS];

export const DEFAULT_BY: Dimension[] = ['harness', 'model'];

export interface FilterState {
	harness: string[];
	harness_version: string[];
	model: string[];
	stack: string[];
	language: string[];
	framework: string[];
	provider: string[];
	mode: string[];
	auth: string[];
	repairs: number[];
	parallel: number[];
	verified: boolean;
	/** True when rate-limited trials are included (`rl=1`). Default: excluded. */
	includeRateLimited: boolean;
	since: string | null;
	/** A full suite hash, or null for the column's only suite. */
	suite: string | null;
}

export interface TaskChoice {
	id: string;
	/** null selects the newest version among the filtered trials. */
	version: string | null;
}

export interface Selection {
	view: 'single' | 'matrix';
	/** Single-task view: the task ID. */
	task: string | null;
	/** Single-task view: the pinned version, or null for the newest. */
	version: string | null;
	/** Matrix view: the tasks, each optionally pinned. */
	tasks: TaskChoice[];
	/** Raw dimensions as the URL wrote them; normalized before use. */
	by: Dimension[];
	filters: FilterState;
}

export type CompareRow = Row;

export interface MatrixColumnView {
	task: string;
	task_version: string | null;
	rows: CompareRow[];
	refused: string | null;
	/** Single-task compare URL for this column. */
	href: string;
}

export interface MatrixOverallView {
	success_rate: number | null;
	covered: number;
	columns: number;
	mean_rank: number | null;
	complete: boolean;
}

export interface MatrixRowView {
	value: string;
	cells: (CompareRow | null)[];
	overall: MatrixOverallView;
}

export interface CompareData {
	rows: TrialRow[];
	conn: import('@duckdb/duckdb-wasm').AsyncDuckDBConnection | null;
	db: import('@duckdb/duckdb-wasm').AsyncDuckDB | null;
}
