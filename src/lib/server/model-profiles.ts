// Build-time data for the model index and profiles. The catalog is local and
// version-controlled; the result summaries read the same export as every other
// page, so a profile shows exactly the trials the rest of the site shows.
import { loadExport } from '../load-export.ts';
import { MODEL_CATALOG, type ModelEntry } from '../models/catalog.ts';
import { summarizeModelResults, type ModelResults } from '../models/results.ts';
import { absolute } from './pages.ts';

export interface ModelIndexEntry {
	model: ModelEntry;
	results: ModelResults;
}

export function modelIndexData() {
	const site = loadExport();
	const path = '/models/';
	const title = 'AI Coding Models: Specs, Pricing & Benchmarks';
	const description =
		'Explore AI coding model profiles with official context windows and API list prices. See verified AICSbench results by agent and stack where available.';
	return {
		models: MODEL_CATALOG.map((model) => ({
			model,
			results: summarizeModelResults(model, site.trials)
		})) satisfies ModelIndexEntry[],
		canonical: absolute(path),
		title,
		description,
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: title,
			description,
			url: absolute(path)
		}
	};
}

export function modelProfileData(model: ModelEntry) {
	const site = loadExport();
	const path = `/models/${model.slug}/`;
	const results = summarizeModelResults(model, site.trials);
	const runPaths = new Map(
		site.pages.filter((page) => page.kind === 'run').map((page) => [page.params.run_id, page.path])
	);
	const title = `${model.displayName}: Specs, Pricing & Coding Benchmarks`;
	const description = `Explore ${model.displayName} by ${model.maker}: official context window, API list pricing, and verified AI coding benchmark results where available.`;
	return {
		model,
		results,
		runPaths,
		canonical: absolute(path),
		title,
		description,
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: title,
			description,
			url: absolute(path),
			about: { '@type': 'Thing', name: model.displayName },
			isPartOf: { '@type': 'WebSite', name: 'AICSbench', url: absolute('/') }
		}
	};
}
