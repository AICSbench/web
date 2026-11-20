<script lang="ts">
	import PageView from '#lib/components/PageView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageView {data}>
	{#if data.page.sections.length === 0}
		<p class="unavailable">No verified runs yet.</p>
	{/if}
</PageView>
