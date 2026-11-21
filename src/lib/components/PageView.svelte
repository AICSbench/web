<script lang="ts">
	// The frame every page kind shares: SEO head, title, description, its sections and links.
	import type { Snippet } from 'svelte';
	import Leaderboard from './Leaderboard.svelte';
	import Link from './Link.svelte';
	import Matrix from './Matrix.svelte';
	import SeoHead from './SeoHead.svelte';
	import type { ModelEntry } from '#lib/models/catalog.ts';
	import type { Page } from '#lib/types/export.ts';

	let {
		data,
		children
	}: {
		data: {
			page: Page;
			canonical: string;
			jsonLd: object;
			providers?: Record<string, string>[];
			profile?: ModelEntry | null;
		};
		children?: Snippet;
	} = $props();

	const page = $derived(data.page);
	const sections = $derived(
		page.sections.map((section, index) => ({
			section,
			providers: data.providers?.[index] ?? {}
		}))
	);
	const verified = $derived(sections.filter((entry) => entry.section.verified_only));
	const community = $derived(sections.filter((entry) => !entry.section.verified_only));
</script>

<SeoHead
	title={page.path === '/' ? page.title : `${page.title} · AICSbench`}
	description={page.description}
	canonical={data.canonical}
	jsonLd={data.jsonLd}
/>

<h1>{page.title}</h1>
<p class="lead">{page.description}</p>

{#if data.profile}
	<p class="model-profile">
		<Link path={`/models/${data.profile.slug}/`}>
			Model profile: {data.profile.displayName}
		</Link>
	</p>
{/if}

{@render children?.()}

{#each verified as entry, index (index)}
	{#if entry.section.matrix}
		<Matrix section={entry.section} matrix={entry.section.matrix} providers={entry.providers} />
	{:else}
		<Leaderboard section={entry.section} providers={entry.providers} />
	{/if}
{/each}

{#if community.length > 0}
	<h2 class="community-heading">Community results</h2>
	<p class="sub">
		These runs are not verified by a maintainer. They are listed apart and never mixed into the
		verified rankings above.
	</p>
	{#each community as entry, index (index)}
		{#if entry.section.matrix}
			<Matrix
				section={entry.section}
				matrix={entry.section.matrix}
				providers={entry.providers}
				headingLevel={3}
			/>
		{:else}
			<Leaderboard section={entry.section} providers={entry.providers} headingLevel={3} />
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
