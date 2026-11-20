<script lang="ts">
	// Inline SVG bars, prerendered with the page. Bar positions use percentages so the
	// chart stretches to its container while the text keeps its size on small screens.
	import { duration, percent } from '#lib/format.ts';
	import type { Row } from '#lib/types/export.ts';

	let { rows, metric, label }: { rows: Row[]; metric: 'success' | 'time'; label: string } =
		$props();

	const id = $props.id();
	const ROW = 44;

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
		const sd = row.stdev_seconds === null ? '' : ` ± ${duration(row.stdev_seconds)}`;
		return `${duration(row.mean_seconds)}${sd}`;
	}

	const summary = $derived(rows.map((row) => `${row.value}: ${text(row)}`).join('; '));
</script>

<figure class="chart">
	<svg
		width="100%"
		height={rows.length * ROW + 4}
		role="img"
		aria-labelledby="{id}-title {id}-desc"
	>
		<title id="{id}-title">{title}</title>
		<desc id="{id}-desc">{summary}</desc>
		{#each rows as row, index (index)}
			{@const y = index * ROW}
			<text class="label" x="0" y={y + 14}>{row.value}</text>
			<text
				class="value"
				class:missing={metric === 'time' && row.mean_seconds === null}
				x="100%"
				y={y + 14}
				text-anchor="end"
			>
				{text(row)}
			</text>
			<rect class="track" x="0" y={y + 20} width="100%" height="14" rx="2" />
			{#if metric === 'success'}
				<rect class="bar" x="0" y={y + 20} width="{share(row.success_rate)}%" height="14" rx="2" />
			{:else if row.mean_seconds !== null}
				<rect
					class="bar time"
					x="0"
					y={y + 20}
					width="{share(row.mean_seconds)}%"
					height="14"
					rx="2"
				/>
				{#if row.stdev_seconds !== null && row.stdev_seconds > 0}
					{@const low = share(Math.max(0, row.mean_seconds - row.stdev_seconds))}
					{@const high = share(row.mean_seconds + row.stdev_seconds)}
					<line class="whisker" x1="{low}%" x2="{high}%" y1={y + 27} y2={y + 27} />
					<line class="whisker" x1="{low}%" x2="{low}%" y1={y + 22} y2={y + 32} />
					<line class="whisker" x1="{high}%" x2="{high}%" y1={y + 22} y2={y + 32} />
				{/if}
			{/if}
		{/each}
	</svg>
	<figcaption>{title}</figcaption>
</figure>

<style>
	.chart {
		margin: 0;
		min-width: 0;
	}

	svg {
		display: block;
		overflow: visible;
	}

	text {
		fill: var(--text);
		font-size: 13px;
	}

	.value {
		font-variant-numeric: tabular-nums;
	}

	.missing {
		fill: var(--muted);
		font-style: italic;
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
