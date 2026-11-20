<script lang="ts">
	// The frame every page kind shares: SEO head, title, description, its sections and links.
	import type { Snippet } from 'svelte';
	import Leaderboard from './Leaderboard.svelte';
	import Link from './Link.svelte';
	import Matrix from './Matrix.svelte';
	import SeoHead from './SeoHead.svelte';
	import type { Page } from '#lib/types/export.ts';

	let {
		data,
		children
	}: {
		data: { page: Page; canonical: string; jsonLd: object };
		children?: Snippet;
	} = $props();

	const page = $derived(data.page);
	const verified = $derived(page.sections.filter((section) => section.verified_only));
	const community = $derived(page.sections.filter((section) => !section.verified_only));
</script>

<SeoHead
	title={page.path === '/' ? page.title : `${page.title} · AICSbench`}
	description={page.description}
	canonical={data.canonical}
	jsonLd={data.jsonLd}
/>

<h1>{page.title}</h1>
<p class="lead">{page.description}</p>

{@render children?.()}

{#each verified as section, index (index)}
	{#if section.matrix}
		<Matrix {section} matrix={section.matrix} />
	{:else}
		<Leaderboard {section} />
	{/if}
{/each}

{#if community.length > 0}
	<h2 class="community-heading">Community results</h2>
	<p class="sub">
		These runs are not verified by a maintainer. They are listed apart and never mixed into the
		verified rankings above.
	</p>
	{#each community as section, index (index)}
		{#if section.matrix}
			<Matrix {section} matrix={section.matrix} />
		{:else}
			<Leaderboard {section} headingLevel={3} />
		{/if}
	{/each}
{/if}

{#if page.links.length > 0}
	<nav aria-label="Related pages">
		<h2>Related pages</h2>
		<ul class="links">
			{#each page.links as link (link.path)}
				<li><Link path={link.path}>{link.label}</Link></li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	.community-heading {
		margin-top: 2rem;
	}
</style>
