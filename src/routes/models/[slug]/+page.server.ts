import { error } from '@sveltejs/kit';
import { MODEL_CATALOG, modelBySlug } from '#lib/models/catalog.ts';
import { modelProfileData } from '#lib/server/model-profiles.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => MODEL_CATALOG.map((model) => ({ slug: model.slug }));

export const load: PageServerLoad = ({ params }) => {
	const model = modelBySlug(params.slug);
	if (!model) error(404, `Unknown model profile: ${params.slug}`);
	return modelProfileData(model);
};
