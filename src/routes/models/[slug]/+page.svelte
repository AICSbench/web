<script lang="ts">
	import { resolve } from '$app/paths';
	import Link from '#lib/components/Link.svelte';
	import Metric from '#lib/components/Metric.svelte';
	import Price from '#lib/components/Price.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { suiteLabel } from '#lib/compare/url.ts';
	import { duration, percent, tokens } from '#lib/format.ts';
	import { baselineTier } from '#lib/models/catalog.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const model = $derived(data.model);
	const specifications = $derived(model.specifications);
	const baseline = $derived(baselineTier(model));

	// Compare URLs carry query state, so they cannot go through Link's typed
	// pathname resolver unchanged. Resolve the pathname and keep the query.
	const resolvePath = resolve as unknown as (pathname: string) => string;
	function withBase(href: string): string {
		const [path, search] = href.split('?');
		return `${resolvePath(path.replace(/^\//, ''))}${search ? `?${search}` : ''}`;
	}
</script>

<SeoHead
	title={`${data.title} · AICSbench`}
	description={data.description}
	canonical={data.canonical}
	jsonLd={data.jsonLd}
/>

<h1>{model.displayName}</h1>
<p class="lead">
	{model.maker} model profile. Maker-published specifications and official list prices are shown separately
	from verified AICSbench results.
</p>

<section aria-labelledby="specifications-heading">
	<h2 id="specifications-heading">Official specifications</h2>
	<p class="sub">
		Published by {model.maker}; sources checked {model.pricing.checkedAt}.
	</p>
	<dl class="facts">
		<dt>Maker</dt>
		<dd>{model.maker}</dd>
		<dt>Canonical model ID</dt>
		<dd><code>{model.canonicalId}</code></dd>
		<dt>Version / snapshot</dt>
		<dd>{specifications.exactVersion ?? 'Not available'}</dd>
		<dt>Context window</dt>
		<dd>
			{#if specifications.contextWindowTokens === null}
				<span class="unavailable">Not available</span>
			{:else}
				{tokens(specifications.contextWindowTokens)} tokens
			{/if}
			{#if specifications.contextWindowNote}
				<span class="sub"> · {specifications.contextWindowNote}</span>
			{/if}
		</dd>
		<dt>Maximum output</dt>
		<dd>
			{#if specifications.maxOutputTokens === null}
				<span class="unavailable">Not available</span>
			{:else}
				{tokens(specifications.maxOutputTokens)} tokens
			{/if}
		</dd>
		<dt>Input modalities</dt>
		<dd>{specifications.inputModalities?.join(', ') ?? 'Not available'}</dd>
		<dt>Output modalities</dt>
		<dd>{specifications.outputModalities?.join(', ') ?? 'Not available'}</dd>
		<dt>Weights</dt>
		<dd>
			{#if specifications.weights}
				{specifications.weights}
			{:else}
				<span class="unavailable">Not available</span>
			{/if}
			{#if specifications.weightsNote}
				<span class="sub"> · {specifications.weightsNote}</span>
			{/if}
		</dd>
		<dt>License</dt>
		<dd>{specifications.license ?? 'Not available'}</dd>
		<dt>Trial IDs</dt>
		<dd>
			<ul class="inline">
				{#each [model.canonicalId, ...model.aliases] as id (id)}
					<li><code>{id}</code></li>
				{/each}
			</ul>
		</dd>
	</dl>
	<p class="sub">
		Only these exact trial IDs map to this profile. Unknown models, unqualified harness defaults and
		distinct variants are not attributed.
	</p>
	<ul class="links">
		{#each model.sources as source (source.url)}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external maker source -->
			<li><a href={source.url}>{source.label}</a></li>
		{/each}
	</ul>
</section>

<section aria-labelledby="pricing-heading">
	<h2 id="pricing-heading">Official pricing</h2>
	<p class="sub">
		Maker list prices per 1M tokens, checked {model.pricing.checkedAt}. Headline baseline:
		<strong>{baseline.label}</strong>.
	</p>
	<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="table-scroll" role="region" aria-labelledby="pricing-heading" tabindex="0">
		<table class="stacked-table">
			<caption class="visually-hidden"> Official list prices per million tokens </caption>
			<thead>
				<tr>
					<th scope="col">Tier</th>
					<th scope="col" class="num">Input</th>
					<th scope="col" class="num">Cached input</th>
					<th scope="col" class="num">Output</th>
				</tr>
			</thead>
			<tbody>
				{#each model.pricing.tiers as tier (tier.label)}
					<tr>
						<th scope="row" data-label="Tier">
							{tier.label}
							{#if tier.baseline}<span class="badge verified">Headline</span>{/if}
							{#if tier.note}<br /><span class="sub">{tier.note}</span>{/if}
						</th>
						<td class="num" data-label="Input"><Price value={tier.inputUsdPerMillion} /></td>
						<td class="num" data-label="Cached input">
							<Price value={tier.cachedInputUsdPerMillion} />
						</td>
						<td class="num" data-label="Output"><Price value={tier.outputUsdPerMillion} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if model.pricing.note}
		<p class="sub">{model.pricing.note}</p>
	{/if}
	<p class="sub">
		These are maker list prices, not gateway or subscription prices. The CLI's separate
		<code>estimated_api_cost_usd</code> uses a dated OpenRouter base-rate snapshot; see
		<Link path="/methodology/#prices-and-estimates">Methodology</Link>.
	</p>
</section>

<section aria-labelledby="results-heading">
	<h2 id="results-heading">AICSbench results</h2>
	<p class="sub">
		Verified trials only. Rows stay separate by task/version, acceptance suite, stack, harness,
		provider, trial model ID, tooling mode, auth mode, repair budget and parallelism, so unlike
		setups are never collapsed into one score.
	</p>

	{#if data.results.totalTrials === 0}
		<p class="unavailable">No verified results yet.</p>
		<p class="sub">
			No verified AICSbench trial in the current export uses {model.displayName}. The specifications
			and official prices above are still available.
		</p>
	{:else}
		<p>
			<strong>
				{data.results.totalPassed} of {data.results.totalTrials} verified trials passed
			</strong>
			across {data.results.groups.length} comparable
			{data.results.groups.length === 1 ? 'group' : 'groups'} and
			{data.results.runs.length} run{data.results.runs.length === 1 ? '' : 's'}.
		</p>
		<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-labelledby="results-heading" tabindex="0">
			<table class="stacked-table results-table">
				<caption class="visually-hidden">
					Verified trials for {model.displayName} by task, suite, stack, harness, provider and trial model
					ID
				</caption>
				<thead>
					<tr>
						<th scope="col">Task and suite</th>
						<th scope="col">Stack</th>
						<th scope="col">Harness</th>
						<th scope="col">Trial model and provider</th>
						<th scope="col" class="num">Passed</th>
						<th scope="col" class="num">Mean agent time</th>
						<th scope="col">Runs and compare</th>
					</tr>
				</thead>
				<tbody>
					{#each data.results.groups as group (group.key)}
						<tr>
							<th scope="row" data-label="Task and suite">
								{group.task} v{group.taskVersion}
								<br />
								<span class="sub">
									suite <code class="nowrap" title={group.suite}>{suiteLabel(group.suite)}</code>
								</span>
							</th>
							<td class="nowrap" data-label="Stack">{group.stack}</td>
							<td data-label="Harness">
								{group.harness}
								<br />
								<span class="sub">
									{group.toolingMode} · {group.authMode} · {group.maxRepairs} repairs ·
									{group.maxParallel} parallel
								</span>
							</td>
							<td data-label="Trial model and provider">
								<code class="nowrap">{group.model}</code>
								<br />
								<span class="sub">
									provider {#if group.provider === null}<span class="unavailable">
											not recorded
										</span>{:else}{group.provider}{/if}
								</span>
							</td>
							<td class="num" data-label="Passed">
								{group.passed}/{group.trials}
								<span class="sub">({percent(group.passed / group.trials)})</span>
								{#if group.rateLimited > 0}
									<br /><span class="sub">{group.rateLimited} rate-limited</span>
								{/if}
								{#if group.trials < 3}
									<br /><span class="badge warn" title="Fewer than 3 trials"> Low confidence </span>
								{/if}
							</td>
							<td class="num" data-label="Mean agent time">
								<Metric value={group.meanSeconds} format={duration} />
								<span class="sub">({group.timed} timed)</span>
							</td>
							<td data-label="Runs and compare">
								{#each group.runs as run, index (run)}
									{#if index > 0}<br />{/if}
									<span class="nowrap">
										<Link path={`/runs/${encodeURIComponent(run)}/`}>{run}</Link>
									</span>
								{/each}
								{#if group.compareHref}
									<br />
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- compare URLs carry query state -->
									<a href={withBase(group.compareHref)}>Compare this group</a>
								{:else}
									<br /><span class="sub">Compare needs a recorded provider.</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="sub">
			Agent time is the mean over timed, passed, non-rate-limited trials; rate-limited trials stay
			in the trial total. Low confidence means fewer than 3 trials in the group.
		</p>
	{/if}
</section>

{#if model.notes.length > 0}
	<section aria-labelledby="notes-heading">
		<h2 id="notes-heading">Notes</h2>
		<ul class="links">
			{#each model.notes as note (note)}
				<li>{note}</li>
			{/each}
		</ul>
	</section>
{/if}
