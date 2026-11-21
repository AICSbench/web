import { defineConfig, devices } from '@playwright/test';

// Runs against an e2e build of the fixture plus one setup-only group. The
// build goes to a separate directory and a dedicated port, so a normal preview
// can never be reused in place of the synthetic export.
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: 'http://127.0.0.1:4174' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command:
			'node tests/e2e/build-e2e-export.mjs && BUILD_DIR=/tmp/aicsbench-e2e-build pnpm preview --host 127.0.0.1 --port 4174 --strictPort',
		url: 'http://127.0.0.1:4174/',
		reuseExistingServer: false,
		timeout: 120_000
	}
});
