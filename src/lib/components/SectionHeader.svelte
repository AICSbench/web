<script lang="ts">
	// A section's heading, its verified or community label, and what it holds fixed.
	import { FIXED_LABELS } from '#lib/format.ts';
	import type { Section } from '#lib/types/export.ts';

	let {
		section,
		id,
		level = 2,
		status
	}: {
		section: Section;
		id: string;
		level?: 2 | 3;
		status?: 'verified' | 'community' | 'mixed' | null;
	} = $props();

	const shownStatus = $derived(
		status === undefined ? (section.verified_only ? 'verified' : 'community') : status
	);

	function shown(key: string, value: string): string {
		return key === 'suite_sha256' ? value.slice(0, 8) : value;
	}
</script>

<svelte:element this={`h${level}`} {id}>{section.heading}</svelte:element>
<p class="status">
	{#if shownStatus === 'verified'}
		<span class="badge verified">Verified runs</span>
	{:else if shownStatus === 'community'}
		<span class="badge community">Community results</span>
		<span class="sub">Unverified submissions, shown apart from verified runs.</span>
	{:else if shownStatus === 'mixed'}
		<span class="badge mixed">Verified and community runs</span>
	{/if}
</p>
<ul class="fixed" aria-label="Held fixed in this section">
	{#each Object.entries(section.fixed) as [key, value] (key)}
		{#if value !== undefined}
			<li>
				<span class="key">{Object.hasOwn(FIXED_LABELS, key) ? FIXED_LABELS[key] : key}</span>
				<code title={value}>{shown(key, value)}</code>
			</li>
		{/if}
	{/each}
</ul>

<style>
	.status {
		margin: 0 0 0.5rem;
	}

	.fixed {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		padding: 0;
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
	}

	.key {
		color: var(--muted);
	}
</style>
