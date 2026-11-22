import { describe, expect, it } from 'vitest';
import { groupRunTrials, runInsights } from '../../src/lib/run-summary.ts';
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

describe('runInsights', () => {
	it('compares only stacks in one setup and excludes rate-limited trials from the mean', () => {
		const insights = runInsights(
			[
				trial({ trial_id: 'f1', stack: 'fastapi', agent_seconds: 100 }),
				trial({ trial_id: 'f2', stack: 'fastapi', agent_seconds: 110 }),
				trial({ trial_id: 'f3', stack: 'fastapi', agent_seconds: 120 }),
				trial({
					trial_id: 'f4',
					stack: 'fastapi',
					agent_seconds: 900,
					rate_limited: true
				}),
				trial({ trial_id: 'l1', stack: 'laravel', agent_seconds: 200 }),
				trial({ trial_id: 'l2', stack: 'laravel', agent_seconds: 210 }),
				trial({ trial_id: 'l3', stack: 'laravel', agent_seconds: 220 })
			],
			'Task Management REST API'
		);
		const text = insights.join('\n');

		expect(text).toContain(
			'Task Management REST API version 1 (acceptance suite aaaaaaaa) has 7 verified trials across 2 stacks and 1 setup variant.'
		);
		expect(text).toContain('7 of 7 trials passed (100% pass rate)');
		expect(text).toContain(
			'fastapi recorded the lowest mean agent time at 1m 50s across 3 timed passing trials'
		);
		expect(text).toContain('versus 3m 30s for laravel (3 timed passing trials)');
		expect(text).toContain(
			'The comparison covers 2 stacks with at least 2 timed passing trials each.'
		);
		expect(text).toContain('The compared stacks had the same 100% pass rate');
		expect(text).not.toContain('directional');
	});

	it('does not compare stacks that differ in harness or model', () => {
		const insights = runInsights(
			[
				trial({ stack: 'fastapi', harness: 'codex', model: 'gpt-6-luna', agent_seconds: 100 }),
				trial({ stack: 'fastapi', harness: 'codex', model: 'gpt-6-luna', agent_seconds: 110 }),
				trial({ stack: 'fastapi', harness: 'codex', model: 'gpt-6-luna', agent_seconds: 120 }),
				trial({
					stack: 'laravel',
					harness: 'claude',
					model: 'claude-opus-5-5',
					agent_seconds: 200
				}),
				trial({
					stack: 'laravel',
					harness: 'claude',
					model: 'claude-opus-5-5',
					agent_seconds: 210
				}),
				trial({
					stack: 'laravel',
					harness: 'claude',
					model: 'claude-opus-5-5',
					agent_seconds: 220
				})
			],
			'Task'
		);
		const text = insights.join('\n');

		expect(text).not.toContain('lowest mean agent time');
		expect(text).toContain("The run's 2 stacks do not share a comparable setup");
		expect(text).toContain('The best-covered setup is');
	});

	it('calls small samples directional and explains the pass-rate trade-off', () => {
		const insights = runInsights(
			[
				trial({ trial_id: 'f1', stack: 'fastapi', agent_seconds: 100 }),
				trial({ trial_id: 'f2', stack: 'fastapi', agent_seconds: 110 }),
				trial({ trial_id: 'f3', stack: 'fastapi', status: 'failed', agent_seconds: 90 }),
				trial({ trial_id: 'l1', stack: 'laravel', agent_seconds: 200 }),
				trial({ trial_id: 'l2', stack: 'laravel', agent_seconds: 210 }),
				trial({ trial_id: 'l3', stack: 'laravel', agent_seconds: 220 })
			],
			'Task'
		);
		const text = insights.join('\n');

		expect(text).toContain(
			'fastapi recorded the lowest mean agent time at 1m 45s across 2 timed passing trials'
		);
		expect(text).toContain('versus 3m 30s for laravel (3 timed passing trials)');
		expect(text).toContain(
			'The trade-off is reliability: laravel passed 3 of 3 trials (100%), while fastapi passed 2 of 3 (66.7%).'
		);
		expect(text).toContain('directional rather than a confident ranking');
	});

	it('never compares verified and community trials', () => {
		const insights = runInsights(
			[trial({ stack: 'fastapi', verified: true }), trial({ stack: 'laravel', verified: false })],
			'Task'
		);

		expect(insights).toHaveLength(1);
		expect(insights[0]).toContain('both verified and community trials');
		expect(insights[0]).not.toContain('mean agent time');
	});

	it('never compares across task versions or acceptance suites', () => {
		const insights = runInsights(
			[
				trial({ stack: 'fastapi', task_version: '1', suite_sha256: 'a'.repeat(64) }),
				trial({ stack: 'laravel', task_version: '2', suite_sha256: 'b'.repeat(64) })
			],
			'Task'
		);

		expect(insights).toHaveLength(1);
		expect(insights[0]).toContain('more than one task, version, or acceptance suite');
	});

	it('compares pass rates without inventing a duration when timing is missing', () => {
		const insights = runInsights(
			[
				trial({ trial_id: 'f1', stack: 'fastapi', agent_seconds: null }),
				trial({ trial_id: 'f2', stack: 'fastapi', agent_seconds: null }),
				trial({ trial_id: 'l1', stack: 'laravel', agent_seconds: null }),
				trial({
					trial_id: 'l2',
					stack: 'laravel',
					status: 'failed',
					agent_seconds: null
				})
			],
			'Task'
		);
		const text = insights.join('\n');

		expect(text).toContain(
			'fastapi had the highest pass rate at 100% (2/2), compared with 50% (1/2) for laravel'
		);
		expect(text).toContain(
			'No stack in this setup has at least 2 timed passing trials, so no mean agent time is compared.'
		);
		expect(text).toContain('Treat this pass-rate gap as directional');
		expect(text).not.toContain('mean agent time of');
	});

	it('picks the setup that actually has two comparable stacks', () => {
		const insights = runInsights(
			[
				trial({ trial_id: 'a1', stack: 'fastapi', harness: 'aaa', agent_seconds: null }),
				trial({ trial_id: 'a2', stack: 'fastapi', harness: 'aaa', agent_seconds: null }),
				trial({ trial_id: 'a3', stack: 'fastapi', harness: 'aaa', agent_seconds: null }),
				trial({ trial_id: 'a4', stack: 'laravel', harness: 'aaa', agent_seconds: null }),
				trial({ trial_id: 'b1', stack: 'fastapi', harness: 'zzz', agent_seconds: null }),
				trial({ trial_id: 'b2', stack: 'fastapi', harness: 'zzz', agent_seconds: null }),
				trial({ trial_id: 'b3', stack: 'laravel', harness: 'zzz', agent_seconds: null }),
				trial({ trial_id: 'b4', stack: 'laravel', harness: 'zzz', agent_seconds: null })
			],
			'Task'
		);
		const text = insights.join('\n');

		expect(text).toContain(
			'Within the best-covered comparable setup (zzz + gpt-6-luna via openai)'
		);
		expect(text).toContain('both had a 100% pass rate');
		expect(text).not.toContain('No two stacks in this run share');
	});

	it('does not rank stacks with the same pass rate when timing is missing', () => {
		const insights = runInsights(
			[
				trial({ trial_id: 'f1', stack: 'fastapi', agent_seconds: null }),
				trial({ trial_id: 'f2', stack: 'fastapi', agent_seconds: null }),
				trial({ trial_id: 'l1', stack: 'laravel', agent_seconds: null }),
				trial({ trial_id: 'l2', stack: 'laravel', agent_seconds: null })
			],
			'Task'
		);
		const text = insights.join('\n');

		expect(text).toContain('both had a 100% pass rate');
		expect(text).toContain('does not support a stack ranking');
	});

	it('returns no insights for a run without trials', () => {
		expect(runInsights([], 'Task')).toEqual([]);
	});
});
