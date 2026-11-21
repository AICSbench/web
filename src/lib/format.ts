// Display formatting only. Every number comes from the export as is.

const percentFormat = new Intl.NumberFormat('en-US', {
	style: 'percent',
	maximumFractionDigits: 1
});

/** 0.6666 -> "66.7%". */
export function percent(rate: number): string {
	return percentFormat.format(rate);
}

/** 630 -> "10m 30s", 42.4 -> "42s". */
export function duration(seconds: number): string {
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = total % 60;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${rest}s`;
	return `${rest}s`;
}

/** 0.4213 -> "$0.42". */
export function usd(value: number): string {
	return value < 0.01 && value > 0 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

/** "2026-11-19T00:00:00Z" -> "2026-11-19". */
export function day(iso: string): string {
	return iso.slice(0, 10);
}

/** Section axis (`by`) to a column label. */
export function axisLabel(by: string): string {
	const labels: Record<string, string> = {
		harness_model: 'Harness + model',
		harness: 'Harness',
		harness_version: 'Harness version',
		model: 'Model',
		stack: 'Stack',
		language: 'Language',
		framework: 'Framework',
		provider: 'Provider',
		task: 'Task'
	};
	return Object.hasOwn(labels, by) ? labels[by] : by;
}

/** A provider slug for display; legacy trials have no recorded provider. */
export function providerLabel(provider: string): string {
	return provider === 'unknown' ? 'provider not recorded' : provider;
}

/** Labels for the values a section holds fixed. */
export const FIXED_LABELS: Record<string, string> = {
	task: 'Task',
	task_version: 'Version',
	tooling_mode: 'Tooling',
	auth_mode: 'Auth',
	max_repairs: 'Repairs',
	max_parallel: 'Parallel',
	suite_sha256: 'Suite',
	stack: 'Stack',
	harness: 'Harness',
	model: 'Model',
	provider: 'Provider'
};

/**
 * True when core recorded that the installed framework changed during the trial
 * (`framework_version_changed`, added to the export by task 8). Read the flag only:
 * comparing framework_version with framework_version_installed mislabels stacks that
 * take no version. Exports from before task 8 have no key, which counts as not checked.
 */
export function versionChanged(trial: object): boolean {
	return (
		(trial as { framework_version_changed?: boolean | null }).framework_version_changed === true
	);
}
