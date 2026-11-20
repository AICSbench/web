import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const FIXTURE = resolve('tests/fixtures/export');

/** A copy of the fixture export in a temp folder, changed by `edit` (file -> JSON). */
export function editedExport(
	edit: (json: (file: string, change: (data: any) => void) => void) => void
): string {
	const dir = mkdtempSync(join(tmpdir(), 'aicsbench-export-'));
	cpSync(FIXTURE, dir, { recursive: true });
	edit((file, change) => {
		const path = join(dir, file);
		const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
		change(data);
		writeFileSync(path, JSON.stringify(data, null, 2));
	});
	return dir;
}

export interface BuildResult {
	status: number | null;
	output: string;
	dir: string;
}

/** `vite build` of `exportDir` into a temp folder. */
export function build(exportDir: string, env: Record<string, string> = {}): BuildResult {
	const dir = mkdtempSync(join(tmpdir(), 'aicsbench-build-'));
	const result = spawnSync('pnpm', ['exec', 'vite', 'build'], {
		env: { ...process.env, EXPORT_DIR: exportDir, BUILD_DIR: dir, ...env },
		encoding: 'utf8'
	});
	return { status: result.status, output: `${result.stdout}\n${result.stderr}`, dir };
}

/** The prerendered HTML of an export path ("/tasks/x/"). */
export function html(buildDir: string, path: string): string {
	return readFileSync(join(buildDir, path, 'index.html'), 'utf8');
}

/** Every `<script type="application/ld+json">` body in a page. */
export function jsonLdBlocks(page: string): string[] {
	return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
		(match) => match[1]
	);
}

/** The text of the first element matching a simple tag pattern. */
export function attr(page: string, pattern: RegExp): string | undefined {
	return pattern.exec(page)?.[1];
}
