<script lang="ts">
	// A /leaderboard/ section: harness + model rows, one column per task (compare_matrix).
	import Link from './Link.svelte';
	import Metric from './Metric.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import { duration, percent, providerLabel } from '#lib/format.ts';
	import type { Matrix, Section } from '#lib/types/export.ts';

	let {
		section,
		matrix,
		headingLevel = 2,
		providers = {}
	}: {
		section: Section;
		matrix: Matrix;
		headingLevel?: 2 | 3;
		providers?: Record<string, string>;
	} = $props();

	const id = $props.id();
	const rank = (n: number) => n.toFixed(2);
	const refusals = $derived(matrix.columns.filter((column) => column.refused !== null));
</script>

<section class="matrix" aria-labelledby="{id}-heading">
	<SectionHeader {section} id="{id}-heading" level={headingLevel} />

	{#if section.refused !== null}
		<p class="refused" role="note"><strong>Not compared:</strong> {section.refused}</p>
	{:else if matrix.rows.length === 0}
		<p class="unavailable">No results in this section.</p>
	{:else}
		<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-labelledby="{id}-heading" tabindex="0">
			<table>
				<thead>
					<tr>
						<th scope="col">Harness + model</th>
						{#each matrix.columns as column, index (index)}
							<th scope="col">
								<Link path={column.path}>{column.task}</Link>
								<span class="sub">
									{#if column.task_version !== null}v{column.task_version}{:else}version
										<span class="unavailable">unavailable</span>{/if}
								</span>
								{#if column.refused !== null}
									<span class="badge warn">Not compared</span>
								{/if}
							</th>
						{/each}
						<th scope="col" class="num">Overall success</th>
						<th scope="col" class="num">Coverage</th>
						<th scope="col" class="num">Mean rank</th>
					</tr>
				</thead>
				<tbody>
					{#each matrix.rows as row, rowIndex (rowIndex)}
						<tr>
							<th scope="row" class="value">
								{row.value}
								{#if providers[row.value]}
									<span class="badge provider">{providerLabel(providers[row.value])}</span>
								{/if}
								{#if !row.overall.complete}<span class="badge warn">Incomplete</span>{/if}
							</th>
							{#each row.cells as cell, index (index)}
								<td class="num">
									{#if matrix.columns[index]?.refused !== null}
										<span class="unavailable">not compared</span>
									{:else if cell === null}
										<span class="unavailable">no result</span>
									{:else}
										{percent(cell.success_rate)}
										<span class="sub">({cell.passed}/{cell.trials})</span><br />
										<span class="sub"><Metric value={cell.mean_seconds} format={duration} /></span>
										{#if cell.low_confidence}<br /><span
												class="badge warn"
												title="Fewer than 3 trials"
											>
												Low confidence
											</span>{/if}
									{/if}
								</td>
							{/each}
							<td class="num"><Metric value={row.overall.success_rate} format={percent} /></td>
							<td class="num">{row.overall.covered}/{row.overall.columns}</td>
							<td class="num">
								<Metric value={row.overall.mean_rank} format={rank} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if refusals.length > 0}
			<ul class="refusals">
				{#each refusals as column, index (index)}
					<li><strong>{column.task}</strong> not compared: {column.refused}</li>
				{/each}
			</ul>
		{/if}
		<p class="sub">
			Overall success is the unweighted mean of the row's per-task success rates; coverage counts
			the tasks it has results for. Rows missing a task follow the complete rows.
		</p>
	{/if}
</section>

<style>
	.matrix {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0 1.5rem;
		min-width: 0;
	}

	th.value {
		background: none;
		overflow-wrap: anywhere;
		min-width: 9rem;
	}

	.refused,
	.refusals {
		background: var(--warn-bg);
		color: var(--warn-text);
		padding: 0.6rem 0.8rem 0.6rem 1.6rem;
		border-radius: 6px;
	}

	.refused {
		padding-left: 0.8rem;
	}
</style>
