import { describe, expect, it } from 'vitest';
import { ExportError, jsonPath, readExport } from '../../src/lib/load-export.ts';
import { axisLabel } from '../../src/lib/format.ts';
import { FIXTURE, editedExport } from './helpers.ts';

describe('readExport', () => {
	it('reads and validates the fixture export', () => {
		const site = readExport(FIXTURE);
		expect(site.info.export_schema).toBe(1);
		expect(site.pages.map((page) => page.kind).sort()).toEqual(
			expect.arrayContaining([
				'home',
				'task',
				'harness',
				'model',
				'stack',
				'leaderboard',
				'run',
				'compare',
				'methodology'
			])
		);
		expect(site.downloads).toContain('data/trials.json');
		expect(site.downloads).toContain('runs/run-verified-001/manifest.json');
	});

	it('refuses an unsupported export_schema, naming both numbers', () => {
		const dir = editedExport((json) => json('export.json', (data) => (data.export_schema = 2)));
		expect(() => readExport(dir)).toThrow(ExportError);
		expect(() => readExport(dir)).toThrow(
			/export\.json: export_schema 2 is not supported; this site supports export_schema 1/
		);
	});

	it('names the file and JSON path of a trial row that breaks the schema', () => {
		const dir = editedExport((json) =>
			json('data/trials.json', (rows) => (rows[3].agent_seconds = 'fast'))
		);
		expect(() => readExport(dir)).toThrow(
			/data\/trials\.json: does not match schema\/trials\.schema\.json: \$\[3\]\.agent_seconds: must be number/
		);
	});

	it('rejects keys the schema does not know', () => {
		const dir = editedExport((json) =>
			json('pages.json', (data) => (data.pages[4].sections[0].colour = 'red'))
		);
		expect(() => readExport(dir)).toThrow(
			/pages\.json: does not match schema\/pages\.schema\.json: \$\.pages\[4\]\.sections\[0\]: unexpected key "colour"/
		);
	});

	it('accepts rows with the additive framework_version_changed key when the schema has it', () => {
		const dir = editedExport((json) => {
			json('schema/trials.schema.json', (schema) => {
				schema.$defs.TrialRow.properties.framework_version_changed = {
					anyOf: [{ type: 'boolean' }, { type: 'null' }],
					default: null
				};
			});
			json('data/trials.json', (rows) => (rows[0].framework_version_changed = true));
		});
		expect(readExport(dir).trials[0]).toMatchObject({ framework_version_changed: true });
	});
});

describe('run submissions', () => {
	it('refuses a submission without a boolean logs_included or a platform_version', () => {
		for (const change of [
			(data: any) => (data.logs_included = 'yes'),
			(data: any) => delete data.platform_version
		]) {
			const dir = editedExport((json) =>
				json('runs/run-verified-001/submission.json', (data) => {
					change(data);
				})
			);
			expect(() => readExport(dir).submission('run-verified-001')).toThrow(
				/run-verified-001\/submission\.json: missing or invalid .*platform_version or logs_included/
			);
		}
	});
});

describe('axisLabel', () => {
	it('labels known axes and shows any other axis as is', () => {
		expect(axisLabel('harness_model')).toBe('Harness + model');
		expect(axisLabel('constructor')).toBe('constructor');
		expect(axisLabel('toString')).toBe('toString');
	});
});

describe('jsonPath', () => {
	it('turns JSON Pointers into readable paths', () => {
		expect(jsonPath('')).toBe('$');
		expect(jsonPath('/pages/3/title')).toBe('$.pages[3].title');
		expect(jsonPath('/fixed/a~1b')).toBe('$.fixed["a/b"]');
	});
});
