// Summarizes the export's verified trials for one catalog model. Each row is
// one comparable group: task/version, acceptance suite, stack, harness,
// provider, trial model ID, tooling mode, auth mode, repair budget and
// parallelism all stay separate. Unlike setups are never collapsed into a
// single score.
import { compareHref, defaultFilters } from '../compare/url.ts';
import { compareVersions } from '../compare/filters.ts';
import type { TrialRow } from '../types/export.ts';
import { modelForTrialId, type ModelEntry } from './catalog.ts';

export interface ModelResultGroup {
	/** Stable key over every grouping field, for keyed rendering. */
	key: string;
	task: string;
	taskVersion: string;
	suite: string;
	stack: string;
	harness: string;
	/** The raw model label the trials recorded, not the catalog display name. */
	model: string;
	provider: string | null;
	toolingMode: string;
	authMode: string;
	maxRepairs: number;
	maxParallel: number;
	trials: number;
	passed: number;
	rateLimited: number;
	/** Passed, non-rate-limited trials with an agent time. */
	timed: number;
	meanSeconds: number | null;
	runs: string[];
	/** Compare URL with this group's task, stack, harness, model and suite preselected. */
	compareHref: string | null;
}

export interface ModelResults {
	totalTrials: number;
	totalPassed: number;
	groups: ModelResultGroup[];
	runs: string[];
}

function providerOf(trial: TrialRow): string | null {
	const provider = trial.provider?.trim();
	return provider ? provider : null;
}

function groupKey(trial: TrialRow): string {
	return [
		trial.task,
		trial.task_version,
		trial.suite_sha256,
		trial.stack,
		trial.harness,
		trial.model,
		providerOf(trial) ?? '',
		trial.tooling_mode,
		trial.auth_mode,
		trial.max_repairs,
		trial.max_parallel
	].join('\u0000');
}

function compareFor(group: readonly TrialRow[], allTrials: readonly TrialRow[]): string | null {
	const first = group[0];
	if (!first) return null;
	const provider = providerOf(first);
	// A harness + model comparison needs one recorded provider. Without one the
	// compare page would refuse the selection, so the profile does not offer a
	// link that cannot show this group.
	if (provider === null) return null;
	return compareHref(
		'/compare/',
		{
			view: 'single',
			task: first.task,
			version: first.task_version,
			tasks: [],
			by: ['harness', 'model'],
			filters: {
				...defaultFilters(),
				harness: [first.harness],
				model: [first.model],
				stack: [first.stack],
				provider: [provider],
				mode: [first.tooling_mode],
				auth: [first.auth_mode],
				repairs: [first.max_repairs],
				parallel: [first.max_parallel],
				suite: first.suite_sha256,
				includeRateLimited: true
			}
		},
		allTrials
	);
}

/** Verified trials whose exact model label is an alias of `model`. */
export function summarizeModelResults(
	model: ModelEntry,
	trials: readonly TrialRow[]
): ModelResults {
	const matched = trials.filter(
		(trial) => trial.verified && modelForTrialId(trial.model) === model
	);

	const grouped = new Map<string, TrialRow[]>();
	for (const trial of matched) {
		const key = groupKey(trial);
		const group = grouped.get(key);
		if (group) group.push(trial);
		else grouped.set(key, [trial]);
	}

	const groups: ModelResultGroup[] = [...grouped.entries()].map(([key, group]) => {
		const first = group[0];
		const times = group
			.filter(
				(trial) => trial.status === 'passed' && !trial.rate_limited && trial.agent_seconds !== null
			)
			.map((trial) => trial.agent_seconds as number);
		return {
			key,
			task: first.task,
			taskVersion: first.task_version,
			suite: first.suite_sha256,
			stack: first.stack,
			harness: first.harness,
			model: first.model,
			provider: providerOf(first),
			toolingMode: first.tooling_mode,
			authMode: first.auth_mode,
			maxRepairs: first.max_repairs,
			maxParallel: first.max_parallel,
			trials: group.length,
			passed: group.filter((trial) => trial.status === 'passed').length,
			rateLimited: group.filter((trial) => trial.rate_limited).length,
			timed: times.length,
			meanSeconds: times.length === 0 ? null : times.reduce((a, b) => a + b, 0) / times.length,
			runs: [...new Set(group.map((trial) => trial.run_id))].sort(),
			compareHref: compareFor(group, trials)
		};
	});

	groups.sort(
		(a, b) =>
			a.task.localeCompare(b.task) ||
			compareVersions(b.taskVersion, a.taskVersion) ||
			a.suite.localeCompare(b.suite) ||
			a.stack.localeCompare(b.stack) ||
			a.harness.localeCompare(b.harness) ||
			a.model.localeCompare(b.model) ||
			(a.provider ?? '').localeCompare(b.provider ?? '')
	);

	return {
		totalTrials: matched.length,
		totalPassed: matched.filter((trial) => trial.status === 'passed').length,
		groups,
		runs: [...new Set(matched.map((trial) => trial.run_id))].sort()
	};
}
