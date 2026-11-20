<script lang="ts">
	// Bars drawn as inline SVG, prerendered with the page. Each row's label and value are
	// HTML text above its bar, so a long label wraps instead of running into the value.
	import { duration, percent } from '#lib/format.ts';
	import type { Row } from '#lib/types/export.ts';

	let { rows, metric, label }: { rows: Row[]; metric: 'success' | 'time'; label: string } =
		$props();

	const title = $derived(
		metric === 'success' ? `Success rate by ${label}` : `Mean agent time by ${label}, ± 1 SD`
	);

	// Largest value on the time axis: mean plus one standard deviation.
	const timeMax = $derived(
		Math.max(0, ...rows.map((row) => (row.mean_seconds ?? 0) + (row.stdev_seconds ?? 0)))
	);

	function share(value: number): number {
		const max = metric === 'success' ? 1 : timeMax;
		return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
	}

	function text(row: Row): string {
		if (metric === 'success') return `${percent(row.success_rate)} (${row.passed}/${row.trials})`;
		if (row.mean_seconds === null) return 'unavailable';
		const sd = ` ± ${row.stdev_seconds === null ? 'SD unavailable' : duration(row.stdev_seconds)}`;
		return `${duration(row.mean_seconds)}${sd}`;
	}
</script>

<figure class="chart">
	<ul>
		{#each rows as row, index (index)}
			<li>
				<div class="head">
					<span class="label">{row.value}</span>
					<span class="value" class:missing={metric === 'time' && row.mean_seconds === null}>
						{text(row)}
					</span>
				</div>
				<svg width="100%" height="14" aria-hidden="true">
					<rect class="track" x="0" y="0" width="100%" height="14" rx="2" />
					{#if metric === 'success'}
						<rect class="bar" x="0" y="0" width="{share(row.success_rate)}%" height="14" rx="2" />
					{:else if row.mean_seconds !== null}
						<rect
							class="bar time"
							x="0"
							y="0"
							width="{share(row.mean_seconds)}%"
							height="14"
							rx="2"
						/>
						{#if row.stdev_seconds !== null && row.stdev_seconds > 0}
							{@const low = share(Math.max(0, row.mean_seconds - row.stdev_seconds))}
							{@const high = share(row.mean_seconds + row.stdev_seconds)}
							<line class="whisker" x1="{low}%" x2="{high}%" y1="7" y2="7" />
							<line class="whisker" x1="{low}%" x2="{low}%" y1="2" y2="12" />
							<line class="whisker" x1="{high}%" x2="{high}%" y1="2" y2="12" />
						{/if}
					{/if}
				</svg>
			</li>
		{/each}
	</ul>
	<figcaption>{title}</figcaption>
</figure>

<style>
	.chart {
		margin: 0;
		min-width: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		margin-bottom: 0.6rem;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0 0.75rem;
		font-size: 13px;
		line-height: 1.35;
		margin-bottom: 0.2rem;
	}

	.label {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.value {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.missing {
		color: var(--muted);
		font-style: italic;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.track {
		fill: var(--track);
	}

	.bar {
		fill: var(--bar);
	}

	.bar.time {
		fill: var(--bar-time);
	}

	.whisker {
		stroke: var(--whisker);
		stroke-width: 1.5;
	}

	figcaption {
		color: var(--muted);
		font-size: 0.8rem;
		margin-top: 0.25rem;
	}
</style>
