import { groupRunTrials } from '#lib/run-summary.ts';
import { entriesFor, pageData } from '#lib/server/pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => entriesFor('run') as ReturnType<EntryGenerator>;

export const load: PageServerLoad = ({ params }) => {
	const data = pageData('run', params);
	const run = data.run;
	return { ...data, run: run ? { ...run, groups: groupRunTrials(run.trials) } : null };
};
