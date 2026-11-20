<script lang="ts">
	import Link from '#lib/components/Link.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageView {data}>
	<div class="prose" id="compare-fallback">
		<p>
			The interactive compare page filters and groups every trial in your browser, so it needs
			JavaScript. It is not available yet.
		</p>
		<p>
			Without it, every leaderboard is on the static pages: start at the <Link path="/">
				home page
			</Link> or the <Link path="/leaderboard/">cross-task leaderboard</Link>. The raw rows are in
			<Link path="/data/trials.json">data/trials.json</Link>.
		</p>
	</div>
</PageView>
