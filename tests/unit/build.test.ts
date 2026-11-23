// Builds real exports with `vite build` and checks the prerendered files.
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { modelPaths } from '../../src/lib/models/catalog.ts';
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
const AUTH_RUN_PATH = '/runs/run-auth-001-a1b2c3d4/';
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

	it('prerenders every page in pages.json and every model profile', () => {
		for (const page of pages)
			expect(existsSync(join(result.dir, page.path, 'index.html'))).toBe(true);
		for (const path of modelPaths())
			expect(existsSync(join(result.dir, path, 'index.html')), path).toBe(true);
		expect(htmlFiles(result.dir)).toHaveLength(pages.length + modelPaths().length);
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

	it('renders model profiles with official facts and verified results kept separate', () => {
		const index = html(result.dir, '/models/');
		expect(index).toContain('GPT-6 Luna');
		expect(index).toContain('18 / 20 passed');
		expect(index).toContain('No verified results yet');
		expect(index).toContain('gateway or subscription prices');

		const luna = html(result.dir, '/models/gpt-6-luna/');
		expect(luna).toContain('Official specifications');
		expect(luna).toContain('Official pricing');
		expect(luna).toContain('1,050,000 tokens');
		expect(luna).toContain('Text, Image');
		expect(luna).toContain('$0.10');
		expect(luna).toContain('$0.01');
		expect(luna).toContain('$0.50');
		expect(luna).toContain('18 of 20 verified trials passed');
		expect(luna).toContain('openai/gpt-6-luna');
		expect(luna).toContain('Compare this group');
		expect(luna).toContain('href="../../compare/?task=auth-api');

		const glm = html(result.dir, '/models/glm-5.3-flash/');
		expect(glm).toContain('GLM-5.3-FlashX is a separate');
		const glmResults = glm.slice(glm.indexOf('AICSbench results'));
		expect(glmResults).toContain('No verified results yet.');
		expect(glmResults).not.toContain('0 of 0');
		expect(glmResults).not.toContain('0%');

		const deepseek = html(result.dir, '/models/deepseek-v4.1-flash/');
		expect(deepseek).toContain('Peak (weekday');
		expect(deepseek).toContain('Off-peak');
		expect(deepseek).toContain('$0.30');
		expect(deepseek).toContain('$0.006');
		expect(deepseek).toContain('$1.20');
	});

	it('links benchmark views to a profile only when the model maps', () => {
		const modelPage = html(result.dir, '/tasks/task-management-api/models/gpt-6-luna/');
		expect(modelPage).toContain('Model profile: GPT-6 Luna');
		expect(modelPage).toContain('href="../../../../models/gpt-6-luna/"');

		const other = html(result.dir, '/tasks/task-management-api/models/claude-opus-5-5/');
		expect(other).not.toContain('Model profile:');

		const board = html(result.dir, '/leaderboard/');
		expect(board).toContain('href="../models/gpt-6-luna/"');
	});

	it('shows the provider next to a harness + model row and labels legacy trials', () => {
		const task = html(result.dir, '/tasks/task-management-api/');
		expect(task).toContain('claude + claude-opus-5-5');
		expect(task).toContain('badge provider');
		expect(task).toContain('anthropic');
		const run = html(result.dir, '/runs/run-notes-001/');
		expect(run).toContain('provider not recorded');
		expect(run).toContain('openrouter');
		expect(run).toContain('via openrouter.ai');
		expect(html(result.dir, '/methodology/')).toContain('Gateway runs include the gateway');
	});

	it('summarizes run trials by stack and harness + model, with collapsed trial groups', () => {
		const run = html(result.dir, '/runs/run-url-001/');
		expect(run).toContain('Summary by stack');
		expect(run).toContain('8 trials in 2');
		expect(run).toContain('fastapi-latest');
		expect(run).toContain('66.7%');
		expect(run).toContain('1m 45s');
		expect(run).toContain('2m 5s');
		expect(run).toContain('5m 5s');
		expect(run).toContain('Trials in laravel');
		expect(run).toMatch(/<details class="stack-group[^"]*">/);
	});

	it('writes prerendered benchmark insights that only compare like-for-like trials', () => {
		const run = html(result.dir, '/runs/run-url-001/');
		expect(run).toContain('<h2 id="benchmark-insights">Benchmark Insights</h2>');
		expect(run).toContain(
			'Within the best-covered comparable setup, codex + gpt-6-luna via openai'
		);
		expect(run).toContain('fastapi-latest recorded the lowest mean agent time at 2m 5s');
		expect(run).toContain('versus 5m 5s for laravel');
		expect(run).toContain(
			'The comparison covers 2 stacks with at least 2 timed passing trials each.'
		);
		expect(run).toContain('directional rather than a confident ranking');

		const description = attr(run, /<meta name="description" content="([^"]+)"/);
		const jsonLd = JSON.parse(jsonLdBlocks(run)[0]) as { name: string; description: string };
		expect(jsonLd.name).toContain('URL Shortener API Benchmark');
		expect(jsonLd.description).toBe(description);

		const verified = html(result.dir, '/runs/run-verified-001/');
		expect(verified).toContain('This run covers a single stack, fastapi');
		expect(verified).not.toContain('lowest mean agent time');

		const community = html(result.dir, '/runs/run-community-001/');
		expect(community).toContain('2 community trials');
		expect(community).toContain('0 of 2 trials passed (0% pass rate)');
		expect(community).not.toContain('verified trials');

		const untimed = html(result.dir, '/runs/run-misc-001/');
		expect(untimed).toContain('No passed trial recorded a usable agent time');
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

	it('gives every model page a title, description, canonical URL and JSON-LD', () => {
		const titles = new Set<string>();
		for (const path of modelPaths()) {
			const doc = html(result.dir, path);
			const title = attr(doc, /<title>([^<]*)<\/title>/);
			expect(title, path).toBeTruthy();
			titles.add(title!);
			expect(attr(doc, /<meta name="description" content="([^"]+)"/), path).toBeTruthy();
			expect(attr(doc, /<link rel="canonical" href="([^"]+)"/)).toBe(BASE_URL + path.slice(1));
			const blocks = jsonLdBlocks(doc);
			expect(blocks, path).toHaveLength(1);
			const data = JSON.parse(blocks[0]) as Record<string, unknown>;
			expect(data['@context']).toBe('https://schema.org');
			expect(data.url).toBe(BASE_URL + path.slice(1));
			expect(data['@type']).toBe(path === '/models/' ? 'CollectionPage' : 'WebPage');
		}
		expect(titles.size).toBe(modelPaths().length);
	});

	it.each([
		[
			'/tasks/url-shortener-api/stacks/laravel/',
			'laravel Stack Benchmark on URL Shortener API',
			'agent runtimes'
		],
		['/models/gpt-6-luna/', 'GPT-6 Luna: Specs, Pricing', 'official context window'],
		['/runs/run-community-001/', 'Task Management REST API Benchmark', 'community trials']
	])('describes the contents of %s in prerendered metadata', (path, title, description) => {
		const doc = html(result.dir, path);
		const meta = attr(doc, /<meta name="description" content="([^"]+)"/);
		expect(attr(doc, /<title>([^<]*)<\/title>/)).toContain(title);
		expect(meta).toContain(description);
		expect(attr(doc, /<meta property="og:description" content="([^"]+)"/)).toBe(meta);
	});

	it('writes a sitemap with every page and a robots.txt that points at it', () => {
		const sitemap = readFileSync(join(result.dir, 'sitemap.xml'), 'utf8');
		const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
		const expected = [
			...pages.map((page) => BASE_URL + page.path.slice(1)),
			...modelPaths().map((path) => BASE_URL + path.slice(1))
		];
		expect(locs.sort()).toEqual(expected.sort());
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
				for (const page of data.pages) {
					if (page.kind === 'run' && page.params.run_id === 'run-auth-001')
						page.path = AUTH_RUN_PATH;
					for (const link of page.links) {
						if (link.path === '/runs/run-auth-001/') link.path = AUTH_RUN_PATH;
					}
				}
				const task = data.pages.find(
					(page: { kind: string; params: { task?: string } }) =>
						page.kind === 'task' && page.params.task === 'task-management-api'
				);
				task.title = 'Evil </script><script>alert(2)</script> & co';
				task.sections[1].refused = 'cannot compare stacks: harness differs';
				task.sections[1].rows = [];
				const board = data.pages.find((page: { kind: string }) => page.kind === 'leaderboard');
				// The fastapi section has no rows now that one task version has two suites;
				// use a section that does have rows to exercise a refused column.
				const target = board.sections.find(
					(section: { matrix: { rows: unknown[] } | null }) =>
						(section.matrix?.rows.length ?? 0) > 1
				);
				target.matrix.columns[0].refused = 'mixes acceptance suites';
				target.matrix.rows[1].overall.success_rate = null;
				target.matrix.rows[1].overall.mean_rank = null;
				// A path spelled with a raw reserved character, used exactly as exported.
				data.pages.push({
					path: '/tasks/task-management-api/models/vendor:model/',
					kind: 'model',
					title: 'Model vendor:model',
					description: 'A model whose path keeps a raw colon.',
					params: { task: 'task-management-api', model: 'vendor:model' },
					sections: [],
					links: []
				});
				// A mean without a standard deviation.
				task.sections[2].rows[0].stdev_seconds = null;
				// No verified rows anywhere on the home page.
				for (const section of data.pages[0].sections) section.rows = [];
				// A long label must not run into the chart's value.
				task.sections[0].rows[0].value =
					'claude + anthropic/claude-opus-5-5-with-a-very-long-gateway-model-identifier-20261120';
			});
			// The verified run is newer as an instant but sorts older as a string.
			json('data/trials.json', (rows) => {
				const base = rows.find(
					(row: { task: string; model: string }) =>
						row.task === 'task-management-api' && row.model === 'gpt-6-luna'
				);
				// An OpenCode gateway ID lands on the gpt-6-luna model page after
				// model_key strips the prefix, but the catalog does not list it.
				rows.push({
					...base,
					trial_id: 'trial-vendor',
					model: 'vendor/gpt-6-luna',
					harness: 'opencode',
					agent: 'opencode',
					harness_version: '1.19.5',
					provider: 'vendor',
					run_id: 'run-vendor-001'
				});
				for (const row of rows) {
					row.submitted_at =
						row.run_id === 'run-verified-001'
							? '2026-11-18T22:00:00Z'
							: '2026-11-19T01:00:00+05:00';
				}
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
			'Evil </script><script>alert(2)</script> & co Benchmark'
		);
		expect(attr(doc, /<title>([^<]*)<\/title>/)).toContain('&lt;/script>');
	});

	it('renders a page at its exported path, without re-encoding it', () => {
		const doc = html(result.dir, '/tasks/task-management-api/models/vendor:model/');
		expect(attr(doc, /<h1>([^<]*)<\/h1>/)).toBe('Model vendor:model');
		expect(attr(doc, /<link rel="canonical" href="([^"]+)"/)).toBe(
			'https://aicsbench.github.io/web/tasks/task-management-api/models/vendor:model/'
		);
	});

	it('lists the latest runs newest first by instant, not by string', () => {
		const home = html(result.dir, '/');
		const verified = home.indexOf('Run run-verified-001<!----></a>');
		const community = home.indexOf('Run run-community-001<!----></a>');
		expect(verified).toBeGreaterThan(0);
		expect(community).toBeGreaterThan(verified);
	});

	it('nests community matrices under the community heading', () => {
		const dir = editedExport((json) =>
			json('pages.json', (data) => {
				const board = data.pages.find((page: { kind: string }) => page.kind === 'leaderboard');
				board.sections.push({
					...board.sections[0],
					verified_only: false,
					heading: 'Community matrix'
				});
			})
		);
		const community = build(dir);
		if (community.status !== 0) throw new Error(community.output);
		expect(html(community.dir, '/leaderboard/')).toMatch(/<h3 id="[^"]+">Community matrix</);
	});

	it('marks a missing standard deviation as unavailable in the table and the chart', () => {
		const task = html(result.dir, '/tasks/task-management-api/');
		const start = task.indexOf('By stack · harness codex');
		const section = task.slice(start, task.indexOf('</section>', start));
		expect(section).toMatch(
			/10m 30s(?:<!--[^>]*-->)*\u00a0± (?:<!--[^>]*-->)*<span class="unavailable">unavailable<\/span>/
		);
		expect(section).toContain('10m 30s ± SD unavailable');
	});

	it('says there are no verified runs when verified sections are empty', () => {
		const home = html(result.dir, '/');
		expect(home).toContain('No verified runs yet.');
		expect(home).not.toContain('Leaderboard per task');
	});

	it('links under BASE_PATH with relative URLs', () => {
		const doc = html(result.dir, '/tasks/task-management-api/');
		expect(doc).toContain('href="../../runs/run-verified-001/"');
		expect(doc).toContain('href="../../_app/');
	});

	it('links model pages under BASE_PATH with relative URLs', () => {
		const profile = html(result.dir, '/models/gpt-6-luna/');
		expect(profile).toContain(`href="../..${AUTH_RUN_PATH}"`);
		expect(html(result.dir, AUTH_RUN_PATH)).toContain('run-auth-001');
		expect(profile).toContain('href="../../compare/?task=auth-api');
		expect(profile).toContain('href="../../models/"');
		const index = html(result.dir, '/models/');
		expect(index).toContain('href="../models/gpt-6-luna/"');
	});

	it('omits a model profile link when a raw trial ID is unattributed', () => {
		const page = html(result.dir, '/tasks/task-management-api/models/gpt-6-luna/');
		expect(page).not.toContain('Model profile:');
	});
});

describe('export without submissions', () => {
	it('builds the listed pages and the model catalog without inventing results', () => {
		const dir = editedExport((json) => {
			json('pages.json', (data) => {
				data.pages = data.pages
					.filter((page: { kind: string }) =>
						['home', 'leaderboard', 'compare', 'methodology'].includes(page.kind)
					)
					.map((page: { sections: unknown[]; links: unknown[] }) => ({
						...page,
						sections: [],
						links: []
					}));
			});
			json('data/trials.json', (rows) => rows.splice(0));
			json('data/meta.json', (meta) => {
				meta.runs = 0;
				meta.trials = 0;
				meta.tasks = [];
			});
		});
		rmSync(join(dir, 'runs'), { recursive: true });
		const result = build(dir);
		expect(result.status, result.output).toBe(0);
		expect(htmlFiles(result.dir)).toHaveLength(4 + modelPaths().length);
		expect(html(result.dir, '/')).toContain('No verified runs yet.');
		expect(html(result.dir, '/leaderboard/')).toContain('No verified runs yet.');
		expect(html(result.dir, '/models/').match(/No verified results yet/g)).toHaveLength(3);
		expect(html(result.dir, '/models/gpt-6-luna/')).toContain('No verified results yet.');
		expect(readFileSync(join(result.dir, 'sitemap.xml'), 'utf8').match(/<loc>/g)).toHaveLength(
			4 + modelPaths().length
		);
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
