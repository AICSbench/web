import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium } from '@playwright/test';

const [beforeDir, afterDir, reportDir] = process.argv.slice(2);
const origins = ['http://127.0.0.1:4175/', 'http://127.0.0.1:4176/'];
const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 390, height: 844 }
];

async function routes(dir: string) {
	const files = await readdir(dir, { recursive: true, withFileTypes: true });
	return new Set(
		files
			.filter((file) => file.isFile() && file.name === 'index.html')
			.map((file) => relative(dir, join(file.parentPath, file.name)))
			.map(
				(path) =>
					'/' +
					path.split('/').slice(0, -1).map(encodeURIComponent).join('/') +
					(path === 'index.html' ? '' : '/')
			)
	);
}

const before = await routes(beforeDir);
const after = await routes(afterDir);
const paths = [...new Set([...before, ...after])].sort();
if (!before.has('/') || !after.has('/')) throw new Error('Missing prerendered home page');
await mkdir(reportDir, { recursive: true });

const changes: { route: string; viewport: string; before: string | null; after: string | null }[] =
	[];
const browser = await chromium.launch();
try {
	for (const { name, width, height } of viewports) {
		const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' });
		const pages = await Promise.all(origins.map(() => context.newPage()));
		for (const route of paths) {
			const [a, b] = await Promise.all(
				pages.map(async (page, side) => {
					if (!(side === 0 ? before : after).has(route)) return null;
					const url = new URL(route, origins[side]);
					const response = await page.goto(url.href, { waitUntil: 'load' });
					if (!response?.ok() || page.url() !== url.href) throw new Error(`Cannot capture ${url}`);
					if (route === '/compare/') {
						await page.locator('#compare-fallback').waitFor({ state: 'hidden' });
						await page.getByText('Updating…', { exact: true }).waitFor({ state: 'hidden' });
					}
					return page.screenshot({ fullPage: true, animations: 'disabled' });
				})
			);
			if (a && b && a.equals(b)) continue;
			const id = changes.length + 1;
			const left = a ? `${id}-before.png` : null;
			const right = b ? `${id}-after.png` : null;
			if (a && left) await writeFile(join(reportDir, left), a);
			if (b && right) await writeFile(join(reportDir, right), b);
			changes.push({ route, viewport: name, before: left, after: right });
		}
		await context.close();
	}
} finally {
	await browser.close();
}

const figure = (label: string, image: string | null) =>
	`<figure><figcaption>${label}</figcaption>${image ? `<a href="${image}"><img loading="lazy" src="${image}" alt="${label}"></a>` : '<p>Page not present</p>'}</figure>`;
await writeFile(
	join(reportDir, 'index.html'),
	`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Preview screenshot comparison</title>
<style>body{font:1rem system-ui;margin:1rem}section{border-top:1px solid gray;margin:1rem 0}h2{overflow-wrap:anywhere}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}figure{margin:0}img{display:block;max-width:100%;height:auto}</style>
<h1>Preview screenshot comparison</h1><p>${changes.length} changed captures across ${paths.length} pages.</p>
${changes.map(({ route, viewport, before, after }) => `<section><h2>${route} (${viewport})</h2><div class="pair">${figure('Before', before)}${figure('After', after)}</div></section>`).join('\n')}`
);
await writeFile(join(reportDir, 'changes.json'), JSON.stringify({ pages: paths.length, changes }));
