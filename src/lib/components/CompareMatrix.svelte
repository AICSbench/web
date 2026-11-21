<script lang="ts">
	// The interactive matrix: rows are compare-by groups, columns are tasks.
	// Each column is its own comparison; a refused column is left out of every
	// overall and of the coverage count.
	import Metric from './Metric.svelte';
	import { duration, percent, providerLabel } from '#lib/format.ts';
	import type { MatrixColumnView, MatrixRowView } from '#lib/compare/types.ts';

	let {
		columns,
		rows,
		byLabel,
		providers = {}
	}: {
		columns: MatrixColumnView[];
		rows: MatrixRowView[];
		byLabel: string;
		providers?: Record<string, string>;
	} = $props();

	const id = $props.id();
	const rank = (value: number) => value.toFixed(2);
</script>

<section class="matrix" aria-labelledby="{id}-heading">
	<h2 id="{id}-heading">{byLabel} across tasks</h2>
	<p class="sub">
		Each column is one task version with its own comparison. A refused column shows its message and
		is left out of every overall and of the coverage count.
	</p>

	{#if rows.length === 0}
		<p class="unavailable">No results in this matrix.</p>
	{:else}
		<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-labelledby="{id}-heading" tabindex="0">
			<table>
				<thead>
					<tr>
						<th scope="col">{byLabel}</th>
						{#each columns as column, index (index)}
							<th scope="col">
								{#if column.refused === null}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- compare URLs carry query state -->
									<a href={column.href}>{column.task}</a>
								{:else}
									{column.task}
								{/if}
								<span class="sub">
									{#if column.task_version !== null}v{column.task_version}{:else}version
										<span class="unavailable">unavailable</span>{/if}
								</span>
								{#if column.refused !== null}
									<br /><span class="badge warn">Not compared</span>
									<span class="refusal">{column.refused}</span>
								{/if}
							</th>
						{/each}
						<th scope="col" class="num">Overall success</th>
						<th scope="col" class="num">Coverage</th>
						<th scope="col" class="num">Mean rank</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, rowIndex (rowIndex)}
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
									{#if columns[index]?.refused !== null}
										<span class="unavailable">not compared</span>
									{:else if cell === null}
										<span class="unavailable">no result</span>
									{:else}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- compare URLs carry query state -->
										<a href={columns[index].href}>{percent(cell.success_rate)}</a>
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
							<td class="num"><Metric value={row.overall.mean_rank} format={rank} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="sub">
			Overall success is the unweighted mean of the row's per-task success rates; coverage counts
			the tasks it has results for. Rows missing a task follow the complete rows. Agent times are
			not averaged across tasks; mean rank is the row's mean 1-based position in each column.
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

	.refusal {
		display: block;
		font-weight: 400;
		font-size: 0.8rem;
		max-width: 16rem;
		white-space: normal;
	}
</style>
