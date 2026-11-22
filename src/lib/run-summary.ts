// Run detail summaries: one group per stack, and one summary row per
// harness + model combination inside it. Stack variants stay separate, and a
// stack never folds different harness/model combinations into one row.
import type { TrialRow } from './types/export.ts';

export interface RunSummaryRow {
	stack: string;
	harness: string;
	model: string;
	trials: number;
	passed: number;
	pass_rate: number;
	/** Passed trials with a usable agent time (rate-limited trials do not count). */
	timed: number;
	mean_agent_seconds: number | null;
	token_samples: number;
	mean_total_tokens: number | null;
}

export interface RunStackGroup {
	stack: string;
	/** The stack's trials in the export's order. */
	trials: TrialRow[];
	rows: RunSummaryRow[];
}

function compareText(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Group a run's trials by stack, then by harness + model, with pass and timing stats. */
export function groupRunTrials(trials: TrialRow[]): RunStackGroup[] {
	const byStack = new Map<string, TrialRow[]>();
	for (const trial of trials) {
		const stack = byStack.get(trial.stack);
		if (stack) stack.push(trial);
		else byStack.set(trial.stack, [trial]);
	}

	return [...byStack]
		.sort(([a], [b]) => compareText(a, b))
		.map(([stack, stackTrials]) => {
			const byCombination = new Map<string, TrialRow[]>();
			for (const trial of stackTrials) {
				const key = JSON.stringify([trial.harness, trial.model]);
				const combination = byCombination.get(key);
				if (combination) combination.push(trial);
				else byCombination.set(key, [trial]);
			}

			const rows = [...byCombination.values()]
				.map((combination): RunSummaryRow => {
					const passedTrials = combination.filter((trial) => trial.status === 'passed');
					// Match the site's mean agent time: timed passed trials only.
					const times = passedTrials
						.filter((trial) => !trial.rate_limited && trial.agent_seconds !== null)
						.map((trial) => trial.agent_seconds as number);
					const tokens = combination
						.map((trial) => trial.total_tokens)
						.filter((total) => total !== null);
					return {
						stack,
						harness: combination[0].harness,
						model: combination[0].model,
						trials: combination.length,
						passed: passedTrials.length,
						pass_rate: passedTrials.length / combination.length,
						timed: times.length,
						mean_agent_seconds:
							times.length === 0
								? null
								: times.reduce((sum, seconds) => sum + seconds, 0) / times.length,
						token_samples: tokens.length,
						mean_total_tokens:
							tokens.length === 0
								? null
								: tokens.reduce((sum, total) => sum + total, 0) / tokens.length
					};
				})
				.sort((a, b) => compareText(a.harness, b.harness) || compareText(a.model, b.model));

			return { stack, trials: stackTrials, rows };
		});
}
