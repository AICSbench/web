<script lang="ts">
	// A collapsible checkbox list for one filter. Empty means "all".
	let {
		label,
		values,
		selected,
		onChange,
		display = (value: string) => value,
		highlight = false
	}: {
		label: string;
		values: readonly string[];
		selected: readonly string[];
		onChange: (values: string[]) => void;
		display?: (value: string) => string;
		highlight?: boolean;
	} = $props();

	const all = $derived([...new Set([...values, ...selected])].sort());
	const summary = $derived(
		selected.length === 0 ? 'all' : selected.map((value) => display(value)).join(', ')
	);

	function toggle(value: string, checked: boolean): void {
		onChange(checked ? [...selected, value] : selected.filter((candidate) => candidate !== value));
	}
</script>

<details class="multi" class:attention={highlight}>
	<summary title={summary}>
		<span class="label">{label}</span>
		<span class="value">{summary}</span>
	</summary>
	<div class="options">
		{#each all as value (value)}
			<label>
				<input
					type="checkbox"
					checked={selected.includes(value)}
					aria-label="{label}: {display(value)}"
					onchange={(event) => toggle(value, event.currentTarget.checked)}
				/>
				{display(value)}
			</label>
		{:else}
			<span class="unavailable">No values</span>
		{/each}
	</div>
</details>

<style>
	.multi {
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		min-width: 0;
	}

	.multi.attention {
		border-color: var(--focus);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 35%, transparent);
	}

	summary {
		cursor: pointer;
		padding: 0.35rem 0.5rem;
		display: grid;
		grid-template-columns: minmax(5rem, auto) 1fr;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.label {
		color: var(--muted);
	}

	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.options {
		display: grid;
		gap: 0.15rem;
		max-height: 12rem;
		overflow: auto;
		padding: 0.25rem 0.5rem 0.5rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	label {
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
	}
</style>
