import { expect, test, type Page } from '@playwright/test';

const TASK = '/tasks/task-management-api/';

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('a task page shows its leaderboard', async ({ page }) => {
		await page.goto(TASK);
		const board = page.getByRole('region', { name: /By harness \+ model · stack fastapi/ });
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
