// Reads the site export written by `aicsbench site export` and validates every
// file against the export's own JSON Schemas. Build-time only (Node).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ExportInfo, Meta, Page, Pages, TrialRow } from './types/export.ts';

/** `export_schema` versions this site can render. */
export const SUPPORTED_EXPORT_SCHEMAS = [1] as const;

/** Files the export lists, each with the schema that describes it. */
const FILES = [
	['export.json', 'schema/export.schema.json'],
	['data/trials.json', 'schema/trials.schema.json'],
	['data/meta.json', 'schema/meta.schema.json'],
	['pages.json', 'schema/pages.schema.json']
] as const;

/** The submission fields the run page shows (runs/<run_id>/submission.json has no schema in the export). */
export interface RunSubmission {
	submitter: { name: string; github: string | null };
	notes: string;
	submitted_at: string;
	platform_version: string;
	logs_included: boolean;
}

export interface SiteExport {
	dir: string;
	info: ExportInfo;
	trials: TrialRow[];
	meta: Meta;
	pages: Page[];
	/** Every file under `data/` and `runs/`, relative to the export, copied to the site for download. */
	downloads: string[];
	submission(runId: string): RunSubmission;
}

export class ExportError extends Error {
	override name = 'ExportError';
}

function readJson(dir: string, file: string): unknown {
	const path = join(dir, file);
	if (!existsSync(path)) throw new ExportError(`${path}: file is missing from the export`);
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as unknown;
	} catch (error) {
		throw new ExportError(`${path}: not valid JSON (${(error as Error).message})`);
	}
}

/** JSON Pointer (`/pages/3/title`) to a JSON path (`$.pages[3].title`). */
export function jsonPath(pointer: string): string {
	if (pointer === '') return '$';
	return (
		'$' +
		pointer
			.split('/')
			.slice(1)
			.map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
			.map((part) =>
				/^\d+$/.test(part)
					? `[${part}]`
					: /^[A-Za-z_][A-Za-z0-9_]*$/.test(part)
						? `.${part}`
						: `[${JSON.stringify(part)}]`
			)
			.join('')
	);
}

function describe(error: ErrorObject): string {
	const where = jsonPath(error.instancePath);
	if (error.keyword === 'additionalProperties') {
		return `${where}: unexpected key ${JSON.stringify(error.params.additionalProperty)}`;
	}
	return `${where}: ${error.message ?? error.keyword}`;
}

function listFiles(dir: string, sub: string): string[] {
	const root = join(dir, sub);
	if (!existsSync(root)) return [];
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) =>
			join(entry.parentPath, entry.name)
				.slice(dir.length + 1)
				.replaceAll('\\', '/')
		)
		.sort();
}

/** Read and validate an export. Throws an ExportError naming the file and JSON path of the first problem. */
export function readExport(dir: string): SiteExport {
	const info = readJson(dir, 'export.json') as { export_schema?: unknown };
	const version = info?.export_schema;
	if (!(SUPPORTED_EXPORT_SCHEMAS as readonly unknown[]).includes(version)) {
		throw new ExportError(
			`${join(dir, 'export.json')}: export_schema ${JSON.stringify(version)} is not supported; ` +
				`this site supports export_schema ${SUPPORTED_EXPORT_SCHEMAS.join(', ')}`
		);
	}

	const parsed: Record<string, unknown> = {};
	for (const [file, schemaFile] of FILES) {
		const schema = readJson(dir, schemaFile) as object;
		const ajv = new Ajv2020({ allErrors: false, strict: false });
		addFormats(ajv);
		const validate = ajv.compile(schema);
		const data = file === 'export.json' ? info : readJson(dir, file);
		if (!validate(data)) {
			const first = validate.errors?.[0];
			throw new ExportError(
				`${join(dir, file)}: does not match ${schemaFile}: ${first ? describe(first) : 'invalid'}`
			);
		}
		parsed[file] = data;
	}

	const pages = (parsed['pages.json'] as Pages).pages;
	const seen = new Set<string>();
	for (const page of pages) {
		if (!page.path.startsWith('/') || !page.path.endsWith('/')) {
			throw new ExportError(
				`${join(dir, 'pages.json')}: page path ${page.path} must start and end with "/"`
			);
		}
		if (seen.has(page.path)) {
			throw new ExportError(`${join(dir, 'pages.json')}: page path ${page.path} is listed twice`);
		}
		seen.add(page.path);
	}

	const submissions = new Map<string, RunSubmission>();
	return {
		dir,
		info: parsed['export.json'] as ExportInfo,
		trials: parsed['data/trials.json'] as TrialRow[],
		meta: parsed['data/meta.json'] as Meta,
		pages,
		downloads: [...listFiles(dir, 'data'), ...listFiles(dir, 'runs')],
		submission(runId) {
			let found = submissions.get(runId);
			if (!found) {
				const raw = readJson(dir, `runs/${runId}/submission.json`) as RunSubmission;
				const ok =
					typeof raw?.submitter?.name === 'string' &&
					typeof raw.notes === 'string' &&
					typeof raw.submitted_at === 'string' &&
					typeof raw.platform_version === 'string' &&
					typeof raw.logs_included === 'boolean';
				if (!ok) {
					throw new ExportError(
						`${join(dir, 'runs', runId, 'submission.json')}: missing or invalid submitter, notes, submitted_at, platform_version or logs_included`
					);
				}
				// Only the fields the run page shows, so the page payload stays small.
				found = {
					submitter: { name: raw.submitter.name, github: raw.submitter.github ?? null },
					notes: raw.notes,
					submitted_at: raw.submitted_at,
					platform_version: raw.platform_version,
					logs_included: raw.logs_included
				};
				submissions.set(runId, found);
			}
			return found;
		}
	};
}

/** The export directory: EXPORT_DIR, or the committed fixture. */
export function exportDir(): string {
	return resolve(process.env.EXPORT_DIR || 'tests/fixtures/export');
}

let cached: SiteExport | undefined;

/** The export this build renders, read and validated once per build. */
export function loadExport(): SiteExport {
	cached ??= readExport(exportDir());
	return cached;
}

/** The page the export lists at `path`, which must be of `kind`. */
export function pageAt(path: string, kind: Page['kind']): Page {
	const page = loadExport().pages.find((candidate) => candidate.path === path);
	if (!page) throw new ExportError(`pages.json lists no page at ${path}`);
	if (page.kind !== kind) {
		throw new ExportError(
			`pages.json lists ${path} as kind ${page.kind}, but its route renders ${kind}`
		);
	}
	return page;
}
