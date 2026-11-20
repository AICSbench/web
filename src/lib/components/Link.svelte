<script lang="ts">
	// A link to a path from the export ("/tasks/x/"), under the site's base path.
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let { path, children }: { path: string; children: Snippet } = $props();

	// Export paths are root-relative and only known at build time, so they cannot match
	// resolve()'s typed route list; resolve() takes them without the leading "/".
	const resolvePath = resolve as unknown as (pathname: string) => string;
	const href = $derived(resolvePath(path.replace(/^\//, '')));
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from resolve() above -->
<a {href}>{@render children()}</a>
