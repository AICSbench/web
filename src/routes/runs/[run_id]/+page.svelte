<script lang="ts">
	import Link from '#lib/components/Link.svelte';
	import Metric from '#lib/components/Metric.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import { day, duration, providerLabel, usd, versionChanged } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const run = $derived(data.run!);
	const first = $derived(run.trials[0]);
	const verified = $derived(first?.verified ?? false);
	const tokens = (n: number) => n.toLocaleString('en-US');
</script>

<PageView {data}>
	<p>
		{#if verified}<span class="badge verified">Verified run</span>{:else}<span
				class="badge community"
			>
				Community result
			</span> <span class="sub">Not verified by a maintainer.</span>{/if}
	</p>
	<dl class="facts">
		<dt>Run ID</dt>
		<dd><code>{data.page.params.run_id}</code></dd>
		<dt>Task</dt>
		<dd>
			<Link path="/tasks/{data.page.params.task}/">{data.page.params.task}</Link>
			version {data.page.params.task_version}
		</dd>
		<dt>Submitter</dt>
		<dd>
			{run.submission.submitter.name}
			{#if run.submission.submitter.github !== null}
				(<a href="https://github.com/{run.submission.submitter.github}">
					@{run.submission.submitter.github}
				</a>){/if}
		</dd>
		<dt>Submitted</dt>
		<dd>{day(run.submission.submitted_at)}</dd>
		<dt>Notes</dt>
		<dd>
			{#if run.submission.notes}{run.submission.notes}{:else}<span class="unavailable">
					none
				</span>{/if}
		</dd>
		<dt>Platform version</dt>
		<dd>{run.submission.platform_version}</dd>
		<dt>Logs</dt>
		<dd>
			{#if run.submission.logs_included}<span class="badge verified">
					Logs available
				</span>{:else}<span class="unavailable">not included</span>{/if}
		</dd>
		<dt>Acceptance suite</dt>
		<dd><code>{first?.suite_sha256 ?? 'unavailable'}</code></dd>
		<dt>Raw bundle</dt>
		<dd>
			{#if run.bundle !== null}<a href="https://github.com/aicsbench/data/tree/main/{run.bundle}">
					{run.bundle}
				</a> on GitHub{:else}<span class="unavailable"> unavailable </span>{/if}
		</dd>
		<dt>Downloads</dt>
		<dd>
			<ul class="inline">
				{#each run.files as file (file)}
					<li><Link path="/{file}">{file.split('/').pop()}</Link></li>
				{/each}
			</ul>
		</dd>
	</dl>

	<section aria-labelledby="trials">
		<h2 id="trials">Trials</h2>
		<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-labelledby="trials" tabindex="0">
			<table>
				<thead>
					<tr>
						<th scope="col">Trial</th>
						<th scope="col">Status</th>
						<th scope="col">Harness</th>
						<th scope="col">Model</th>
						<th scope="col">Provider</th>
						<th scope="col">Stack</th>
						<th scope="col" class="num">Agent time</th>
						<th scope="col" class="num">Tests</th>
						<th scope="col" class="num">Tokens</th>
						<th scope="col" class="num">Cost</th>
					</tr>
				</thead>
				<tbody>
					{#each run.trials as trial (trial.trial_id)}
						<tr>
							<th scope="row" class="nowrap"><code>{trial.trial_id}</code></th>
							<td>
								{trial.status}{#if trial.rate_limited}
									<span class="badge warn">rate-limited</span>{/if}
							</td>
							<td>
								{trial.harness}
								<span class="sub">
									{#if trial.harness_version !== null}{trial.harness_version}{:else}version
										unavailable{/if}
								</span>
							</td>
							<td class="nowrap">
								{trial.model}{#if trial.reasoning_effort !== null}
									<span class="sub">({trial.reasoning_effort})</span>{/if}
							</td>
							<td>
								{#if trial.provider !== null && trial.provider !== undefined}{trial.provider}{:else}<span
										class="unavailable"
									>
										{providerLabel('unknown')}
									</span>{/if}{#if trial.endpoint_host !== null && trial.endpoint_host !== undefined}
									<span class="sub">via {trial.endpoint_host}</span>{/if}
							</td>
							<td>
								{trial.stack}<br />
								<span class="sub nowrap">
									{trial.language}
									{trial.language_version_installed ?? trial.language_version} · {trial.framework}
									{trial.framework_version_installed ?? trial.framework_version}
								</span>
								{#if versionChanged(trial)}
									<br /><span class="badge warn">version changed during trial</span>
								{/if}
							</td>
							<td class="num"><Metric value={trial.agent_seconds} format={duration} /></td>
							<td class="num">
								{#if trial.tests_total !== null && trial.tests_passed !== null}{trial.tests_passed}/{trial.tests_total}{:else}<span
										class="unavailable"
									>
										unavailable
									</span>{/if}
							</td>
							<td class="num"><Metric value={trial.total_tokens} format={tokens} /></td>
							<td class="num"><Metric value={trial.cost_usd} format={usd} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</PageView>
