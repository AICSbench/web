<script lang="ts">
	import Link from '#lib/components/Link.svelte';
	import Price from '#lib/components/Price.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { tokens } from '#lib/format.ts';
	import { baselineTier } from '#lib/models/catalog.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead
	title="Models · AICSbench"
	description={data.description}
	canonical={data.canonical}
	jsonLd={data.jsonLd}
/>

<h1 id="models-heading">Models</h1>
<p class="lead">
	Official specifications and maker list prices for supported models. AICSbench results are verified
	trials from the same export as the rest of the site, kept separate from what the maker publishes.
</p>

<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="table-scroll" role="region" aria-labelledby="models-heading" tabindex="0">
	<table class="stacked-table">
		<caption class="visually-hidden">
			Supported models with official list prices and verified results
		</caption>
		<thead>
			<tr>
				<th scope="col">Model</th>
				<th scope="col">Maker</th>
				<th scope="col" class="num">Context</th>
				<th scope="col" class="num">Input / 1M</th>
				<th scope="col" class="num">Cached input / 1M</th>
				<th scope="col" class="num">Output / 1M</th>
				<th scope="col">Verified results</th>
			</tr>
		</thead>
		<tbody>
			{#each data.models as entry (entry.model.slug)}
				{@const price = baselineTier(entry.model)}
				<tr>
					<th scope="row" data-label="Model">
						<Link path={`/models/${entry.model.slug}/`}>{entry.model.displayName}</Link>
						<br />
						<span class="sub"><code>{entry.model.canonicalId}</code></span>
						<br />
						<span class="sub">{price.label}</span>
					</th>
					<td data-label="Maker">{entry.model.maker}</td>
					<td class="num" data-label="Context">
						{#if entry.model.specifications.contextWindowTokens === null}
							<span class="unavailable">Not available</span>
						{:else}
							{tokens(entry.model.specifications.contextWindowTokens)} tokens
						{/if}
					</td>
					<td class="num" data-label="Input / 1M"><Price value={price.inputUsdPerMillion} /></td>
					<td class="num" data-label="Cached input / 1M">
						<Price value={price.cachedInputUsdPerMillion} />
					</td>
					<td class="num" data-label="Output / 1M"><Price value={price.outputUsdPerMillion} /></td>
					<td data-label="Verified results">
						{#if entry.results.totalTrials > 0}
							{entry.results.totalPassed} / {entry.results.totalTrials} passed
							<span class="sub">({entry.results.groups.length} groups)</span>
						{:else}
							<span class="unavailable">No verified results yet</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="sub">
	Prices are each model's headline official tier per 1M tokens, checked on the profile. Profiles
	show every published tier, the source links and the date checked. These are maker list prices, not
	gateway or subscription prices; the CLI's separate <code>estimated_api_cost_usd</code> uses a
	dated OpenRouter base-rate snapshot. See <Link path="/methodology/#prices-and-estimates">
		Methodology
	</Link>.
</p>
