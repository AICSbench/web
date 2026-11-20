<script lang="ts" module>
	/**
	 * JSON for an inline <script>: JSON.stringify, then every <, > and & as a Unicode
	 * escape (not an HTML entity), so no value can close the script element.
	 */
	export function scriptJson(value: unknown): string {
		return JSON.stringify(value)
			.replaceAll('<', '\\u003c')
			.replaceAll('>', '\\u003e')
			.replaceAll('&', '\\u0026');
	}
</script>

<script lang="ts">
	let {
		title,
		description,
		canonical,
		jsonLd
	}: { title: string; description: string; canonical: string; jsonLd: object } = $props();

	const script = $derived(`<script type="application/ld+json">${scriptJson(jsonLd)}</` + 'script>');
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="AICSbench" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
	<!-- The only {@html} in the app: scriptJson() escapes <, > and &, so values cannot leave the script. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- reviewed: JSON-LD serialized by scriptJson() -->
	{@html script}
</svelte:head>
