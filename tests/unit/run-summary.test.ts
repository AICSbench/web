import { describe, expect, it } from 'vitest';
import { groupRunTrials } from '../../src/lib/run-summary.ts';
import type { TrialRow } from '../../src/lib/types/export.ts';

function trial(overrides: Partial<TrialRow> = {}): TrialRow {
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

describe('groupRunTrials', () => {
	it('keeps stacks and harness + model combinations separate', () => {
		const groups = groupRunTrials([
			trial({ stack: 'fastapi-latest', agent_seconds: 100 }),
			trial({ stack: 'fastapi', agent_seconds: 200 }),
			trial({ stack: 'fastapi-latest', harness: 'claude', model: 'claude-opus-5-5' }),
			trial({ stack: 'fastapi-latest', agent_seconds: 140 }),
			trial({ stack: 'fastapi', agent_seconds: null }),
			trial({ stack: 'fastapi', status: 'failed', agent_seconds: 300 })
		]);

		expect(groups.map((group) => group.stack)).toEqual(['fastapi', 'fastapi-latest']);
		expect(groups[0].trials).toHaveLength(3);
		expect(groups[0].rows).toHaveLength(1);
		expect(groups[0].rows[0]).toMatchObject({
			stack: 'fastapi',
			harness: 'codex',
			model: 'gpt-6-luna',
			trials: 3,
			passed: 2,
			pass_rate: 2 / 3,
			timed: 1,
			mean_agent_seconds: 200
		});

		expect(groups[1].rows.map((row) => `${row.harness} + ${row.model}`)).toEqual([
			'claude + claude-opus-5-5',
			'codex + gpt-6-luna'
		]);
		expect(groups[1].rows[1]).toMatchObject({
			trials: 2,
			passed: 2,
			pass_rate: 1,
			timed: 2,
			mean_agent_seconds: 120
		});
		expect(groups[1].rows.reduce((count, row) => count + row.trials, 0)).toBe(3);
		expect(
			groups.flatMap((group) => group.rows).reduce((count, row) => count + row.trials, 0)
		).toBe(6);
	});

	it('averages agent time over passed trials only, and reports unavailable instead of zero', () => {
		const groups = groupRunTrials([
			trial({ trial_id: 'passed-1', agent_seconds: 100 }),
			trial({ trial_id: 'failed', status: 'failed', agent_seconds: 999 }),
			trial({ trial_id: 'passed-2', agent_seconds: 140 })
		]);

		expect(groups[0].rows[0].mean_agent_seconds).toBe(120);
		expect(groups[0].rows[0].timed).toBe(2);

		const untimed = groupRunTrials([
			trial({ trial_id: 'passed', agent_seconds: null }),
			trial({ trial_id: 'failed', status: 'failed', agent_seconds: 999 })
		]);
		expect(untimed[0].rows[0].passed).toBe(1);
		expect(untimed[0].rows[0].timed).toBe(0);
		expect(untimed[0].rows[0].mean_agent_seconds).toBeNull();
	});

	it('leaves rate-limited passed trials out of the mean agent time', () => {
		const groups = groupRunTrials([
			trial({ trial_id: 'limited', rate_limited: true, agent_seconds: 900 }),
			trial({ trial_id: 'timed', agent_seconds: 100 })
		]);

		expect(groups[0].rows[0]).toMatchObject({
			trials: 2,
			passed: 2,
			pass_rate: 1,
			timed: 1,
			mean_agent_seconds: 100
		});
	});

	it('returns no groups for a run without trials', () => {
		expect(groupRunTrials([])).toEqual([]);
	});
});
