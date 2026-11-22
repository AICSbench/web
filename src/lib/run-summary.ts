// Run detail summaries: one group per stack, and one summary row per
// harness + model combination inside it. Stack variants stay separate, and a
// stack never folds different harness/model combinations into one row.
// `runInsights` turns the same trials into prerendered prose for the run page.
import { duration, percent } from './format.ts';
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
								: times.reduce((sum, seconds) => sum + seconds, 0) / times.length
					};
				})
				.sort((a, b) => compareText(a.harness, b.harness) || compareText(a.model, b.model));

			return { stack, trials: stackTrials, rows };
		});
}

/** The smallest timed sample that can take part in a speed comparison. */
const MIN_TIMED = 2;
/** The sample size the site already treats as low confidence. */
const CONFIDENT_TIMED = 3;

interface StackInsight {
	stack: string;
	trials: number;
	passed: number;
	timed: number;
	mean_agent_seconds: number | null;
}

interface SetupInsight {
	label: string;
	trials: TrialRow[];
	stacks: StackInsight[];
	timed: number;
	mean_agent_seconds: number | null;
}

function plural(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

/**
 * Trials are comparable only when the task, version, acceptance suite, harness,
 * model, provider and agent configuration all match. The stack is deliberately
 * absent: stack is the dimension a run insight compares.
 */
function setupKey(trial: TrialRow): string {
	return JSON.stringify([
		trial.task,
		trial.task_version,
		trial.suite_sha256,
		trial.agent,
		trial.harness,
		trial.harness_version,
		trial.model,
		trial.requested_model,
		trial.provider ?? null,
		trial.endpoint_host ?? null,
		trial.reasoning_effort,
		trial.auth_mode,
		trial.tooling_mode,
		trial.max_repairs,
		trial.max_parallel
	]);
}

function setupLabel(trials: readonly TrialRow[]): string {
	const first = trials[0];
	const provider = first.provider ? ` via ${first.provider}` : '';
	return `${first.harness} + ${first.model}${provider}`;
}

function stackInsight(stack: string, trials: readonly TrialRow[]): StackInsight {
	const passed = trials.filter((trial) => trial.status === 'passed');
	const times = passed
		.filter((trial) => !trial.rate_limited && trial.agent_seconds !== null)
		.map((trial) => trial.agent_seconds as number);
	return {
		stack,
		trials: trials.length,
		passed: passed.length,
		timed: times.length,
		mean_agent_seconds:
			times.length === 0 ? null : times.reduce((sum, seconds) => sum + seconds, 0) / times.length
	};
}

function setupInsights(trials: readonly TrialRow[]): SetupInsight[] {
	const bySetup = new Map<string, TrialRow[]>();
	for (const trial of trials) {
		const key = setupKey(trial);
		const group = bySetup.get(key);
		if (group) group.push(trial);
		else bySetup.set(key, [trial]);
	}

	return [...bySetup.values()]
		.map((rows) => {
			const byStack = new Map<string, TrialRow[]>();
			for (const row of rows) {
				const group = byStack.get(row.stack);
				if (group) group.push(row);
				else byStack.set(row.stack, [row]);
			}
			const stacks = [...byStack]
				.map(([stack, stackTrials]) => stackInsight(stack, stackTrials))
				.sort((a, b) => compareText(a.stack, b.stack));
			const times = rows
				.filter((row) => row.status === 'passed' && !row.rate_limited && row.agent_seconds !== null)
				.map((row) => row.agent_seconds as number);
			return {
				label: setupLabel(rows),
				trials: rows,
				stacks,
				timed: times.length,
				mean_agent_seconds:
					times.length === 0
						? null
						: times.reduce((sum, seconds) => sum + seconds, 0) / times.length
			};
		})
		.sort(
			(a, b) =>
				b.stacks.filter((stack) => stack.timed >= MIN_TIMED).length -
					a.stacks.filter((stack) => stack.timed >= MIN_TIMED).length ||
				b.timed - a.timed ||
				b.trials.length - a.trials.length ||
				compareText(a.label, b.label)
		);
}

function passRate(stack: StackInsight): number {
	return stack.passed / stack.trials;
}

function setupResult(setup: SetupInsight): string {
	const passed = setup.stacks.reduce((count, stack) => count + stack.passed, 0);
	const trials = setup.stacks.reduce((count, stack) => count + stack.trials, 0);
	const timing =
		setup.timed === 0
			? ', but no passed trial recorded a usable agent time'
			: `, with a mean agent time of ${duration(setup.mean_agent_seconds as number)} over ${plural(setup.timed, 'timed passing trial')}`;
	return `passed ${passed} of ${trials} ${trials === 1 ? 'trial' : 'trials'} (${percent(passed / trials)})${timing}`;
}

/**
 * Prerendered, data-driven prose for a run page. It compares stacks only inside
 * one setup that shares the task, version, suite, harness, model, provider and
 * agent configuration. It never ranks across setups or verification tiers, and
 * it reports small samples as directional instead of declaring a winner.
 */
export function runInsights(trials: readonly TrialRow[], taskName: string): string[] {
	const first = trials[0];
	if (!first) return [];

	if (new Set(trials.map((trial) => trial.verified)).size > 1) {
		return [
			'This run contains both verified and community trials. They are not compared with each other, so no benchmark insight is drawn across tiers.'
		];
	}

	const comparability = new Set(
		trials.map((trial) => `${trial.task}\u0000${trial.task_version}\u0000${trial.suite_sha256}`)
	);
	if (comparability.size > 1) {
		return [
			'This run contains trials from more than one task, version, or acceptance suite, so results are not compared across them.'
		];
	}

	const tier = first.verified ? 'verified' : 'community';
	const passed = trials.filter((trial) => trial.status === 'passed').length;
	const rateLimited = trials.filter((trial) => trial.rate_limited).length;
	const stacks = new Set(trials.map((trial) => trial.stack)).size;
	const setups = setupInsights(trials);
	const task = taskName || first.task;
	const suite = first.suite_sha256.slice(0, 8);
	const summary = `${task} version ${first.task_version} (acceptance suite ${suite}) has ${plural(trials.length, `${tier} trial`)} across ${plural(stacks, 'stack')} and ${plural(setups.length, 'setup variant')}. ${passed} of ${trials.length} ${trials.length === 1 ? 'trial' : 'trials'} passed (${percent(passed / trials.length)} pass rate)${rateLimited > 0 ? `; ${plural(rateLimited, 'trial')} hit a rate limit` : ''}.`;

	const withTiming = setups.filter(
		(setup) => setup.stacks.filter((stack) => stack.timed >= MIN_TIMED).length >= 2
	);
	const withRates = setups.filter(
		(setup) => setup.stacks.filter((stack) => stack.trials >= MIN_TIMED).length >= 2
	);
	const primary = (
		withTiming.length > 0 ? withTiming : withRates.length > 0 ? withRates : setups
	)[0];
	const paragraphs = [summary];

	if (withTiming.length > 0) {
		const timedStacks = primary.stacks
			.filter((stack) => stack.timed >= MIN_TIMED)
			.sort(
				(a, b) =>
					(a.mean_agent_seconds as number) - (b.mean_agent_seconds as number) ||
					compareText(a.stack, b.stack)
			);
		const fastest = timedStacks[0];
		const runnerUp = timedStacks[1];
		const confident = timedStacks.every((stack) => stack.timed >= CONFIDENT_TIMED);
		paragraphs.push(
			`Within the best-covered comparable setup (${primary.label}), ${fastest.stack} recorded the lowest mean agent time at ${duration(fastest.mean_agent_seconds as number)} across ${plural(fastest.timed, 'timed passing trial')}, versus ${duration(runnerUp.mean_agent_seconds as number)} for ${runnerUp.stack} (${plural(runnerUp.timed, 'timed passing trial')}). The comparison covers ${plural(timedStacks.length, 'stack')} with at least ${plural(MIN_TIMED, 'timed passing trial')} each. ${fastest.stack} passed ${fastest.passed} of ${fastest.trials} ${fastest.trials === 1 ? 'trial' : 'trials'} (${percent(passRate(fastest))} pass rate), while ${runnerUp.stack} passed ${runnerUp.passed} of ${runnerUp.trials} (${percent(passRate(runnerUp))} pass rate).`
		);

		const bestRate = Math.max(...timedStacks.map(passRate));
		if (passRate(fastest) < bestRate) {
			const best = timedStacks
				.filter((stack) => passRate(stack) === bestRate)
				.sort((a, b) => compareText(a.stack, b.stack))[0];
			paragraphs.push(
				`The trade-off is reliability: ${best.stack} passed ${best.passed} of ${best.trials} trials (${percent(passRate(best))}), while ${fastest.stack} passed ${fastest.passed} of ${fastest.trials} (${percent(passRate(fastest))}).`
			);
		} else if (timedStacks.every((stack) => passRate(stack) === passRate(fastest))) {
			paragraphs.push(
				`The compared stacks had the same ${percent(passRate(fastest))} pass rate, so the difference is time rather than reliability.`
			);
		} else {
			paragraphs.push(`${fastest.stack} also had the best pass rate among the compared stacks.`);
		}

		if (!confident) {
			paragraphs.push(
				`With fewer than ${plural(CONFIDENT_TIMED, 'timed passing trial')} on the smallest sample, the time gap is directional rather than a confident ranking.`
			);
		}
	} else if (withRates.length > 0) {
		const comparableStacks = primary.stacks.filter((stack) => stack.trials >= MIN_TIMED);
		if (comparableStacks.length >= 2) {
			const ranked = [...comparableStacks].sort(
				(a, b) => passRate(b) - passRate(a) || compareText(a.stack, b.stack)
			);
			const best = ranked[0];
			const runnerUp = ranked[1];
			const tied = passRate(best) === passRate(runnerUp);
			const lead = tied
				? `${best.stack} and ${runnerUp.stack} both had a ${percent(passRate(best))} pass rate (${best.passed}/${best.trials} and ${runnerUp.passed}/${runnerUp.trials})`
				: `${best.stack} had the highest pass rate at ${percent(passRate(best))} (${best.passed}/${best.trials}), compared with ${percent(passRate(runnerUp))} (${runnerUp.passed}/${runnerUp.trials}) for ${runnerUp.stack}`;
			paragraphs.push(
				`Within the best-covered comparable setup (${primary.label}), ${plural(comparableStacks.length, 'stack')} have at least ${plural(MIN_TIMED, 'trial')}. ${lead}. No stack in this setup has at least ${plural(MIN_TIMED, 'timed passing trial')}, so no mean agent time is compared.`
			);
			if (tied) {
				paragraphs.push(
					`The compared stacks had the same pass rate, so the run does not support a stack ranking.`
				);
			} else {
				paragraphs.push(
					`Treat this pass-rate gap as directional until the stacks have more trials.`
				);
			}
		} else {
			paragraphs.push(
				`No two stacks in this run share the same task, version, acceptance suite, harness, model, provider and agent configuration with at least ${plural(MIN_TIMED, 'trial')}, so the run does not support a stack ranking.`
			);
			paragraphs.push(`The best-covered setup is ${primary.label}, which ${setupResult(primary)}.`);
		}
	} else if (stacks === 1) {
		paragraphs.push(
			`This run covers a single stack, ${primary.stacks[0].stack}, so there is no stack comparison. ${primary.label} ${setupResult(primary)}.`
		);
	} else {
		paragraphs.push(
			`The run's ${plural(stacks, 'stack')} do not share a comparable setup, so no stack comparison is drawn. The best-covered setup is ${primary.label}, which ${setupResult(primary)}.`
		);
	}

	if (setups.length > 1) {
		paragraphs.push(
			`The run covers ${plural(setups.length, 'setup variant')}: ${setups.map((setup) => setup.label).join('; ')}. The summary table groups by stack, harness and model; these insights split those rows further by provider and agent configuration so only comparable trials are compared.`
		);
	}

	const timingCoverage =
		primary.timed === 0
			? 'No passed trial recorded a usable agent time, so no mean agent time is reported.'
			: `Mean agent time covers passed, non-rate-limited trials that recorded timing (${plural(primary.timed, 'timed passing trial')} in the best-covered setup).`;
	paragraphs.push(
		`${timingCoverage} These figures describe ${task} version ${first.task_version} with acceptance suite ${suite} only; they are not a prediction for other tasks or configurations.`
	);

	return paragraphs;
}
