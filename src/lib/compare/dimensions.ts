// Dimension names and the SQL expression each one groups by. The expressions
// are the only SQL the page builds; query.sql keeps the rest and the filters.
import type { TrialRow } from '#lib/types/export.ts';
import { DIMENSION_LABELS, DIMENSION_ORDER, type Dimension, type Selection } from './types.ts';

/** SQL for each dimension's value, matching TrialResult.dimension_value(). */
export const DIMENSION_SQL: Record<Dimension, string> = {
	harness: 'harness',
	harness_version: "harness || ' ' || coalesce(harness_version, 'unknown')",
	// MODEL groups by the raw model label, not model_key (task 1).
	model: 'model',
	harness_model: "harness || ' + ' || model",
	stack: 'stack',
	language: 'language',
	framework: 'framework',
	provider: "coalesce(provider, 'unknown')"
};

export interface NormalizedDimensions {
	/** Expanded dimensions: harness_model becomes harness + model. */
	dimensions: Dimension[];
	error: string | null;
}

const COVERAGE: Record<Dimension, string[]> = {
	harness: ['harness'],
	harness_version: ['harness'],
	model: ['model'],
	harness_model: ['harness', 'model'],
	stack: ['stack'],
	language: ['stack'],
	framework: ['stack'],
	provider: []
};

/** Python's compare_trials._normalize, including its message order. */
export function normalizeDimensions(requested: readonly string[]): NormalizedDimensions {
	if (requested.length === 0) return { dimensions: [], error: 'compare by at least one dimension' };
	const expanded: Dimension[] = [];
	for (const item of requested) {
		if (!(DIMENSION_ORDER as readonly string[]).includes(item)) {
			return { dimensions: [], error: `unknown comparison dimension: '${item}'` };
		}
		const dimension = item as Dimension;
		if (dimension === 'harness_model') expanded.push('harness', 'model');
		else expanded.push(dimension);
	}
	if (expanded.length > 3) {
		return { dimensions: [], error: 'compare by at most 3 dimensions' };
	}
	for (const item of expanded) {
		if (expanded.filter((other) => other === item).length > 1) {
			return { dimensions: [], error: `comparison dimension repeats: ${item}` };
		}
	}
	const covered = new Map<string, Dimension>();
	for (const item of expanded) {
		for (const axis of COVERAGE[item]) {
			const previous = covered.get(axis);
			if (previous) {
				return {
					dimensions: [],
					error: `dimensions ${previous} and ${item} both group by the ${axis} axis; pick one`
				};
			}
			covered.set(axis, item);
		}
	}
	return { dimensions: expanded, error: null };
}

/** The canonical order for a URL's `by` values. */
export function canonicalDimensions(requested: readonly Dimension[]): Dimension[] {
	if (requested.length === 1 && requested[0] === 'harness_model') return ['harness_model'];
	return [...requested].sort((a, b) => DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b));
}

/** The trial's value on one dimension, matching TrialResult.dimension_value(). */
export function dimensionValue(trial: TrialRow, dimension: Dimension): string {
	switch (dimension) {
		case 'harness':
			return trial.harness;
		case 'harness_version':
			return `${trial.harness} ${trial.harness_version ?? 'unknown'}`;
		case 'model':
			return trial.model;
		case 'harness_model':
			return `${trial.harness} + ${trial.model}`;
		case 'stack':
			return trial.stack;
		case 'language':
			return trial.language;
		case 'framework':
			return trial.framework;
		case 'provider':
			return trial.provider ?? 'unknown';
	}
}

/** A group's row value: the dimension values joined with " + ". */
export function rowValue(trial: TrialRow, dimensions: readonly Dimension[]): string {
	return dimensions.map((dimension) => dimensionValue(trial, dimension)).join(' + ');
}

/** A group's row value for a set of values already extracted. */
export function joinedValue(values: readonly string[]): string {
	return values.join(' + ');
}

/** The label above a comparison table. */
export function dimensionLabel(dimensions: readonly Dimension[]): string {
	if (dimensions.length === 1) return DIMENSION_LABELS[dimensions[0]];
	return dimensions.map((dimension) => DIMENSION_LABELS[dimension].toLowerCase()).join(' + ');
}

/** Python's model_key: lower case, with only OpenCode's provider prefix removed. */
export function modelKey(trial: TrialRow): string {
	const label = trial.model.toLowerCase();
	if (trial.harness === 'opencode') {
		const slash = label.indexOf('/');
		if (slash > 0 && slash < label.length - 1) return label.slice(slash + 1);
	}
	return label;
}

/** SQL expression for the selected dimensions, with the placeholders query.sql expects. */
export function dimensionSql(dimensions: readonly Dimension[]): { value: string; groupBy: string } {
	const expressions = dimensions.map((dimension) => DIMENSION_SQL[dimension]);
	return {
		value: expressions.length === 1 ? expressions[0] : `(${expressions.join(" || ' + ' || ")})`,
		groupBy: expressions.join(', ')
	};
}

/** A selection's canonical `by` value, or the default when it is unchanged. */
export function canonicalBy(selection: Selection): string {
	const dimensions = canonicalDimensions(selection.by);
	return dimensions.join(',');
}
