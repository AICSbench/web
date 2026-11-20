// Copies the export's runs/<run_id>/ files into the site for download.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadExport } from '#lib/load-export.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () =>
	loadExport()
		.downloads.filter((file) => file.startsWith('runs/'))
		.map((file) => {
			const [, run_id, ...rest] = file.split('/');
			return { run_id, file: rest.join('/') };
		});

export const GET: RequestHandler = ({ params }) => {
	const site = loadExport();
	const file = `runs/${params.run_id}/${params.file}`;
	if (!site.downloads.includes(file)) return new Response('Not found', { status: 404 });
	return new Response(readFileSync(join(site.dir, file)), {
		headers: { 'content-type': 'application/json' }
	});
};
