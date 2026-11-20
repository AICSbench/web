<script lang="ts">
	// One leaderboard section from pages.json, in the order the export gives its rows.
	import BarChart from './BarChart.svelte';
	import Metric from './Metric.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import { axisLabel, duration, percent, usd } from '#lib/format.ts';
	import type { Section } from '#lib/types/export.ts';

	let { section, headingLevel = 2 }: { section: Section; headingLevel?: 2 | 3 } = $props();

	const id = $props.id();
	const label = $derived(axisLabel(section.by));
</script>

<section class="leaderboard" aria-labelledby="{id}-heading">
	<SectionHeader {section} id="{id}-heading" level={headingLevel} />

	{#if section.refused !== null}
		<p class="refused" role="note">
			<strong>Not compared:</strong>
			{section.refused}
		</p>
	{:else if section.rows.length === 0}
		<p class="unavailable">No results in this section.</p>
	{:else}
		<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-labelledby="{id}-heading" tabindex="0">
			<table>
				<thead>
					<tr>
						<th scope="col" class="num">#</th>
						<th scope="col">{label}</th>
						<th scope="col" class="num">Success rate</th>
						<th scope="col" class="num">Mean agent time ± SD</th>
						<th scope="col" class="num">Mean cost</th>
						<th scope="col" class="num">Trials</th>
						<th scope="col">Confidence</th>
					</tr>
				</thead>
				<tbody>
					{#each section.rows as row, index (index)}
						<tr>
							<td class="num">{index + 1}</td>
							<th scope="row" class="value">{row.value}</th>
							<td class="num">
								{percent(row.success_rate)}
								<span class="sub">({row.passed}/{row.trials})</span>
							</td>
							<td class="num">
								<Metric
									value={row.mean_seconds}
									format={duration}
								/>{#if row.mean_seconds !== null && row.stdev_seconds !== null}
									{` ± ${duration(row.stdev_seconds)}`}{/if}
								{#if row.mean_seconds !== null}<span class="sub">({row.timed} timed)</span>{/if}
							</td>
							<td class="num">
								<Metric value={row.mean_cost_usd} format={usd} />
								{#if row.mean_cost_usd !== null}<span class="sub">
										({row.cost_samples} costed)
									</span>{/if}
							</td>
							<td class="num">
								{row.trials}{#if row.rate_limited > 0}
									<span class="sub">({row.rate_limited} rate-limited)</span>{/if}
							</td>
							<td>
								{#if row.low_confidence}
									<span class="badge warn" title="Fewer than 3 trials">Low confidence</span>
								{:else}
									<span class="sub">ok</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="charts">
			<BarChart rows={section.rows} metric="success" {label} />
			<BarChart rows={section.rows} metric="time" {label} />
		</div>
	{/if}
</section>

<style>
	.leaderboard {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0 1.5rem;
		min-width: 0;
	}

	th.value {
		font-weight: 600;
		background: none;
		overflow-wrap: anywhere;
		min-width: 9rem;
	}

	.refused {
		background: var(--warn-bg);
		color: var(--warn-text);
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
	}

	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem 2rem;
	}
</style>
