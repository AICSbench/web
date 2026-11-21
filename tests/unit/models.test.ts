import { describe, expect, it } from 'vitest';
import { canonicalSearch, parseSelection } from '../../src/lib/compare/url.ts';
import { matchesFilters, newestVersion } from '../../src/lib/compare/filters.ts';
import { refusal } from '../../src/lib/compare/refusals.ts';
import { readExport } from '../../src/lib/load-export.ts';
import {
	MODEL_CATALOG,
	baselineTier,
	modelBySlug,
	modelForTrialId,
	modelPaths,
	profileForRowValue
} from '../../src/lib/models/catalog.ts';
import { summarizeModelResults } from '../../src/lib/models/results.ts';
import type { TrialRow } from '../../src/lib/types/export.ts';
import { FIXTURE } from './helpers.ts';

const rows = readExport(FIXTURE).trials;
const luna = modelBySlug('gpt-6-luna')!;
const glm = modelBySlug('glm-5.3-flash')!;
const deepseek = modelBySlug('deepseek-v4.1-flash')!;

describe('model catalog', () => {
	it('has one baseline tier and sources for every entry', () => {
		expect(MODEL_CATALOG.map((model) => model.slug)).toEqual([
			'gpt-6-luna',
			'glm-5.3-flash',
			'deepseek-v4.1-flash'
		]);
		for (const model of MODEL_CATALOG) {
			expect(
				model.pricing.tiers.filter((tier) => tier.baseline),
				model.slug
			).toHaveLength(1);
			expect(baselineTier(model).baseline).toBe(true);
			expect(model.pricing.checkedAt, model.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(model.sources.length, model.slug).toBeGreaterThan(0);
		}
	});

	it('resolves only the exact IDs the catalog lists', () => {
		expect(modelForTrialId('gpt-6-luna')).toBe(luna);
		expect(modelForTrialId('GPT-6-LUNA')).toBe(luna);
		expect(modelForTrialId('  openai/gpt-6-luna  ')).toBe(luna);
		expect(modelForTrialId('openai/gpt-6-luna')).toBe(luna);

		// Distinct variants, removed aliases and unlisted IDs are not guessed.
		expect(modelForTrialId('openai/gpt-6-luna:batch')).toBeNull();
		expect(modelForTrialId('openai/gpt-6-luna-pro')).toBeNull();
		expect(modelForTrialId('gpt-6-luna-latest')).toBeNull();
		expect(modelForTrialId('vendor/gpt-6-luna')).toBeNull();

		expect(modelForTrialId('z-ai/glm-5.3-flash')).toBe(glm);
		expect(modelForTrialId('glm-5.3-flash')).toBe(glm);
		expect(modelForTrialId('z-ai/glm-5.3-flashx')).toBeNull();
		expect(modelForTrialId('glm-5.3-flashx')).toBeNull();
		expect(modelForTrialId('glm-5.3-flash-not-listed')).toBeNull();

		expect(modelForTrialId('deepseek-flash')).toBe(deepseek);
		expect(modelForTrialId('deepseek/deepseek-v4.1-flash-1017')).toBe(deepseek);
		expect(modelForTrialId('deepseek-v4.1-flash-1017')).toBe(deepseek);
		expect(modelForTrialId('deepseek/deepseek-v4.1-flash')).toBeNull();
		expect(modelForTrialId('deepseek/deepseek-v4.1-flash-1017:batch')).toBeNull();

		for (const id of ['', 'default', 'openrouter/auto', null, undefined]) {
			expect(modelForTrialId(id)).toBeNull();
		}
	});

	it('maps a benchmark row only when its model is unambiguous', () => {
		expect(profileForRowValue('model', 'gpt-6-luna')).toBe(luna);
		expect(profileForRowValue('model', 'openai/gpt-6-luna')).toBe(luna);
		expect(profileForRowValue('harness_model', 'codex + gpt-6-luna')).toBe(luna);
		expect(profileForRowValue('harness_model', 'codex + openai/gpt-6-luna')).toBe(luna);
		expect(profileForRowValue('harness_model', 'codex + z-ai/glm-5.3-flashx')).toBeNull();
		expect(profileForRowValue('harness', 'gpt-6-luna')).toBeNull();
	});

	it('adds the index and one stable path per profile', () => {
		expect(modelPaths()).toEqual([
			'/models/',
			'/models/gpt-6-luna/',
			'/models/glm-5.3-flash/',
			'/models/deepseek-v4.1-flash/'
		]);
	});
});

describe('model results', () => {
	it('summarizes verified trials by task, suite, stack, harness and provider', () => {
		const results = summarizeModelResults(luna, rows);
		expect(results.totalTrials).toBe(20);
		expect(results.totalPassed).toBe(18);
		expect(results.groups).toHaveLength(8);
		expect(results.runs).toEqual([
			'run-auth-001',
			'run-notes-001',
			'run-suite-b-001',
			'run-url-001',
			'run-verified-001'
		]);

		const codex = results.groups.find(
			(group) => group.task === 'auth-api' && group.harness === 'codex'
		)!;
		expect(codex).toMatchObject({
			taskVersion: '1',
			stack: 'fastapi-latest',
			model: 'gpt-6-luna',
			provider: 'openai',
			trials: 3,
			passed: 3,
			rateLimited: 0,
			timed: 3,
			meanSeconds: 210
		});

		const opencode = results.groups.find(
			(group) => group.task === 'auth-api' && group.harness === 'opencode'
		)!;
		expect(opencode).toMatchObject({
			model: 'openai/gpt-6-luna',
			trials: 3,
			passed: 2,
			rateLimited: 1,
			timed: 2,
			meanSeconds: 235
		});

		// The same task/harness split by provider instead of pooling both.
		expect(
			results.groups
				.filter((group) => group.task === 'notes-api')
				.map((group) => [group.provider, group.trials, group.passed, group.meanSeconds])
		).toEqual([
			['openai', 3, 3, 510],
			['openrouter', 1, 1, 530]
		]);

		// Two acceptance suites on one task version stay as two groups.
		const suites = results.groups
			.filter((group) => group.task === 'task-management-api')
			.map((group) => [group.suite.slice(0, 8), group.trials, group.passed]);
		expect(suites).toEqual([
			['bdb9517a', 3, 2],
			['ffffffff', 2, 2]
		]);
	});

	it('builds Compare links that restore the same group and are not refused', () => {
		const results = summarizeModelResults(luna, rows);
		for (const group of results.groups) {
			expect(group.compareHref, group.task).not.toBeNull();
			const url = new URL(group.compareHref!, 'https://example.test');
			expect(url.pathname).toBe('/compare/');
			const selection = parseSelection(url.search, rows);
			expect(selection.suiteError, group.task).toBeNull();
			expect(selection.task).toBe(group.task);
			expect(selection.version === null || selection.version === group.taskVersion).toBe(true);
			expect(selection.filters.harness).toEqual([group.harness]);
			expect(selection.filters.model).toEqual([group.model]);
			expect(selection.filters.stack).toEqual([group.stack]);
			expect(selection.filters.provider).toEqual([group.provider]);
			expect(selection.filters.mode).toEqual([group.toolingMode]);
			expect(selection.filters.auth).toEqual([group.authMode]);
			expect(selection.filters.repairs).toEqual([group.maxRepairs]);
			expect(selection.filters.parallel).toEqual([group.maxParallel]);
			expect(selection.filters.includeRateLimited).toBe(true);
			if (selection.filters.suite !== null) expect(selection.filters.suite).toBe(group.suite);

			// The page's own path: filter the rows, pick the version, then ask the
			// same refusal function the compare page uses.
			const version = selection.version ?? newestVersion(rows, selection.task!, selection.filters);
			const compared = rows.filter(
				(trial) =>
					trial.task === selection.task &&
					trial.task_version === version &&
					matchesFilters(trial, selection.filters)
			);
			expect(compared, group.task).toHaveLength(group.trials);
			expect(compared.filter((trial) => trial.status === 'passed')).toHaveLength(group.passed);
			expect(refusal(compared, selection.by), group.task).toBeNull();
			expect(canonicalSearch(selection, rows)).toBe(url.search.slice(1));
		}
	});

	it('does not attribute unknown IDs, defaults, or distinct variants', () => {
		const base = rows.find((row) => row.verified && row.model === 'gpt-6-luna')!;
		const withModel = (model: string, extra: Partial<TrialRow> = {}): TrialRow => ({
			...base,
			model,
			run_id: `run-${model.replaceAll('/', '-')}`,
			...extra
		});
		const synthetic = [
			withModel('z-ai/glm-5.3-flash'),
			withModel('z-ai/glm-5.3-flashx'),
			withModel('glm-5.3-flash-not-listed'),
			withModel('default'),
			withModel('z-ai/glm-5.3-flash', { verified: false })
		];
		const results = summarizeModelResults(glm, synthetic);
		expect(results.totalTrials).toBe(1);
		expect(results.groups[0].model).toBe('z-ai/glm-5.3-flash');
		expect(results.runs).toEqual(['run-z-ai-glm-5.3-flash']);

		const deepseekResults = summarizeModelResults(deepseek, [
			withModel('deepseek/deepseek-v4.1-flash'),
			withModel('deepseek/deepseek-v4.1-flash-1017')
		]);
		expect(deepseekResults.totalTrials).toBe(1);
		expect(deepseekResults.groups[0].model).toBe('deepseek/deepseek-v4.1-flash-1017');
	});

	it('shows no results instead of a zero score when no verified trial matches', () => {
		expect(summarizeModelResults(glm, rows)).toEqual({
			totalTrials: 0,
			totalPassed: 0,
			groups: [],
			runs: []
		});
	});
});
