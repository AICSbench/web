// Builds the e2e export: the fixture plus one verified trial that differs from
// an existing group only in repair budget. The profile page must hydrate two
// distinct keyed groups from this export.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const BUILD_DIR = '/tmp/aicsbench-e2e-build';
const fixture = resolve('tests/fixtures/export');
const exportDir = mkdtempSync(join(tmpdir(), 'aicsbench-e2e-export-'));

/**
 * @typedef {{
 *   task: string;
 *   harness: string;
 *   model: string;
 *   max_repairs: number;
 *   [key: string]: unknown;
 * }} TrialRow
 */

try {
	cpSync(fixture, exportDir, { recursive: true });
	const trialsPath = join(exportDir, 'data/trials.json');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any
	const rows = /** @type {TrialRow[]} */ (JSON.parse(readFileSync(trialsPath, 'utf8')));
	const base = rows.find((row) => row.task === 'misc-api' && row.harness === 'claude');
	if (!base) throw new Error('e2e fixture base trial not found');

	const glm = {
		...base,
		trial_id: 'trial-glm-0',
		trial_index: 90,
		harness: 'codex',
		agent: 'codex',
		harness_version: '0.167.2',
		model: 'z-ai/glm-5.3-flash',
		requested_model: 'z-ai/glm-5.3-flash',
		provider: 'z-ai',
		auth_mode: 'subscription',
		status: 'passed',
		rate_limited: false,
		agent_seconds: 100,
		run_id: 'run-misc-001'
	};
	rows.push(glm, {
		...glm,
		trial_id: 'trial-glm-1',
		trial_index: 91,
		max_repairs: 1,
		agent_seconds: 200
	});
	writeFileSync(trialsPath, JSON.stringify(rows, null, 2));

	const build = spawnSync('pnpm', ['exec', 'vite', 'build'], {
		env: { ...process.env, EXPORT_DIR: exportDir, BUILD_DIR },
		stdio: 'inherit'
	});
	if (build.status !== 0) process.exitCode = build.status ?? 1;
} finally {
	rmSync(exportDir, { recursive: true, force: true });
}
