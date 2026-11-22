import { expect, test, type Page } from '@playwright/test';

const TASK = '/tasks/task-management-api/';

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('a task page shows its leaderboard', async ({ page }) => {
		await page.goto(TASK);
		const board = page.getByRole('region', {
			name: /By harness \+ model · stack fastapi · version 2 · suite bdb9517a/
		});
		await expect(board.getByRole('table')).toBeVisible();
		const rows = board.getByRole('row');
		await expect(rows.nth(1)).toContainText('claude + claude-opus-5-5');
		await expect(rows.nth(1)).toContainText('100%');
		await expect(rows.nth(2)).toContainText('codex + gpt-6-luna');
		await expect(rows.nth(2)).toContainText('66.7%');
		await expect(
			page.getByRole('figure', { name: /Success rate by Harness \+ model/ }).first()
		).toBeVisible();
	});

	test('a run page shows its trials and escaped submitter', async ({ page }) => {
		await page.goto('/runs/run-community-001/');
		await expect(page.getByText('<script>alert(1)</script>', { exact: true })).toBeVisible();
		const group = page.locator('details.stack-group').filter({ hasText: 'laravel' });
		await group.locator('summary').click();
		await expect(group.getByRole('table', { name: 'Trials in laravel' })).toContainText(
			'trial-002'
		);
	});

	test('the compare page explains it needs JavaScript', async ({ page }) => {
		await page.goto('/compare/');
		await expect(page.locator('#compare-fallback')).toContainText('needs JavaScript');
	});
});

test.describe('a run detail grouped by stack', () => {
	test('summarizes each stack and harness + model combination, then expands trials', async ({
		page
	}) => {
		await page.goto('/runs/run-url-001/');
		await expect(page.getByText(/8 trials in 2\s+stacks, split into 3/)).toBeVisible();
		const summary = page.getByRole('table', { name: 'Summary by stack' });
		await expect(summary).toBeVisible();
		const rows = summary.getByRole('row');
		await expect(rows).toHaveCount(4);
		await expect(rows.nth(1)).toContainText('fastapi-latest');
		await expect(rows.nth(1)).toContainText('claude');
		await expect(rows.nth(1)).toContainText('claude-opus-5-5');
		await expect(rows.nth(1)).toContainText('66.7%');
		await expect(rows.nth(1)).toContainText('1m 45s');
		await expect(rows.nth(2)).toContainText('codex');
		await expect(rows.nth(2)).toContainText('100%');
		await expect(rows.nth(2)).toContainText('2m 5s');
		await expect(rows.nth(3)).toContainText('laravel');
		await expect(rows.nth(3)).toContainText('5m 5s');

		const groups = page.locator('details.stack-group');
		await expect(groups).toHaveCount(2);
		const fastapi = groups.filter({ hasText: 'fastapi-latest' }).first();
		const laravel = groups.filter({ hasText: 'laravel' }).first();
		await expect(fastapi).toHaveJSProperty('open', false);
		await expect(laravel).toHaveJSProperty('open', false);

		await fastapi.locator('summary').click();
		await expect(fastapi).toHaveJSProperty('open', true);
		const trials = fastapi.getByRole('table', { name: 'Trials in fastapi-latest' });
		await expect(trials).toBeVisible();
		await expect(trials.getByRole('row')).toHaveCount(7);
		await expect(trials).toContainText('trial-006');
		await expect(trials).toContainText('rate-limited');
		await expect(trials).toContainText('2m 30s');
		await expect(trials).toContainText('$0.20');
		await expect(laravel).toHaveJSProperty('open', false);

		await laravel.locator('summary').click();
		const laravelTrials = laravel.getByRole('table', { name: 'Trials in laravel' });
		await expect(laravelTrials).toBeVisible();
		await expect(laravelTrials.getByRole('row')).toHaveCount(3);

		await fastapi.locator('summary').click();
		await expect(fastapi).toHaveJSProperty('open', false);
		await expect(trials).toBeHidden();
	});

	test('keeps harness + model combinations separate inside one stack', async ({ page }) => {
		await page.goto('/runs/run-notes-001/');
		await expect(page.getByText(/7 trials in 1\s+stack, split into 2/)).toBeVisible();
		const summary = page.getByRole('table', { name: 'Summary by stack' });
		const rows = summary.getByRole('row');
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(1)).toContainText('fastapi-latest');
		await expect(rows.nth(1)).toContainText('claude');
		await expect(rows.nth(1)).toContainText('claude-opus-5-5');
		await expect(rows.nth(1)).toContainText('100%');
		await expect(rows.nth(1)).toContainText('10m 17s');
		await expect(rows.nth(2)).toContainText('codex');
		await expect(rows.nth(2)).toContainText('gpt-6-luna');
		await expect(rows.nth(2)).toContainText('8m 35s');

		const group = page.locator('details.stack-group');
		await expect(group).toHaveCount(1);
		await group.locator('summary').click();
		await expect(group.getByRole('row')).toHaveCount(8);
	});

	test('shows unavailable when no passed trial has a timing', async ({ page }) => {
		await page.goto('/runs/run-misc-001/');
		const summary = page.getByRole('table', { name: 'Summary by stack' });
		const row = summary.getByRole('row').nth(1);
		await expect(row).toContainText('100%');
		await expect(row).toContainText('unavailable');
		await expect(row).not.toContainText('0s');
	});
});

/** Every URL the page requests while loading and hydrating. */
async function requestsOf(page: Page, path: string): Promise<string[]> {
	const urls: string[] = [];
	page.on('request', (request) => urls.push(request.url()));
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(path, { waitUntil: 'networkidle' });
	expect(errors).toEqual([]);
	return urls;
}

for (const path of [TASK, '/compare/', '/leaderboard/', '/runs/run-verified-001/']) {
	test(`${path} requests nothing from another origin`, async ({ page, baseURL }) => {
		const origin = new URL(baseURL!).origin;
		const urls = await requestsOf(page, path);
		expect(urls.length).toBeGreaterThan(1);
		expect(urls.filter((url) => new URL(url).origin !== origin)).toEqual([]);
	});
}

test('client-side navigation keeps working after hydration', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	// A full page load would request a new document; client-side routing does not.
	const documents: string[] = [];
	page.on('request', (request) => {
		if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
			documents.push(request.url());
		}
	});
	await page.getByRole('link', { name: 'Leaderboard', exact: true }).first().click();
	await expect(page).toHaveURL(/\/leaderboard\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leaderboard');
	await expect(page).toHaveTitle('Leaderboard · AICSbench');
	expect(documents).toEqual([]);
});

test('the skip link moves keyboard focus to the main content', async ({ page }) => {
	await page.goto('/tasks/task-management-api/');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('main')).toBeFocused();
	await page.keyboard.press('Tab');
	const focused = await page.evaluate(() => !!document.activeElement?.closest('main'));
	expect(focused).toBe(true);
});

test.describe('the compare page', () => {
	test('picks a harness comparison and writes the canonical URL', async ({ page }) => {
		await page.goto('/compare/?task=auth-api');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare results');
		await expect(page.getByRole('combobox', { name: 'Task' })).toHaveValue('auth-api');

		// Default is harness + model; turn the model dimension off to compare harnesses.
		await page.getByRole('checkbox', { name: 'Compare by: Model' }).uncheck();
		await expect(
			page.getByRole('checkbox', { name: 'Compare by: Harness', exact: true })
		).toBeChecked();

		const table = page.getByRole('table');
		await expect(table).toBeVisible();
		const rows = table.getByRole('row');
		await expect(rows.nth(1)).toContainText('codex');
		await expect(rows.nth(1)).toContainText('openai');
		await expect(rows.nth(1)).toContainText('100%');
		await expect(rows.nth(2)).toContainText('opencode');
		await expect(page.getByRole('figure', { name: /Success rate by Harness/ })).toBeVisible();
		await expect(page).toHaveURL(/task=auth-api&by=harness$/);

		// Changing a control writes the canonical URL with defaults left out.
		await page.getByRole('checkbox', { name: 'Exclude rate-limited trials' }).uncheck();
		await expect(page).toHaveURL(/task=auth-api&by=harness&rl=1$/);
		const keys = [...new URL(page.url()).searchParams.keys()];
		expect(keys).toEqual(['task', 'by', 'rl']);
	});

	test('restores a shared URL and shows CLI refusal messages', async ({ page }) => {
		const shared =
			'/compare/?task=url-shortener-api&by=harness&model=gpt-6-luna&stack=fastapi-latest';
		await page.goto(shared);
		await expect(page.getByRole('combobox', { name: 'Task' })).toHaveValue('url-shortener-api');
		await expect(
			page.getByRole('checkbox', { name: 'Compare by: Harness', exact: true })
		).toBeChecked();
		await expect(page).toHaveURL(new RegExp(`${shared.replaceAll('?', '\\?')}$`));

		// A harness comparison across two stacks is refused with the CLI's message.
		await page.goto('/compare/?task=url-shortener-api&by=harness&model=gpt-6-luna');
		await expect(
			page.getByText('harness comparison mixes stacks; filter to one stack')
		).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);

		// A stack comparison across two harness + model pairs is refused too.
		await page.goto('/compare/?task=task-management-api&by=stack&suite=bdb9517a');
		await expect(
			page.getByText('stack comparison mixes harnesses and models; filter to one harness and model')
		).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);

		// Two suites for one task version are refused until a suite is chosen.
		await page.goto('/compare/?task=task-management-api&by=harness_model');
		await expect(
			page.getByText('comparison mixes acceptance suites; pick one suite')
		).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);
		await page.getByRole('combobox', { name: 'Acceptance suite' }).selectOption({
			label: 'bdb9517a…'
		});
		await expect(page.getByRole('table')).toBeVisible();

		// The provider filter and badge expose gateway rows.
		await page.goto('/compare/?task=notes-api&by=harness_model&provider=openrouter');
		const gateway = page.getByRole('table');
		await expect(gateway).toBeVisible();
		await expect(gateway).toContainText('openrouter');
		await expect(gateway).toContainText('codex + gpt-6-luna');
	});

	test('shows a matrix with one refused column left out of the overall', async ({ page }) => {
		await page.goto(
			'/compare/?view=matrix&task=auth-api,url-shortener-api,notes-api&by=harness_model&stack=fastapi-latest'
		);
		await expect(page.getByRole('heading', { name: 'Harness + model across tasks' })).toBeVisible();
		const table = page.getByRole('table');
		await expect(table).toBeVisible();
		await expect(table).toContainText('notes-api');
		await expect(table).toContainText('Not compared');
		await expect(table).toContainText(
			'harness comparison needs a recorded provider; exclude trials recorded before provider tracking'
		);
		// The refused column is not in the coverage count: two columns remain.
		await expect(table.getByRole('row').nth(1)).toContainText('2/2');
		await expect(table.getByRole('row').filter({ hasText: 'codex + gpt-6-luna' })).toContainText(
			'openai'
		);
	});

	test('matches a full OpenCode model label exactly, but ignores case for the model key', async ({
		page
	}) => {
		const url = '/compare/?task=auth-api&v=1&by=model&harness=opencode&model=';
		await page.goto(`${url}openai%2FGPT-6-LUNA`);
		await expect(page.getByText('No results in this section.')).toBeVisible();
		await page.goto(`${url}GPT-6-LUNA`);
		await expect(page.getByRole('table')).toContainText('openai/gpt-6-luna');
	});
});
