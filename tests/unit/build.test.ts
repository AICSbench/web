// Builds real exports with `vite build` and checks the prerendered files.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	FIXTURE,
	attr,
	build,
	editedExport,
	html,
	jsonLdBlocks,
	type BuildResult
} from './helpers.ts';

const BASE_URL = 'https://aicsbench.github.io/web/';
const XSS = '<script>alert(1)</script>';
const pages = (
	JSON.parse(readFileSync(join(FIXTURE, 'pages.json'), 'utf8')) as {
		pages: { path: string; kind: string; title: string }[];
	}
).pages;

function htmlFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((file) => file.endsWith('.html'))
		.map((file) => join(dir, file));
}

describe('fixture build', () => {
	let result: BuildResult;
	beforeAll(() => {
		result = build(FIXTURE);
		if (result.status !== 0) throw new Error(result.output);
	});

	it('prerenders every page in pages.json, and only those', () => {
		for (const page of pages)
			expect(existsSync(join(result.dir, page.path, 'index.html'))).toBe(true);
		expect(htmlFiles(result.dir)).toHaveLength(pages.length);
		expect(new Set(pages.map((page) => page.kind)).size).toBe(9);
	});

	it('shows known numbers, harness names and run IDs from the export', () => {
		const task = html(result.dir, '/tasks/task-management-api/');
		expect(task).toContain('66.7%');
		expect(task).toContain('codex + gpt-6-luna');
		expect(task).toContain('Run run-verified-001');
		expect(html(result.dir, '/runs/run-verified-001/')).toContain('run-verified-001');
		expect(html(result.dir, '/leaderboard/')).toContain('claude + claude-opus-5-5');
	});

	it('renders a null mean as "unavailable", never 0', () => {
		const task = html(result.dir, '/tasks/task-management-api/');
		const community = task.slice(task.indexOf('community results'));
		// mean_cost_usd is null everywhere; mean_seconds is null in the community sections.
		expect(task).not.toMatch(/\$0\.00/);
		expect(community).toMatch(
			/<td class="num">(?:\s|<!--[^>]*-->)*<span class="unavailable">unavailable<\/span>/
		);
		expect(community).not.toMatch(/>0s</);
	});

	it('labels community sections', () => {
		const task = html(result.dir, '/tasks/task-management-api/');
		expect(task).toContain('Community results</span>');
		expect(task).toContain('Verified runs</span>');
	});

	it('gives every page a unique title, a description, a canonical URL and valid JSON-LD', () => {
		const titles = new Set<string>();
		for (const page of pages) {
			const doc = html(result.dir, page.path);
			const title = attr(doc, /<title>([^<]*)<\/title>/);
			expect(title, page.path).toBeTruthy();
			titles.add(title!);
			expect(attr(doc, /<meta name="description" content="([^"]+)"/), page.path).toBeTruthy();
			expect(attr(doc, /<link rel="canonical" href="([^"]+)"/)).toBe(BASE_URL + page.path.slice(1));
			expect(attr(doc, /<meta property="og:title" content="([^"]+)"/)).toBeTruthy();
			expect(attr(doc, /<meta property="og:url" content="([^"]+)"/)).toBe(
				BASE_URL + page.path.slice(1)
			);
			const blocks = jsonLdBlocks(doc);
			expect(blocks, page.path).toHaveLength(1);
			const data = JSON.parse(blocks[0]) as Record<string, unknown>;
			expect(data['@context']).toBe('https://schema.org');
			expect(data.url).toBe(BASE_URL + page.path.slice(1));
			if (page.kind === 'home') expect(data['@type']).toBe('WebSite');
			if (page.kind === 'task') expect(data['@type']).toBe('Dataset');
		}
		expect(titles.size).toBe(pages.length);
	});

	it('writes a sitemap with every page and a robots.txt that points at it', () => {
		const sitemap = readFileSync(join(result.dir, 'sitemap.xml'), 'utf8');
		const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
		expect(locs.sort()).toEqual(pages.map((page) => BASE_URL + page.path.slice(1)).sort());
		const robots = readFileSync(join(result.dir, 'robots.txt'), 'utf8');
		expect(robots).toContain('Allow: /');
		expect(robots).toContain(`Sitemap: ${BASE_URL}sitemap.xml`);
	});

	it('copies data/ and runs/ for download, byte for byte', () => {
		for (const file of [
			'data/trials.json',
			'data/meta.json',
			'runs/run-community-001/submission.json',
			'runs/run-verified-001/manifest.json'
		]) {
			expect(readFileSync(join(result.dir, file), 'utf8')).toBe(
				readFileSync(join(FIXTURE, file), 'utf8')
			);
		}
	});

	it('escapes the fixture script tag on every page', () => {
		for (const file of htmlFiles(result.dir)) {
			const doc = readFileSync(file, 'utf8');
			expect(doc, file).not.toContain(XSS);
			expect(doc, file).not.toContain('<script>alert');
			for (const block of jsonLdBlocks(doc)) expect(block).not.toMatch(/<\/?script/i);
		}
		const run = html(result.dir, '/runs/run-community-001/');
		expect(run).toContain('&lt;script>alert(1)&lt;/script>');
		expect(run).toContain('Community fixture run. &lt;script>alert(1)&lt;/script>');
	});
});

describe('edge-case build', () => {
	let result: BuildResult;
	beforeAll(() => {
		const dir = editedExport((json) => {
			json('pages.json', (data) => {
				const task = data.pages.find((page: { kind: string }) => page.kind === 'task');
				task.title = 'Evil </script><script>alert(2)</script> & co';
				task.sections[1].refused = 'cannot compare stacks: harness differs';
				task.sections[1].rows = [];
				const board = data.pages.find((page: { kind: string }) => page.kind === 'leaderboard');
				board.sections[0].matrix.columns[0].refused = 'mixes acceptance suites';
				board.sections[0].matrix.rows[1].overall.success_rate = null;
				board.sections[0].matrix.rows[1].overall.mean_rank = null;
			});
		});
		result = build(dir, { BASE_PATH: '/web' });
		if (result.status !== 0) throw new Error(result.output);
	});

	it('shows a refused section as its message, without a table', () => {
		const task = html(result.dir, '/tasks/task-management-api/');
		const start = task.indexOf('cannot compare stacks: harness differs');
		expect(start).toBeGreaterThan(0);
		const section = task.slice(
			task.lastIndexOf('<section', start),
			task.indexOf('</section>', start)
		);
		expect(section).toContain('Not compared:');
		expect(section).not.toContain('<table');
	});

	it('shows a refused matrix column and null overalls as unavailable', () => {
		const board = html(result.dir, '/leaderboard/');
		expect(board).toContain('mixes acceptance suites');
		expect(board).toContain('not compared');
		expect(board).toMatch(/<span class="unavailable">unavailable<\/span>/);
	});

	it('keeps a </script> in a title inside the JSON-LD string', () => {
		const doc = html(result.dir, '/tasks/task-management-api/');
		const [block] = jsonLdBlocks(doc);
		expect(block).not.toMatch(/[<>&]/);
		expect(block).toContain('\\u003c/script\\u003e');
		expect((JSON.parse(block) as { name: string }).name).toBe(
			'Evil </script><script>alert(2)</script> & co'
		);
		expect(attr(doc, /<title>([^<]*)<\/title>/)).toContain('&lt;/script>');
	});

	it('links under BASE_PATH with relative URLs', () => {
		const doc = html(result.dir, '/tasks/task-management-api/');
		expect(doc).toContain('href="../../runs/run-verified-001/"');
		expect(doc).toContain('href="../../_app/');
	});
});

describe('builds that must fail', () => {
	it('fails on export_schema 2, naming both numbers', () => {
		const dir = editedExport((json) => json('export.json', (data) => (data.export_schema = 2)));
		const result = build(dir);
		expect(result.status).not.toBe(0);
		expect(result.output).toContain(
			'export_schema 2 is not supported; this site supports export_schema 1'
		);
	});

	it('fails on a trial row that breaks the schema, naming the file and path', () => {
		const dir = editedExport((json) =>
			json('data/trials.json', (rows) => {
				delete rows[2].status;
			})
		);
		const result = build(dir);
		expect(result.status).not.toBe(0);
		expect(result.output).toMatch(
			/data\/trials\.json: does not match schema\/trials\.schema\.json: \$\[2\]: must have required property 'status'/
		);
	});

	it('fails on a link to a page the export does not list', () => {
		const dir = editedExport((json) =>
			json('pages.json', (data) =>
				data.pages[0].links.push({ path: '/nowhere/', label: 'Nowhere' })
			)
		);
		const result = build(dir);
		expect(result.status).not.toBe(0);
		expect(result.output).toContain('/nowhere/');
	});
});
