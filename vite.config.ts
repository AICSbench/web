import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// SvelteKit 3 reads its configuration here; it no longer supports svelte.config.js.
// BASE_PATH is "/web" on GitHub Pages (decision D2) and empty for local previews.
const base = process.env.BASE_PATH ?? '';
if (base !== '' && !/^\/[^/].*[^/]$|^\/[^/]$/.test(base)) {
	throw new Error(`BASE_PATH must start with "/" and not end with "/", got "${base}"`);
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// BUILD_DIR lets tests build other exports without touching build/.
			adapter: adapter({
				pages: process.env.BUILD_DIR ?? 'build',
				assets: process.env.BUILD_DIR ?? 'build',
				strict: true
			}),
			paths: { base: base as '' | `/${string}` },
			prerender: {
				handleHttpError: 'fail',
				handleMissingId: 'fail',
				handleUnseenRoutes: 'fail'
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node',
		testTimeout: 120_000,
		hookTimeout: 180_000,
		// Build tests share .svelte-kit/, so files run one at a time.
		fileParallelism: false
	}
});
