<script lang="ts">
	import PageView from '#lib/components/PageView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageView {data} />
