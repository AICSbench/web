<script lang="ts">
	import PageView from '#lib/components/PageView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageView {data}>
	{#if data.versions.length > 0}
		<section aria-labelledby="versions">
			<h2 id="versions">Versions</h2>
			<ul class="links">
				{#each data.versions as task (task.version)}
					<li>
						<strong>Version {task.version}</strong>{#if task.name !== null}: {task.name}{/if}
						{#if task.description !== null}<br /><span class="sub">{task.description}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</PageView>
