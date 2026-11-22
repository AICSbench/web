// DuckDB-WASM in the browser: load data/trials.json once, then run query.sql
// for the selected dimensions and filters. The wasm and worker files are
// bundled by Vite and served from this site, never a third-party origin.
import * as arrow from 'apache-arrow';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type { TrialRow } from '#lib/types/export.ts';
import { dimensionSql } from './dimensions.ts';
import type { Dimension } from './types.ts';
import querySql from './query.sql?raw';
import type { CompareData, CompareRow, FilterState } from './types.ts';

let cached: Promise<CompareData> | null = null;

/** Load data/trials.json into a `trials` table once, on first use. */
export function loadCompareData(): Promise<CompareData> {
	cached ??= createData();
	return cached;
}

async function createData(): Promise<CompareData> {
	const response = await fetch(new URL('../data/trials.json', window.location.href), {
		headers: { accept: 'application/json' }
	});
	if (!response.ok) {
		throw new Error(`data/trials.json: HTTP ${response.status} ${response.statusText}`);
	}
	const text = await response.text();
	const rows = JSON.parse(text) as TrialRow[];
	if (rows.length === 0) return { rows, db: null, conn: null };

	const duckdb = await import('@duckdb/duckdb-wasm');
	const bundle = await duckdb.selectBundle({
		mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
		eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker }
	});
	const worker = new Worker(bundle.mainWorker!);
	const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
	let moduleUrl = bundle.mainModule;
	if (import.meta.env.VITE_PR_PREVIEW === '1') {
		// Cloudflare Pages cannot host the uncompressed modules (>25 MiB each).
		const compressed = await fetch(`${moduleUrl}.gz`);
		if (!compressed.ok || !compressed.body)
			throw new Error(`DuckDB WASM: HTTP ${compressed.status}`);
		const wasm = await new Response(
			compressed.body.pipeThrough(new DecompressionStream('gzip'))
		).arrayBuffer();
		moduleUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
	}
	try {
		await db.instantiate(moduleUrl, bundle.pthreadWorker);
	} finally {
		if (moduleUrl !== bundle.mainModule) URL.revokeObjectURL(moduleUrl);
	}
	await db.open({ path: ':memory:' });
	const conn = await db.connect();
	// Insert the parsed rows directly: DuckDB's JSON loader would fetch its
	// json.duckdb_extension from duckdb.org, and the site must request only
	// its own origin. The explicit schema keeps a column that happens to be
	// null in every row (for example cost_usd or provider); inference would
	// drop it and query.sql would then fail to bind.
	const table = new arrow.Table(COMPARE_SCHEMA, {
		task: arrow.vectorFromArray(
			rows.map((row) => row.task),
			new arrow.Utf8()
		),
		task_version: arrow.vectorFromArray(
			rows.map((row) => row.task_version),
			new arrow.Utf8()
		),
		harness: arrow.vectorFromArray(
			rows.map((row) => row.harness),
			new arrow.Utf8()
		),
		harness_version: arrow.vectorFromArray(
			rows.map((row) => row.harness_version),
			new arrow.Utf8()
		),
		model: arrow.vectorFromArray(
			rows.map((row) => row.model),
			new arrow.Utf8()
		),
		stack: arrow.vectorFromArray(
			rows.map((row) => row.stack),
			new arrow.Utf8()
		),
		language: arrow.vectorFromArray(
			rows.map((row) => row.language),
			new arrow.Utf8()
		),
		framework: arrow.vectorFromArray(
			rows.map((row) => row.framework),
			new arrow.Utf8()
		),
		tooling_mode: arrow.vectorFromArray(
			rows.map((row) => row.tooling_mode),
			new arrow.Utf8()
		),
		auth_mode: arrow.vectorFromArray(
			rows.map((row) => row.auth_mode),
			new arrow.Utf8()
		),
		status: arrow.vectorFromArray(
			rows.map((row) => row.status),
			new arrow.Utf8()
		),
		rate_limited: arrow.vectorFromArray(
			rows.map((row) => row.rate_limited),
			new arrow.Bool()
		),
		agent_seconds: arrow.vectorFromArray(
			rows.map((row) => row.agent_seconds),
			new arrow.Float64()
		),
		cost_usd: arrow.vectorFromArray(
			rows.map((row) => row.cost_usd),
			new arrow.Float64()
		),
		cost_availability: arrow.vectorFromArray(
			rows.map((row) => row.cost_availability),
			new arrow.Utf8()
		),
		provider: arrow.vectorFromArray(
			rows.map((row) => row.provider ?? null),
			new arrow.Utf8()
		),
		suite_sha256: arrow.vectorFromArray(
			rows.map((row) => row.suite_sha256),
			new arrow.Utf8()
		),
		submitted_at: arrow.vectorFromArray(
			rows.map((row) => row.submitted_at),
			new arrow.Utf8()
		),
		max_repairs: arrow.vectorFromArray(
			rows.map((row) => row.max_repairs),
			new arrow.Int32()
		),
		max_parallel: arrow.vectorFromArray(
			rows.map((row) => row.max_parallel),
			new arrow.Int32()
		),
		verified: arrow.vectorFromArray(
			rows.map((row) => row.verified),
			new arrow.Bool()
		)
	});
	await conn.insertArrowTable(table, { name: 'trials', create: true });
	return { rows, db, conn };
}

/** The columns query.sql reads. */
const COMPARE_SCHEMA = new arrow.Schema([
	new arrow.Field('task', new arrow.Utf8()),
	new arrow.Field('task_version', new arrow.Utf8()),
	new arrow.Field('harness', new arrow.Utf8()),
	new arrow.Field('harness_version', new arrow.Utf8()),
	new arrow.Field('model', new arrow.Utf8()),
	new arrow.Field('stack', new arrow.Utf8()),
	new arrow.Field('language', new arrow.Utf8()),
	new arrow.Field('framework', new arrow.Utf8()),
	new arrow.Field('tooling_mode', new arrow.Utf8()),
	new arrow.Field('auth_mode', new arrow.Utf8()),
	new arrow.Field('status', new arrow.Utf8()),
	new arrow.Field('rate_limited', new arrow.Bool()),
	new arrow.Field('agent_seconds', new arrow.Float64()),
	new arrow.Field('cost_usd', new arrow.Float64()),
	new arrow.Field('cost_availability', new arrow.Utf8()),
	new arrow.Field('provider', new arrow.Utf8()),
	new arrow.Field('suite_sha256', new arrow.Utf8()),
	new arrow.Field('submitted_at', new arrow.Utf8()),
	new arrow.Field('max_repairs', new arrow.Int32()),
	new arrow.Field('max_parallel', new arrow.Int32()),
	new arrow.Field('verified', new arrow.Bool())
]);

interface QueryParams {
	[k: string]: string | number | null;
}

function params(filters: FilterState, task: string, version: string): QueryParams {
	return {
		task,
		task_version: version,
		verified: filters.verified ? 1 : 0,
		include_rate_limited: filters.includeRateLimited ? 1 : 0,
		since: filters.since,
		suite: filters.suite,
		harness: JSON.stringify(filters.harness),
		harness_version: JSON.stringify(filters.harness_version),
		// Python compares a model filter to the raw label or the lower-case model key.
		model: JSON.stringify(filters.model),
		stack: JSON.stringify(filters.stack),
		language: JSON.stringify(filters.language),
		framework: JSON.stringify(filters.framework),
		provider: JSON.stringify(filters.provider),
		mode: JSON.stringify(filters.mode),
		auth: JSON.stringify(filters.auth),
		repairs: JSON.stringify(filters.repairs),
		parallel: JSON.stringify(filters.parallel),
		min_trials: 3
	};
}

/** Replace each $name with a positional ? and return the values in that order. */
export function bindNamed(sql: string, values: QueryParams): { sql: string; values: unknown[] } {
	const bound: unknown[] = [];
	const text = sql
		.split('\n')
		.map((line) => {
			// A comment may name a parameter for documentation; it is not a placeholder.
			if (line.trimStart().startsWith('--')) return line;
			return line.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => {
				if (!(name in values)) throw new Error(`query.sql uses unknown parameter $${name}`);
				bound.push(values[name]);
				return '?';
			});
		})
		.join('\n');
	return { sql: text, values: bound };
}

function number(value: unknown): number | null {
	return value === null || value === undefined ? null : Number(value);
}

function toRow(record: Record<string, unknown>): CompareRow {
	const trials = Number(record.trials);
	const passed = Number(record.passed);
	return {
		value: String(record.value),
		trials,
		passed,
		rate_limited: Number(record.rate_limited),
		timed: Number(record.timed),
		mean_seconds: number(record.mean_seconds),
		stdev_seconds: number(record.stdev_seconds),
		mean_cost_usd: number(record.mean_cost_usd),
		cost_samples: Number(record.cost_samples),
		low_confidence: Boolean(record.low_confidence),
		success_rate: trials === 0 ? 0 : passed / trials
	};
}

/** Run one comparison group for a task version. */
export async function runCompareQuery(
	data: CompareData,
	dimensions: readonly Dimension[],
	filters: FilterState,
	task: string,
	version: string
): Promise<CompareRow[]> {
	if (data.conn === null) return [];
	const { value, groupBy } = dimensionSql(dimensions);
	const sql = querySql.replaceAll('{{value}}', value).replaceAll('{{group_by}}', groupBy);
	const bound = bindNamed(sql, params(filters, task, version));
	const statement = await data.conn.prepare(bound.sql);
	try {
		const table = await statement.query(...bound.values);
		const records = (table.toArray() as unknown[]).map((row) =>
			(row as { toJSON(): Record<string, unknown> }).toJSON()
		);
		return records.map(toRow);
	} finally {
		await statement.close();
	}
}
