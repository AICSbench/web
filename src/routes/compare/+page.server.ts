import { pageData } from '#lib/server/pages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => pageData('compare');
