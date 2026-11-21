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
		await expect(page.getByRole('table')).toContainText('trial-002');
	});

	test('the compare page explains it needs JavaScript', async ({ page }) => {
		await page.goto('/compare/');
		await expect(page.locator('#compare-fallback')).toContainText('needs JavaScript');
	});

	test('a model profile shows official facts and an empty results state', async ({ page }) => {
		await page.goto('/models/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Models');
		await expect(page.getByRole('link', { name: 'GPT-6 Luna' })).toBeVisible();
		await page.getByRole('link', { name: 'GPT-6 Luna' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('GPT-6 Luna');
		await expect(page.getByRole('heading', { name: 'Official specifications' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Official pricing' })).toBeVisible();
		await expect(page.getByText('18 of 20 verified trials passed')).toBeVisible();

		await page.goto('/models/deepseek-v4.1-flash/');
		await expect(page.getByText('No verified results yet.')).toBeVisible();
		await expect(page.getByText('$0.30', { exact: true })).toBeVisible();
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

test('a profile Compare link opens the preselected comparison', async ({ page }) => {
	await page.goto('/models/gpt-6-luna/');
	const link = page.getByRole('link', { name: 'Compare this group' }).first();
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/compare\/\?task=auth-api&/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare results');
	const table = page.getByRole('table');
	await expect(table).toBeVisible();
	await expect(table).toContainText('codex + gpt-6-luna');
	await expect(table).toContainText('3/3');
});

test('a task model page links to its profile only when one exists', async ({ page }) => {
	await page.goto('/tasks/task-management-api/models/gpt-6-luna/');
	await page.getByRole('link', { name: 'Model profile: GPT-6 Luna' }).click();
	await expect(page).toHaveURL(/\/models\/gpt-6-luna\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('GPT-6 Luna');

	await page.goto('/tasks/task-management-api/models/claude-opus-5-5/');
	await expect(page.getByText('Model profile:')).toHaveCount(0);
});

test('a model profile fits a phone viewport without page overflow', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/models/gpt-6-luna/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('table').filter({ hasText: 'Runs and compare' })).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
});

test('hydrates a profile with groups that differ only in repair budget', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/models/glm-5.3-flash/', { waitUntil: 'networkidle' });
	await expect(page.getByText('2 of 2 verified trials passed')).toBeVisible();
	const groups = page
		.getByRole('row')
		.filter({ hasText: 'misc-api v1' })
		.filter({ hasText: 'codex' });
	await expect(groups).toHaveCount(2);
	await expect(groups.filter({ hasText: '0 repairs' })).toHaveCount(1);
	await expect(groups.filter({ hasText: '1 repairs' })).toHaveCount(1);
	expect(errors).toEqual([]);
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
