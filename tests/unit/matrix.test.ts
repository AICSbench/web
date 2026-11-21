import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../../src/lib/compare/matrix.ts';
import type { CompareRow, MatrixColumnView } from '../../src/lib/compare/types.ts';

function row(value: string, passed: number, trials: number, mean: number | null = 100): CompareRow {
	return {
		value,
		trials,
		passed,
		rate_limited: 0,
		timed: mean === null ? 0 : trials,
		mean_seconds: mean,
		stdev_seconds: null,
		mean_cost_usd: null,
		cost_samples: 0,
		low_confidence: trials < 3,
		success_rate: passed / trials
	};
}

function column(task: string, rows: CompareRow[], refused: string | null = null): MatrixColumnView {
	return { task, task_version: '1', rows, refused, href: `/compare/?task=${task}` };
}

describe('buildMatrix', () => {
	it('ranks complete rows first, averages per-task rates and ranks, and skips refused columns', () => {
		const columns = [
			column('a', [row('y', 1, 1, 100), row('x', 1, 2, 500)]),
			column('b', [row('x', 1, 1, 900)]),
			column('c', [], 'comparison mixes acceptance suites; pick one suite')
		];
		const rows = buildMatrix(columns);
		expect(rows.map((item) => item.value)).toEqual(['x', 'y']);
		const x = rows[0];
		expect(x.cells[2]).toBeNull();
		expect(x.overall).toEqual({
			success_rate: 0.75,
			covered: 2,
			columns: 2,
			mean_rank: 1.5,
			complete: true
		});
		const y = rows[1];
		expect(y.overall).toEqual({
			success_rate: 1,
			covered: 1,
			columns: 2,
			mean_rank: 1,
			complete: false
		});
	});

	it('orders equal complete rows by mean rank, then value', () => {
		const rows = buildMatrix([
			column('a', [row('b', 1, 1), row('a', 1, 1)]),
			column('b', [row('a', 1, 1), row('b', 1, 1)])
		]);
		expect(rows.map((item) => item.value)).toEqual(['a', 'b']);
	});

	it('keeps a null mean as null, never zero', () => {
		const rows = buildMatrix([column('a', [row('x', 1, 1, null)])]);
		expect(rows[0].cells[0]?.mean_seconds).toBeNull();
		expect(rows[0].overall.success_rate).toBe(1);
	});
});
