// The matrix view's overall values, mirroring comparison.compare_matrix.
// Each column is one task version and already holds its own compare_trials
// result; this file only combines columns, so a refused column is left out of
// every overall and of the coverage count.
import type { CompareRow, MatrixColumnView, MatrixRowView } from './types.ts';

function mean(values: readonly number[]): number | null {
	return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Build matrix rows from one comparison per column. */
export function buildMatrix(columns: readonly MatrixColumnView[]): MatrixRowView[] {
	const counted = columns.filter((column) => column.refused === null);
	const values: string[] = [];
	for (const column of counted) {
		for (const row of column.rows) {
			if (!values.includes(row.value)) values.push(row.value);
		}
	}

	const rows: MatrixRowView[] = values.map((value) => {
		const cells = columns.map(
			(column) =>
				(column.refused === null ? column.rows.find((row) => row.value === value) : undefined) ??
				null
		);
		const rates = cells
			.filter((cell): cell is CompareRow => cell !== null)
			.map((cell) => cell.passed / cell.trials);
		const ranks = counted.flatMap((column) => {
			const index = column.rows.findIndex((row) => row.value === value);
			return index === -1 ? [] : [index + 1];
		});
		return {
			value,
			cells,
			overall: {
				success_rate: mean(rates),
				covered: rates.length,
				columns: counted.length,
				mean_rank: mean(ranks),
				complete: rates.length === counted.length
			}
		};
	});

	rows.sort((a, b) => {
		if (a.overall.complete !== b.overall.complete) return a.overall.complete ? -1 : 1;
		const success = (b.overall.success_rate ?? 0) - (a.overall.success_rate ?? 0);
		if (success !== 0) return success;
		const rank = (a.overall.mean_rank ?? 0) - (b.overall.mean_rank ?? 0);
		if (rank !== 0) return rank;
		if (a.value === b.value) return 0;
		return a.value < b.value ? -1 : 1;
	});
	return rows;
}
