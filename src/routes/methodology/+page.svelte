<script lang="ts">
	import Link from '#lib/components/Link.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageView {data}>
	<div class="prose">
		<h2>How trials run</h2>
		<p>
			A <strong>run</strong> gives one task to one or more agent packages. Each
			<strong>trial</strong> starts the agent (the <strong>harness</strong>, such as Claude Code,
			Codex or OpenCode, with a <strong>model</strong>) in a fresh workspace on one
			<strong>stack</strong> (a language and framework). When the agent stops, the task's fixed acceptance
			suite runs against its work. A trial passes when the suite passes.
		</p>

		<h2>What each number means</h2>
		<dl class="facts">
			<dt>Success rate</dt>
			<dd>Passed trials divided by all trials in the group.</dd>
			<dt>Mean agent time ± SD</dt>
			<dd>
				Mean and standard deviation of the agent's own execution time over the timed passed trials.
				Leaderboards are ordered by it, lowest first.
			</dd>
			<dt>Mean cost</dt>
			<dd>Mean reported cost in US dollars over the trials that reported one.</dd>
			<dt>Trials</dt>
			<dd>How many trials the group holds.</dd>
			<dt>Low confidence</dt>
			<dd>The group has fewer than 3 trials. It is shown, but treat it with care.</dd>
			<dt>Unavailable</dt>
			<dd>
				The agent did not report the metric. It is never shown as zero, and it never counts as zero
				in a mean.
			</dd>
		</dl>

		<h2>Comparability</h2>
		<p>
			Results are only compared when they share the task and task version, tooling mode, auth mode,
			repair budget, parallelism and acceptance suite. Each leaderboard lists the values it holds
			fixed. When a comparison would mix another dimension, the page splits the leaderboard ("per
			stack", "per harness + model") or shows why it was not compared instead of a table. A harness
			+ model leaderboard ranks whole packages, so its rows can use different providers.
		</p>

		<h2>Verified and community results</h2>
		<p>
			Anyone can submit a run as a pull request to
			<a href="https://github.com/aicsbench/data">aicsbench/data</a>. A run is
			<span class="badge verified">verified</span> when a maintainer lists it. Default rankings show
			verified runs only; other runs appear separately as
			<span class="badge community">community results</span>.
		</p>

		<h2>Data</h2>
		<p>
			Every number on this site comes from the <code>aicsbench site export</code>; the site does not
			compute any. Download <Link path="/data/trials.json">every trial</Link>, published under CC BY
			4.0.
		</p>
	</div>
</PageView>
