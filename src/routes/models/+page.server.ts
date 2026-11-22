import { modelIndexData } from '#lib/server/model-profiles.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => modelIndexData();
