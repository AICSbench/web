<script lang="ts">
	import Link from '#lib/components/Link.svelte';
	import Metric from '#lib/components/Metric.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import { day, duration, percent, providerLabel, usd, versionChanged } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const run = $derived(data.run!);
	const first = $derived(run.trials[0]);
	const verified = $derived(first?.verified ?? false);
	const groups = $derived(run.groups);
	const combinations = $derived(groups.reduce((count, group) => count + group.rows.length, 0));
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

	<section aria-labelledby="stack-summary">
		<h2 id="stack-summary">Summary by stack</h2>
		<p class="sub">
			{run.trials.length} trials in {groups.length}
			{groups.length === 1 ? 'stack' : 'stacks'}, split into {combinations}
			{combinations === 1
				? 'stack + harness + model combination'
				: 'stack + harness + model combinations'}. Each combination has its own row. Mean agent time
			covers timed passed trials; rate-limited trials are excluded.
		</p>
		<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-labelledby="stack-summary" tabindex="0">
			<table aria-label="Summary by stack">
				<thead>
					<tr>
						<th scope="col">Stack</th>
						<th scope="col">Harness</th>
						<th scope="col">Model</th>
						<th scope="col" class="num">Trials</th>
						<th scope="col" class="num">Passed</th>
						<th scope="col" class="num">Pass rate</th>
						<th scope="col" class="num">Mean agent time</th>
					</tr>
				</thead>
				{#each groups as group (group.stack)}
					<tbody>
						{#each group.rows as row, rowIndex (JSON.stringify([row.harness, row.model]))}
							<tr>
								{#if rowIndex === 0}
									<th scope="rowgroup" rowspan={group.rows.length} class="stack-cell">
										{group.stack}
									</th>
								{/if}
								<td>{row.harness}</td>
								<td>{row.model}</td>
								<td class="num">{row.trials}</td>
								<td class="num">{row.passed}</td>
								<td class="num">{percent(row.pass_rate)}</td>
								<td class="num">
									<Metric value={row.mean_agent_seconds} format={duration} />
									{#if row.mean_agent_seconds !== null}
										<span class="sub">({row.timed} timed)</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				{/each}
			</table>
		</div>
	</section>

	<section aria-labelledby="trials">
		<h2 id="trials">Trials by stack</h2>
		<p class="sub">Expand a stack to see its individual trials.</p>
		{#each groups as group (group.stack)}
			<details class="stack-group">
				<summary>
					<span class="stack-name">{group.stack}</span>
					<span class="sub">
						{group.trials.length}
						{group.trials.length === 1 ? 'trial' : 'trials'}
					</span>
				</summary>
				<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="table-scroll" role="region" aria-label="Trials in {group.stack}" tabindex="0">
					<table aria-label="Trials in {group.stack}">
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
							{#each group.trials as trial (trial.trial_id)}
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
			</details>
		{/each}
	</section>
</PageView>

<style>
	.stack-group {
		border: 1px solid var(--border);
		border-radius: 8px;
		margin: 0.75rem 0;
		padding: 0 0.25rem;
	}

	.stack-group > summary {
		cursor: pointer;
		padding: 0.65rem 0.5rem;
		font-weight: 600;
	}

	.stack-group > summary:hover {
		background: var(--surface);
	}

	.stack-group[open] > summary {
		border-bottom: 1px solid var(--border);
		margin-bottom: 0.5rem;
	}

	.stack-name {
		margin-right: 0.75rem;
	}

	.stack-group > summary .sub {
		font-weight: 400;
	}

	th.stack-cell {
		vertical-align: middle;
	}
</style>
