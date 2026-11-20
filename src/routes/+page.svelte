<script lang="ts">
	import Link from '#lib/components/Link.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import { day } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageView {data}>
	<div class="prose">
		<p>
			AICSbench runs AI coding agents (a <strong>harness</strong> such as Claude Code or Codex,
			driving a <strong>model</strong>) on the same tasks in different languages and frameworks, and
			checks the result with a fixed acceptance suite. Leaderboards below hold verified runs only,
			ordered by mean agent time over passed trials, with the success rate beside it. Read the <Link
				path="/methodology/"
			>
				methodology
			</Link> for how trials run and what each number means.
		</p>
	</div>
	{#if data.latestRuns.length > 0}
		<section aria-labelledby="latest-runs">
			<h2 id="latest-runs">Latest runs</h2>
			<ul class="links">
				{#each data.latestRuns as run (run.path)}
					<li>
						<Link path={run.path}>{run.title}</Link>
						<span class="sub">· {run.task} v{run.task_version} · {day(run.submitted_at)}</span>
						{#if run.verified}<span class="badge verified">Verified</span>{:else}<span
								class="badge community"
							>
								Community
							</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if data.page.sections.some((section) => section.verified_only && (section.rows.length > 0 || (section.matrix?.rows.length ?? 0) > 0))}
		<h2>Leaderboard per task</h2>
	{:else}
		<p class="unavailable">No verified runs yet.</p>
	{/if}
</PageView>
