import { loadExport } from '#lib/load-export.ts';
import { modelPaths } from '#lib/models/catalog.ts';
import { absolute } from '#lib/server/pages.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

function xml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

export const GET: RequestHandler = () => {
	const urls = [...loadExport().pages.map((page) => page.path), ...modelPaths()]
		.map((path) => `  <url><loc>${xml(absolute(path))}</loc></url>`)
		.join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
};
