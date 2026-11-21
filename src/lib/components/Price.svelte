<script lang="ts">
	// A maker's USD rate per million tokens, or "Not available". Never zero for unknown.
	import { usdPerMillion } from '#lib/format.ts';

	let { value }: { value: number | null } = $props();
</script>

{#if value === null}<span class="unavailable">Not available</span>{:else}{usdPerMillion(value)}{/if}
