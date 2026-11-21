// The compare page's refusals. Messages and order mirror
// comparison.compare_trials; the suite refusal is the one compare_matrix adds
// per column. When a selection is refused the page shows the message instead of
// a table and highlights the filter to change.
import type { TrialRow } from '#lib/types/export.ts';
import { dimensionValue, modelKey, normalizeDimensions, rowValue } from './dimensions.ts';
import type { Dimension } from './types.ts';

export const SUITE_REFUSAL = 'comparison mixes acceptance suites; pick one suite';
const HARNESS_VERSION_REFUSAL =
	'harness version comparison mixes harnesses, models or stacks; filter to one of each';
const PROVIDER_REFUSAL = 'harness comparison mixes providers; filter to one provider';
const UNKNOWN_PROVIDER_REFUSAL =
	'harness comparison needs a recorded provider; exclude trials recorded before provider tracking';

const SINGLE_PROVIDER_DIMENSIONS: ReadonlySet<Dimension> = new Set(['harness', 'harness_version']);

function comparabilityKey(trial: TrialRow): string {
	return [
		trial.task,
		trial.task_version,
		trial.tooling_mode,
		trial.auth_mode,
		trial.max_repairs,
		trial.max_parallel
	].join('\u0000');
}

function groupsHarnessAndModel(dimensions: readonly Dimension[]): boolean {
	return dimensions.includes('model') && dimensions.includes('harness');
}

function joinAxes(axes: readonly string[], plural: boolean): string {
	const names = axes.map((axis) =>
		plural ? ({ harness: 'harnesses', model: 'models', stack: 'stacks' } as const)[axis] : axis
	);
	if (names.length === 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function exact(dimensions: readonly Dimension[], ...wanted: Dimension[]): boolean {
	return dimensions.length === wanted.length && wanted.every((item) => dimensions.includes(item));
}

function checkValues(dimensions: readonly Dimension[], trials: readonly TrialRow[]): string | null {
	const harnesses = new Set(trials.map((trial) => trial.harness));
	const models = new Set(trials.map((trial) => modelKey(trial)));
	const stacks = new Set(trials.map((trial) => trial.stack));
	const providers = new Set(trials.map((trial) => trial.provider ?? null));

	if (
		(exact(dimensions, 'harness_version') || exact(dimensions, 'provider')) &&
		(harnesses.size > 1 || models.size > 1 || stacks.size > 1)
	) {
		return HARNESS_VERSION_REFUSAL;
	}

	if (
		dimensions.some((dimension) => SINGLE_PROVIDER_DIMENSIONS.has(dimension)) &&
		!dimensions.includes('provider')
	) {
		if (providers.has(null)) return UNKNOWN_PROVIDER_REFUSAL;
		if (groupsHarnessAndModel(dimensions)) {
			const perRow = new Map<string, Set<string | null>>();
			for (const trial of trials) {
				const key = dimensions.map((dimension) => dimensionValue(trial, dimension)).join('\u0000');
				const seen = perRow.get(key) ?? new Set<string | null>();
				seen.add(trial.provider ?? null);
				perRow.set(key, seen);
			}
			if ([...perRow.values()].some((seen) => seen.size > 1)) return PROVIDER_REFUSAL;
		} else if (providers.size > 1) {
			return PROVIDER_REFUSAL;
		}
	}

	const covered = new Set<string>();
	for (const dimension of dimensions) {
		if (dimension === 'harness' || dimension === 'harness_version') covered.add('harness');
		if (dimension === 'model') covered.add('model');
		if (dimension === 'harness_model') {
			covered.add('harness');
			covered.add('model');
		}
		if (dimension === 'stack' || dimension === 'language' || dimension === 'framework') {
			covered.add('stack');
		}
	}
	const mixed = (
		[
			['harness', harnesses],
			['model', models],
			['stack', stacks]
		] as const
	)
		.filter(([axis, values]) => !covered.has(axis) && values.size > 1)
		.map(([axis]) => axis);
	if (mixed.length > 0) {
		return `${dimensions.join(' + ')} comparison mixes ${joinAxes(mixed, true)}; filter to one ${joinAxes(mixed, false)}`;
	}
	return null;
}

function checkVersionedNames(
	dimensions: readonly Dimension[],
	trials: readonly TrialRow[]
): string | null {
	const groups = new Map<string, TrialRow[]>();
	for (const trial of trials) {
		const key = dimensions.map((dimension) => dimensionValue(trial, dimension)).join('\u0000');
		const group = groups.get(key) ?? [];
		group.push(trial);
		groups.set(key, group);
	}
	for (const name of ['framework', 'language'] as const) {
		if (!dimensions.includes(name)) continue;
		for (const group of groups.values()) {
			const versions = new Set(
				group.map((trial) =>
					name === 'framework' ? trial.framework_version : trial.language_version
				)
			);
			if (versions.size > 1) {
				return `${name} comparison mixes versions of one ${name}; compare by stack or filter to one version`;
			}
		}
	}
	return null;
}

/** The compare_trials refusal for this selection, or null. */
export function compareRefusal(
	trials: readonly TrialRow[],
	requested: readonly string[]
): string | null {
	const keys = new Set(trials.map(comparabilityKey));
	if (keys.size > 1) {
		return 'results mix task/version, tooling mode, auth mode, repair budget, or parallelism; filter to one set';
	}
	const normalized = normalizeDimensions(requested);
	if (normalized.error !== null) return normalized.error;
	const valueRefusal = checkValues(normalized.dimensions, trials);
	if (valueRefusal !== null) return valueRefusal;
	return checkVersionedNames(normalized.dimensions, trials);
}

/** compareRefusal plus the per-column acceptance-suite rule. */
export function refusal(trials: readonly TrialRow[], requested: readonly string[]): string | null {
	if (new Set(trials.map((trial) => trial.suite_sha256)).size > 1) return SUITE_REFUSAL;
	return compareRefusal(trials, requested);
}

/** The filter that can resolve a refusal, for the page's highlight. */
export function refusalFilter(message: string): string | null {
	if (message.includes('acceptance suites')) return 'suite';
	if (message.includes('mixes providers') || message.includes('recorded provider'))
		return 'provider';
	if (message.includes('results mix task/version')) return 'mode,auth,repairs,parallel';
	if (message.includes('harness version comparison')) return 'harness,model,stack';
	if (message.includes('mixes harnesses') && message.includes('models')) return 'harness,model';
	if (message.includes('mixes harnesses')) return 'harness';
	if (message.includes('mixes models')) return 'model';
	if (message.includes('mixes stacks')) return 'stack';
	if (
		message.includes('versions of one framework') ||
		message.includes('versions of one language')
	) {
		return 'stack';
	}
	if (message.includes('compare by at most 3') || message.includes('compare by at least one')) {
		return 'by';
	}
	return null;
}

/** A row value for a set of dimensions; exported for tests and the page. */
export function groupValue(trial: TrialRow, dimensions: readonly Dimension[]): string {
	return rowValue(trial, dimensions);
}
