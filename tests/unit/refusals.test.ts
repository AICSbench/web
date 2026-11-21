import { describe, expect, it } from 'vitest';
import { dimensionValue, modelKey } from '../../src/lib/compare/dimensions.ts';
import { matchesFilters } from '../../src/lib/compare/filters.ts';
import {
	compareRefusal,
	refusal,
	refusalFilter,
	SUITE_REFUSAL
} from '../../src/lib/compare/refusals.ts';
import type { FilterState } from '../../src/lib/compare/types.ts';
import type { TrialRow } from '../../src/lib/types/export.ts';
import { defaultFilters } from '../../src/lib/compare/url.ts';

function row(overrides: Partial<TrialRow> = {}): TrialRow {
	return {
		run_id: 'r1',
		trial_id: 't1',
		trial_index: 0,
		max_repairs: 0,
		max_parallel: 1,
		task: 'task',
		task_version: '1',
		agent: 'codex',
		model: 'gpt-6-luna',
		stack: 'fastapi',
		language: 'python',
		language_version: '3.13',
		framework: 'fastapi',
		framework_version: '0.129',
		tooling_mode: 'standard',
		auth_mode: 'subscription',
		status: 'passed',
		rate_limited: false,
		agent_seconds: 100,
		wall_seconds: null,
		tests_passed: null,
		tests_failed: null,
		tests_total: null,
		repair_iterations: null,
		token_scheme: null,
		input_tokens: null,
		cached_input_tokens: null,
		output_tokens: null,
		reasoning_tokens: null,
		total_tokens: null,
		cost_usd: null,
		cost_availability: 'unavailable',
		harness: 'codex',
		harness_version: '0.167.2',
		requested_model: 'gpt-6-luna',
		reasoning_effort: null,
		language_version_installed: null,
		framework_version_installed: null,
		provider: 'openai',
		endpoint_host: null,
		verified: true,
		logs_available: false,
		suite_sha256: 'a'.repeat(64),
		submitted_at: '2026-11-20T00:00:00Z',
		submitter: 'fixture',
		...overrides
	};
}

function filters(overrides: Partial<FilterState> = {}): FilterState {
	return { ...defaultFilters(), ...overrides };
}

describe('refusals mirror compare_trials', () => {
	it('refuses a selection mixing acceptance suites', () => {
		expect(refusal([row(), row({ suite_sha256: 'b'.repeat(64) })], ['harness'])).toBe(
			SUITE_REFUSAL
		);
	});

	it('refuses mixed comparability keys', () => {
		expect(refusal([row(), row({ max_repairs: 1 })], ['harness'])).toBe(
			'results mix task/version, tooling mode, auth mode, repair budget, or parallelism; filter to one set'
		);
	});

	it('refuses a harness comparison across providers', () => {
		const direct = row({ provider: 'openai' });
		const gateway = row({ provider: 'openrouter', endpoint_host: 'openrouter.ai' });
		expect(compareRefusal([direct, gateway], ['harness'])).toBe(
			'harness comparison mixes providers; filter to one provider'
		);
	});

	it('refuses a harness comparison when any provider is unknown', () => {
		expect(compareRefusal([row({ provider: null })], ['harness'])).toBe(
			'harness comparison needs a recorded provider; exclude trials recorded before provider tracking'
		);
	});

	it('refuses one harness + model row that pools a direct and a gateway run', () => {
		expect(
			compareRefusal(
				[
					row({ provider: 'openai' }),
					row({ provider: 'openrouter', endpoint_host: 'openrouter.ai' })
				],
				['harness_model']
			)
		).toBe('harness comparison mixes providers; filter to one provider');
	});

	it('allows harness + model rows to use different providers', () => {
		expect(
			compareRefusal(
				[
					row({ harness: 'claude', model: 'claude-opus-5-5', provider: 'anthropic' }),
					row({ harness: 'codex', model: 'gpt-6-luna', provider: 'openai' })
				],
				['harness_model']
			)
		).toBeNull();
	});

	it('groups an explicit provider dimension, including unknown', () => {
		expect(
			compareRefusal(
				[row({ provider: null }), row({ provider: 'openrouter', endpoint_host: 'openrouter.ai' })],
				['harness', 'provider']
			)
		).toBeNull();
	});

	it('needs one harness, model and stack for a provider comparison', () => {
		expect(
			compareRefusal(
				[row({ harness: 'codex' }), row({ harness: 'opencode', model: 'openai/gpt-6-luna' })],
				['provider']
			)
		).toBe('harness version comparison mixes harnesses, models or stacks; filter to one of each');
	});

	it('refuses a harness version comparison over several harnesses', () => {
		expect(compareRefusal([row(), row({ harness: 'claude' })], ['harness_version'])).toBe(
			'harness version comparison mixes harnesses, models or stacks; filter to one of each'
		);
	});

	it('refuses a model comparison over several harnesses', () => {
		expect(compareRefusal([row(), row({ harness: 'claude' })], ['model'])).toBe(
			'model comparison mixes harnesses; filter to one harness'
		);
	});

	it('refuses a stack comparison over several harness + model pairs', () => {
		expect(
			compareRefusal(
				[row({ harness: 'codex' }), row({ harness: 'claude', model: 'claude-opus-5-5' })],
				['stack']
			)
		).toBe('stack comparison mixes harnesses and models; filter to one harness and model');
	});

	it('refuses a framework comparison that pools declared versions', () => {
		expect(
			compareRefusal(
				[row({ framework_version: '0.129' }), row({ framework_version: '0.130' })],
				['framework']
			)
		).toBe(
			'framework comparison mixes versions of one framework; compare by stack or filter to one version'
		);
	});

	it('refuses a language comparison that pools declared versions', () => {
		expect(
			compareRefusal(
				[row({ language_version: '3.13' }), row({ language_version: '3.12' })],
				['language']
			)
		).toBe(
			'language comparison mixes versions of one language; compare by stack or filter to one version'
		);
	});

	it('rejects more than three dimensions, repeats and overlapping axes', () => {
		expect(compareRefusal([row()], ['harness', 'model', 'stack', 'language'])).toBe(
			'compare by at most 3 dimensions'
		);
		expect(compareRefusal([row()], ['harness', 'harness'])).toBe(
			'comparison dimension repeats: harness'
		);
		expect(compareRefusal([row()], ['stack', 'language'])).toBe(
			'dimensions stack and language both group by the stack axis; pick one'
		);
	});

	it('accepts one provider for a pure harness comparison', () => {
		expect(compareRefusal([row(), row({ trial_id: 't2' })], ['harness'])).toBeNull();
	});
});

describe('model filter', () => {
	it('groups by the raw model label but filters by model key', () => {
		const opencode = row({ harness: 'opencode', model: 'openai/gpt-6-luna' });
		const codex = row({ harness: 'codex', model: 'gpt-6-luna' });
		expect(dimensionValue(opencode, 'model')).toBe('openai/gpt-6-luna');
		expect(dimensionValue(codex, 'model')).toBe('gpt-6-luna');
		expect(modelKey(opencode)).toBe('gpt-6-luna');
		expect(modelKey(codex)).toBe('gpt-6-luna');
	});

	it('matches OpenCode model keys but keeps another harness gateway prefix', () => {
		const opencode = row({ harness: 'opencode', model: 'openai/gpt-6-luna' });
		const codex = row({ harness: 'codex', model: 'openai/gpt-6-luna' });
		expect(matchesFilters(opencode, filters({ model: ['gpt-6-luna'] }))).toBe(true);
		expect(matchesFilters(codex, filters({ model: ['gpt-6-luna'] }))).toBe(false);
		expect(matchesFilters(codex, filters({ model: ['openai/gpt-6-luna'] }))).toBe(true);
	});
});

describe('refusal hints', () => {
	it('names the filter to change', () => {
		expect(refusalFilter(SUITE_REFUSAL)).toBe('suite');
		expect(refusalFilter('harness comparison mixes providers; filter to one provider')).toBe(
			'provider'
		);
		expect(refusalFilter('model comparison mixes harnesses; filter to one harness')).toBe(
			'harness'
		);
	});
});
