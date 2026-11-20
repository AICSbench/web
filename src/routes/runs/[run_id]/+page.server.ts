import { entriesFor, pageData } from '#lib/server/pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => entriesFor('run') as ReturnType<EntryGenerator>;

export const load: PageServerLoad = ({ params }) => pageData('run', params);
