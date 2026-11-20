<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import Link from '#lib/components/Link.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip" href="#main">Skip to content</a>
<header class="site">
	<nav aria-label="Site">
		<Link path="/"><strong>AICSbench</strong></Link>
		<Link path="/leaderboard/">Leaderboard</Link>
		<Link path="/compare/">Compare</Link>
		<Link path="/methodology/">Methodology</Link>
	</nav>
</header>
<main id="main">
	{@render children()}
</main>
<footer class="site">
	<p>
		Results are published under <a href="https://creativecommons.org/licenses/by/4.0/">
			CC BY 4.0
		</a>. Download the data: <Link path="/data/trials.json">trials.json</Link> ·
		<Link path="/data/meta.json">meta.json</Link>.
	</p>
</footer>

<style>
	.skip {
		position: absolute;
		left: -999px;
	}

	.skip:focus {
		left: 1rem;
		top: 0.5rem;
		background: var(--bg);
		padding: 0.25rem 0.5rem;
	}

	header.site {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		max-width: 72rem;
		margin: 0 auto;
		padding: 0.75rem 1rem;
	}

	main {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 2rem;
	}

	footer.site {
		border-top: 1px solid var(--border);
		color: var(--muted);
		font-size: 0.85rem;
	}

	footer.site p {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1rem;
	}
</style>
