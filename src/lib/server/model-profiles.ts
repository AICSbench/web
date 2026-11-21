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

function indexDescription(): string {
	return 'Official specifications and maker list prices for supported AI models, with verified AICSbench results kept separate.';
}

function profileDescription(model: ModelEntry): string {
	return `${model.displayName} by ${model.maker}: official specifications and list prices, plus verified AICSbench results when available.`;
}

export function modelIndexData() {
	const site = loadExport();
	const path = '/models/';
	return {
		models: MODEL_CATALOG.map((model) => ({
			model,
			results: summarizeModelResults(model, site.trials)
		})) satisfies ModelIndexEntry[],
		canonical: absolute(path),
		description: indexDescription(),
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: 'Models',
			description: indexDescription(),
			url: absolute(path)
		}
	};
}

export function modelProfileData(model: ModelEntry) {
	const site = loadExport();
	const path = `/models/${model.slug}/`;
	const description = profileDescription(model);
	return {
		model,
		results: summarizeModelResults(model, site.trials),
		canonical: absolute(path),
		description,
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: `${model.displayName} model profile`,
			description,
			url: absolute(path),
			about: { '@type': 'Thing', name: model.displayName },
			isPartOf: { '@type': 'WebSite', name: 'AICSbench', url: absolute('/') }
		}
	};
}
