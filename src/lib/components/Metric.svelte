<script lang="ts">
	// A number from the export, or "unavailable" when the export has none. Never 0 or blank.
	let { value, format }: { value: number | null | undefined; format: (n: number) => string } =
		$props();
</script>

{#if value === null || value === undefined}<span class="unavailable">
		unavailable
	</span>{:else}{format(value)}{/if}
