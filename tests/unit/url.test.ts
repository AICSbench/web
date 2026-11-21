import { describe, expect, it } from 'vitest';
import { readExport } from '../../src/lib/load-export.ts';
import { canonicalSearch, parseSelection } from '../../src/lib/compare/url.ts';
import { FIXTURE } from './helpers.ts';

const rows = readExport(FIXTURE).trials;

function roundtrip(search: string): string {
	return canonicalSearch(parseSelection(search, rows), rows);
}

describe('compare URL', () => {
	it('restores the documented example and writes it back unchanged', () => {
		const search = 'task=url-shortener-api&by=harness&model=gpt-6-luna&stack=fastapi-latest';
		expect(roundtrip(search)).toBe(search);
	});

	it('leaves defaults out and keeps non-defaults', () => {
		expect(roundtrip('task=auth-api')).toBe('task=auth-api');
		expect(roundtrip('task=auth-api&verified=1&rl=0')).toBe('task=auth-api');
		expect(roundtrip('task=auth-api&verified=0&rl=1')).toBe('task=auth-api&verified=0&rl=1');
	});

	it('writes parameters in the documented order', () => {
		expect(roundtrip('stack=fastapi-latest&task=auth-api&by=harness&verified=0')).toBe(
			'task=auth-api&by=harness&stack=fastapi-latest&verified=0'
		);
	});

	it('resolves a suite prefix to the full hash', () => {
		expect(roundtrip('task=task-management-api&suite=bdb9517a')).toBe(
			'task=task-management-api&suite=bdb9517ac7138804403bef6c0ea36941de29d5cb1fb51a33448f6360c556d20b'
		);
		const short = parseSelection('task=task-management-api&suite=ffff', rows);
		expect(short.suiteError).toBe('suite must be at least 8 hex characters');
	});

	it('canonicalizes dimension aliases and order', () => {
		expect(roundtrip('task=task-management-api&by=model,harness')).toBe('task=task-management-api');
		expect(roundtrip('task=task-management-api&by=harness_model')).toBe(
			'task=task-management-api&by=harness_model'
		);
	});

	it('keeps the raw model value URL-encoded', () => {
		expect(roundtrip('task=url-shortener-api&by=harness_model&model=openai%2Fgpt-6-luna')).toBe(
			'task=url-shortener-api&by=harness_model&model=openai%2Fgpt-6-luna'
		);
	});

	it('handles matrix task lists and omits the newest version', () => {
		expect(roundtrip('view=matrix&task=auth-api,url-shortener-api@1&by=harness_model')).toBe(
			'view=matrix&task=auth-api,url-shortener-api&by=harness_model'
		);
		expect(roundtrip('view=matrix&task=task-management-api@1&by=harness_model')).toBe(
			'view=matrix&task=task-management-api@1&by=harness_model'
		);
	});

	it('ignores unknown parameters', () => {
		expect(roundtrip('task=auth-api&nonsense=1')).toBe('task=auth-api');
	});

	it('defaults to harness + model, verified only and no rate-limited trials', () => {
		const selection = parseSelection('', rows);
		expect(selection.view).toBe('single');
		expect(selection.by).toEqual(['harness', 'model']);
		expect(selection.filters.verified).toBe(true);
		expect(selection.filters.includeRateLimited).toBe(false);
	});
});
