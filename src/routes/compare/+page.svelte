<script lang="ts">
	import { onMount } from 'svelte';
	import CompareMatrix from '#lib/components/CompareMatrix.svelte';
	import Leaderboard from '#lib/components/Leaderboard.svelte';
	import Link from '#lib/components/Link.svelte';
	import MultiSelect from '#lib/components/MultiSelect.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import {
		compareMatrix,
		compareSingle,
		type MatrixComparison,
		type SingleComparison
	} from '#lib/compare/compare.ts';
	import { dimensionLabel, modelKey, normalizeDimensions } from '#lib/compare/dimensions.ts';
	import { distinct, suitesOf, versionsOf } from '#lib/compare/filters.ts';
	import { loadCompareData } from '#lib/compare/query.ts';
	import { refusalFilter } from '#lib/compare/refusals.ts';
	import {
		DIMENSION_LABELS,
		DIMENSIONS,
		type CompareData,
		type Dimension,
		type FilterState,
		type Selection
	} from '#lib/compare/types.ts';
	import {
		canonicalSearch,
		defaultSelection,
		parseSelection,
		suiteLabel
	} from '#lib/compare/url.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let ready = $state(false);
	let loadError = $state<string | null>(null);
	let engine = $state<CompareData | null>(null);
	let selection = $state<Selection>(defaultSelection());
	let suiteError = $state<string | null>(null);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let runError = $state<string | null>(null);
	let single = $state<SingleComparison | null>(null);
	let matrix = $state<MatrixComparison | null>(null);
	let token = 0;

	onMount(() => {
		void load();
	});

	async function load(): Promise<void> {
		try {
			const loaded = await loadCompareData();
			engine = loaded;
			const parsed = parseSelection(window.location.search, loaded.rows);
			selection = parsed;
			suiteError = parsed.suiteError;
			ready = true;
			await refresh();
		} catch (error) {
			loadError = (error as Error).message;
		}
	}

	async function refresh(): Promise<void> {
		if (engine === null) return;
		const current = ++token;
		status = 'loading';
		runError = null;
		single = null;
		matrix = null;
		try {
			if (suiteError !== null) {
				status = 'done';
				return;
			}
			if (selection.view === 'single') {
				single = await compareSingle(engine, selection);
			} else {
				matrix = await compareMatrix(engine, selection, window.location.pathname);
			}
			if (current !== token) return;
			status = 'done';
			syncUrl();
		} catch (error) {
			if (current !== token) return;
			runError = (error as Error).message;
			status = 'error';
		}
	}

	function syncUrl(): void {
		if (engine === null) return;
		const search = canonicalSearch(selection, engine.rows);
		const url = search === '' ? window.location.pathname : `${window.location.pathname}?${search}`;
		window.history.replaceState(null, '', url);
	}

	const taskIds = $derived(engine === null ? [] : distinct(engine.rows.map((row) => row.task)));

	const filterValues = $derived.by(() => {
		const rows = engine?.rows ?? [];
		return {
			harness: distinct(rows.map((row) => row.harness)),
			harness_version: distinct(rows.map((row) => row.harness_version ?? 'unknown')),
			model: distinct([...rows.map((row) => row.model), ...rows.map((row) => modelKey(row))]),
			stack: distinct(rows.map((row) => row.stack)),
			language: distinct(rows.map((row) => row.language)),
			framework: distinct(rows.map((row) => row.framework)),
			provider: distinct(rows.map((row) => row.provider ?? 'unknown')),
			mode: distinct(rows.map((row) => row.tooling_mode)),
			auth: distinct(rows.map((row) => row.auth_mode)),
			repairs: distinct(rows.map((row) => row.max_repairs)).map(String),
			parallel: distinct(rows.map((row) => row.max_parallel)).map(String)
		};
	});

	const suites = $derived(engine === null ? [] : suitesOf(engine.rows));
	const byLabel = $derived(dimensionLabel(selection.by));
	const byError = $derived(normalizeDimensions(selection.by).error);
	const hasTask = $derived(
		selection.view === 'single' ? selection.task !== null : selection.tasks.length > 0
	);
	const hint = $derived(
		single?.refused
			? refusalFilter(single.refused)
			: matrix?.refused
				? refusalFilter(matrix.refused)
				: byError
					? 'by'
					: null
	);
	const hintText = $derived(
		single?.refused
			? refusalHint(single.refused)
			: matrix?.refused
				? refusalHint(matrix.refused)
				: byError
					? 'Choose one to three dimensions.'
					: null
	);

	const sectionBy = $derived(selection.by.length === 1 ? selection.by[0] : byLabel);
	const section = $derived({
		heading: `Custom comparison · ${byLabel}`,
		fixed: {
			...(single?.task ? { task: single.task } : {}),
			...(single?.task_version ? { task_version: single.task_version } : {}),
			...(selection.filters.suite ? { suite_sha256: selection.filters.suite } : {})
		},
		by: sectionBy,
		verified_only: selection.filters.verified,
		rows: single?.rows ?? [],
		refused: single?.refused ?? null,
		matrix: null
	});

	function refusalHint(message: string): string {
		if (message.includes('acceptance suites')) return 'Pick one acceptance suite.';
		if (message.includes('mixes providers')) {
			return 'Filter to one provider, or exclude gateway and unrecorded-provider trials.';
		}
		if (message.includes('recorded provider')) {
			return 'Filter to a recorded provider, or exclude trials recorded before provider tracking.';
		}
		if (message.includes('results mix task/version')) {
			return 'Set tooling mode, auth mode, repairs and parallel to one value.';
		}
		if (message.includes('harness version comparison')) {
			return 'Filter to one harness, one model and one stack.';
		}
		if (message.includes('mixes harnesses') && message.includes('models')) {
			return 'Filter to one harness and one model.';
		}
		if (message.includes('mixes harnesses')) return 'Filter to one harness.';
		if (message.includes('mixes models')) return 'Filter to one model.';
		if (message.includes('mixes stacks')) return 'Filter to one stack.';
		if (message.includes('versions of one framework')) {
			return 'Compare by stack, or filter to one stack.';
		}
		if (message.includes('versions of one language')) {
			return 'Compare by stack, or filter to one stack.';
		}
		return 'Change the highlighted filter.';
	}

	function highlighted(key: string): boolean {
		return hint !== null && hint.split(',').includes(key);
	}

	function providerLabel(value: string): string {
		return value === 'unknown' ? 'provider not recorded' : value;
	}

	function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
		selection.filters[key] = value;
		void refresh();
	}

	function setView(value: string): void {
		selection.view = value === 'matrix' ? 'matrix' : 'single';
		if (selection.view === 'matrix') {
			if (selection.tasks.length === 0 && selection.task !== null) {
				selection.tasks = [{ id: selection.task, version: selection.version }];
			}
		} else if (selection.task === null && selection.tasks.length > 0) {
			selection.task = selection.tasks[0].id;
			selection.version = selection.tasks[0].version;
		}
		void refresh();
	}

	function setTask(value: string): void {
		selection.task = value === '' ? null : value;
		selection.version = null;
		void refresh();
	}

	function setVersion(value: string): void {
		selection.version = value === '' ? null : value;
		void refresh();
	}

	function toggleDimension(dimension: Dimension, checked: boolean): void {
		selection.by = checked
			? [...selection.by, dimension]
			: selection.by.filter((item) => item !== dimension);
		void refresh();
	}

	function toggleMatrixTask(task: string, checked: boolean): void {
		selection.tasks = checked
			? [...selection.tasks, { id: task, version: null }]
			: selection.tasks.filter((item) => item.id !== task);
		void refresh();
	}

	function matrixTask(task: string) {
		return selection.tasks.find((item) => item.id === task);
	}

	function setMatrixVersion(task: string, value: string): void {
		selection.tasks = selection.tasks.map((item) =>
			item.id === task ? { ...item, version: value === '' ? null : value } : item
		);
		void refresh();
	}

	function setSince(value: string): void {
		selection.filters.since = value === '' ? null : value;
		void refresh();
	}

	function setSuite(value: string): void {
		suiteError = null;
		selection.filters.suite = value === '' ? null : value;
		void refresh();
	}

	function versionsFor(task: string): string[] {
		return engine === null ? [] : versionsOf(engine.rows, task);
	}
</script>

<PageView {data}>
	<div class="prose" id="compare-fallback" hidden={ready}>
		<p>
			The interactive compare page filters and groups every trial in your browser with DuckDB-WASM,
			so it needs JavaScript. Without it, every leaderboard is on the static pages: start at the <Link
				path="/"
			>
				home page
			</Link> or the <Link path="/leaderboard/">cross-task leaderboard</Link>. The raw rows are in <Link
				path="/data/trials.json"
			>
				data/trials.json
			</Link>.
		</p>
		{#if loadError !== null}
			<p class="refused" role="alert">Could not load the comparison engine: {loadError}</p>
		{/if}
	</div>

	{#if ready}
		<form class="controls" onsubmit={(event) => event.preventDefault()}>
			<div class="row">
				<label>
					View
					<select value={selection.view} onchange={(event) => setView(event.currentTarget.value)}>
						<option value="single">Single task</option>
						<option value="matrix">Matrix</option>
					</select>
				</label>
				{#if selection.view === 'single'}
					<label>
						Task
						<select
							value={selection.task ?? ''}
							onchange={(event) => setTask(event.currentTarget.value)}
						>
							<option value="">Choose a task…</option>
							{#each taskIds as task (task)}
								<option value={task}>{task}</option>
							{/each}
						</select>
					</label>
					<label>
						Version
						<select
							value={selection.version ?? ''}
							disabled={selection.task === null}
							onchange={(event) => setVersion(event.currentTarget.value)}
						>
							<option value="">Newest</option>
							{#each selection.task === null ? [] : versionsFor(selection.task) as version (version)}
								<option value={version}>{version}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>

			{#if selection.view === 'matrix'}
				<fieldset class="tasks">
					<legend>Tasks (each column is its own comparison)</legend>
					{#each taskIds as task (task)}
						<div class="task-row">
							<label>
								<input
									type="checkbox"
									checked={matrixTask(task) !== undefined}
									aria-label="Task: {task}"
									onchange={(event) => toggleMatrixTask(task, event.currentTarget.checked)}
								/>
								{task}
							</label>
							{#if matrixTask(task)}
								<select
									value={matrixTask(task)?.version ?? ''}
									aria-label="Version for {task}"
									onchange={(event) => setMatrixVersion(task, event.currentTarget.value)}
								>
									<option value="">Newest</option>
									{#each versionsFor(task) as version (version)}
										<option value={version}>{version}</option>
									{/each}
								</select>
							{/if}
						</div>
					{/each}
				</fieldset>
			{/if}

			<fieldset class="dimensions" class:attention={highlighted('by')}>
				<legend>Compare by (up to 3)</legend>
				{#each DIMENSIONS as dimension (dimension)}
					<label>
						<input
							type="checkbox"
							checked={selection.by.includes(dimension)}
							aria-label="Compare by: {DIMENSION_LABELS[dimension]}"
							onchange={(event) => toggleDimension(dimension, event.currentTarget.checked)}
						/>
						{DIMENSION_LABELS[dimension]}
					</label>
				{/each}
			</fieldset>

			<div class="filters">
				<MultiSelect
					label="Harness"
					values={filterValues.harness}
					selected={selection.filters.harness}
					onChange={(values: string[]) => setFilter('harness', values)}
					highlight={highlighted('harness')}
				/>
				<MultiSelect
					label="Harness version"
					values={filterValues.harness_version}
					selected={selection.filters.harness_version}
					onChange={(values: string[]) => setFilter('harness_version', values)}
					highlight={highlighted('harness_version')}
				/>
				<MultiSelect
					label="Model"
					values={filterValues.model}
					selected={selection.filters.model}
					onChange={(values: string[]) => setFilter('model', values)}
					highlight={highlighted('model')}
				/>
				<MultiSelect
					label="Stack"
					values={filterValues.stack}
					selected={selection.filters.stack}
					onChange={(values: string[]) => setFilter('stack', values)}
					highlight={highlighted('stack')}
				/>
				<MultiSelect
					label="Language"
					values={filterValues.language}
					selected={selection.filters.language}
					onChange={(values: string[]) => setFilter('language', values)}
				/>
				<MultiSelect
					label="Framework"
					values={filterValues.framework}
					selected={selection.filters.framework}
					onChange={(values: string[]) => setFilter('framework', values)}
				/>
				<MultiSelect
					label="Provider"
					values={filterValues.provider}
					selected={selection.filters.provider}
					display={providerLabel}
					onChange={(values: string[]) => setFilter('provider', values)}
					highlight={highlighted('provider')}
				/>
				<MultiSelect
					label="Tooling mode"
					values={filterValues.mode}
					selected={selection.filters.mode}
					onChange={(values: string[]) => setFilter('mode', values)}
					highlight={highlighted('mode')}
				/>
				<MultiSelect
					label="Auth mode"
					values={filterValues.auth}
					selected={selection.filters.auth}
					onChange={(values: string[]) => setFilter('auth', values)}
					highlight={highlighted('auth')}
				/>
				<MultiSelect
					label="Repairs"
					values={filterValues.repairs}
					selected={selection.filters.repairs.map(String)}
					onChange={(values: string[]) => setFilter('repairs', values.map(Number))}
					highlight={highlighted('repairs')}
				/>
				<MultiSelect
					label="Parallel"
					values={filterValues.parallel}
					selected={selection.filters.parallel.map(String)}
					onChange={(values: string[]) => setFilter('parallel', values.map(Number))}
					highlight={highlighted('parallel')}
				/>
			</div>

			<div class="row checks">
				<label>
					<input
						type="checkbox"
						checked={selection.filters.verified}
						onchange={(event) => setFilter('verified', event.currentTarget.checked)}
					/>
					Verified only
				</label>
				<label>
					<input
						type="checkbox"
						checked={!selection.filters.includeRateLimited}
						onchange={(event) => setFilter('includeRateLimited', !event.currentTarget.checked)}
					/>
					Exclude rate-limited trials
				</label>
				<label>
					Submitted on or after
					<input
						type="date"
						value={selection.filters.since ?? ''}
						onchange={(event) => setSince(event.currentTarget.value)}
					/>
				</label>
				<label class:attention={highlighted('suite')}>
					Acceptance suite
					<select
						value={selection.filters.suite ?? ''}
						onchange={(event) => setSuite(event.currentTarget.value)}
					>
						<option value="">{suites.length <= 1 ? 'Only suite' : 'Any suite'}</option>
						{#each suites as suite (suite)}
							<option value={suite} title={suite}>{suiteLabel(suite)}…</option>
						{/each}
					</select>
				</label>
			</div>
		</form>

		{#if suiteError !== null}
			<p class="refused" role="note"><strong>Not compared:</strong> {suiteError}</p>
		{:else if engine !== null && engine.rows.length === 0}
			<p class="unavailable">No results have been published yet.</p>
		{:else if !hasTask}
			<p class="unavailable">
				Choose a task to compare. {selection.view === 'matrix'
					? 'Each checked task becomes one column.'
					: 'The task fixes its task version.'}
			</p>
		{:else if runError !== null}
			<p class="refused" role="alert">The comparison failed: {runError}</p>
		{:else if byError !== null}
			<p class="refused" role="note"><strong>Not compared:</strong> {byError}</p>
			<p class="hint">Choose one to three dimensions.</p>
		{:else if selection.view === 'single' && single !== null}
			{#if single.refused !== null}
				<p class="hint">{hintText}</p>
			{/if}
			<Leaderboard
				{section}
				providers={single.providers}
				status={selection.filters.verified ? 'verified' : 'mixed'}
			/>
		{:else if selection.view === 'matrix' && matrix !== null}
			{#if matrix.refused !== null}
				<p class="refused" role="note"><strong>Not compared:</strong> {matrix.refused}</p>
				<p class="hint">{hintText}</p>
			{:else}
				<CompareMatrix
					columns={matrix.columns}
					rows={matrix.rows}
					providers={matrix.providers}
					{byLabel}
				/>
			{/if}
		{/if}
		{#if status === 'loading'}<p class="sub" aria-live="polite">Updating…</p>{/if}
	{/if}
</PageView>

<style>
	.controls {
		display: grid;
		gap: 0.75rem;
		margin: 1rem 0;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: end;
	}

	.row label {
		display: grid;
		gap: 0.15rem;
		font-size: 0.875rem;
	}

	.row.checks {
		align-items: center;
	}

	.row.checks label {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	select,
	input[type='date'] {
		font: inherit;
		padding: 0.25rem;
		background: var(--bg);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 4px;
	}

	fieldset {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
	}

	fieldset.attention,
	label.attention select {
		border-color: var(--focus);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 35%, transparent);
	}

	legend {
		font-size: 0.875rem;
		color: var(--muted);
		padding: 0 0.25rem;
	}

	fieldset label {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		font-size: 0.875rem;
	}

	.tasks {
		display: grid;
		gap: 0.25rem;
	}

	.task-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(13rem, 100%), 1fr));
		gap: 0.4rem;
	}

	.hint {
		margin: 0 0 0.5rem;
		color: var(--warn-text);
		background: var(--warn-bg);
		padding: 0.4rem 0.6rem;
		border-radius: 6px;
	}

	.refused {
		background: var(--warn-bg);
		color: var(--warn-text);
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
	}
</style>
