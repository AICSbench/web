// The version-controlled model catalog behind /models/. Each entry lists the
// exact trial IDs that map to it. Nothing is inferred from a provider prefix,
// a harness default, or a similar-looking variant: an ID not listed here has
// no profile. Official specifications and maker list prices live here too, so
// a profile never mixes them with AICSbench results or with the OpenRouter
// rates the CLI uses for its separate cost estimate.

export interface ModelSource {
	label: string;
	url: string;
}

export interface ModelPricingTier {
	label: string;
	/** Exactly one tier per model is the headline baseline. */
	baseline: boolean;
	inputUsdPerMillion: number | null;
	cachedInputUsdPerMillion: number | null;
	outputUsdPerMillion: number | null;
	note: string | null;
}

export interface ModelPricing {
	/** The date the maker's pricing page was checked (ISO 8601 date). */
	checkedAt: string;
	tiers: readonly ModelPricingTier[];
	source: ModelSource;
	note: string | null;
}

export interface ModelSpecifications {
	exactVersion: string | null;
	contextWindowTokens: number | null;
	contextWindowNote: string | null;
	maxOutputTokens: number | null;
	inputModalities: readonly string[] | null;
	outputModalities: readonly string[] | null;
	weights: string | null;
	weightsNote: string | null;
	license: string | null;
}

export interface ModelEntry {
	slug: string;
	canonicalId: string;
	displayName: string;
	maker: string;
	/** Additional exact trial IDs that refer to this model. */
	aliases: readonly string[];
	specifications: ModelSpecifications;
	pricing: ModelPricing;
	/** Maker-published pages the profile cites. */
	sources: readonly ModelSource[];
	/** Identity boundaries readers should know about. */
	notes: readonly string[];
}

const OPENAI_PRICING: ModelSource = {
	label: 'OpenAI API pricing',
	url: 'https://developers.openai.com/api/docs/pricing'
};

const ZAI_PRICING: ModelSource = {
	label: 'Z.ai pricing',
	url: 'https://docs.z.ai/guides/overview/pricing'
};

const DEEPSEEK_PRICING: ModelSource = {
	label: 'DeepSeek models and pricing',
	url: 'https://api-docs.deepseek.com/quick_start/pricing'
};

export const MODEL_CATALOG: readonly ModelEntry[] = [
	{
		slug: 'gpt-6-luna',
		canonicalId: 'gpt-6-luna',
		displayName: 'GPT-6 Luna',
		maker: 'OpenAI',
		aliases: ['openai/gpt-6-luna'],
		specifications: {
			exactVersion: 'gpt-6-luna (default snapshot; OpenAI lists no dated snapshot)',
			contextWindowTokens: 1_050_000,
			contextWindowNote: 'Maximum input 922,000 tokens.',
			maxOutputTokens: 128_000,
			inputModalities: ['Text', 'Image'],
			outputModalities: ['Text'],
			weights: null,
			weightsNote: 'Proprietary hosted model; no weights are published.',
			license: 'Proprietary'
		},
		pricing: {
			checkedAt: '2026-11-21',
			tiers: [
				{
					label: 'Standard, short context (≤272K input tokens)',
					baseline: true,
					inputUsdPerMillion: 0.1,
					cachedInputUsdPerMillion: 0.01,
					outputUsdPerMillion: 0.5,
					note: 'Prompts over 272K input tokens are billed at 2× input and cache rates and 1.5× output for the whole request.'
				}
			],
			source: OPENAI_PRICING,
			note: 'OpenAI also bills cache writes at $0.125/1M for 30-minute writes and $0.25/1M for 12-hour writes. Batch and Flex are 50% of Standard; Fast mode is 2× Standard; regional processing adds 10%.'
		},
		sources: [
			{
				label: 'OpenAI GPT-6 Luna model page',
				url: 'https://developers.openai.com/api/docs/models/gpt-6-luna'
			},
			OPENAI_PRICING
		],
		notes: ['gpt-6-luna-pro and gpt-6-luna:batch are distinct variants, not this profile.']
	},
	{
		slug: 'glm-5.3-flash',
		canonicalId: 'glm-5.3-flash',
		displayName: 'GLM-5.3-Flash',
		maker: 'Z.ai (Zhipu AI)',
		aliases: ['z-ai/glm-5.3-flash'],
		specifications: {
			exactVersion: 'GLM-5.3-Flash (released 2026-08-26; API model code glm-5.3-flash)',
			contextWindowTokens: 1_000_000,
			contextWindowNote: 'Published as 1M tokens.',
			maxOutputTokens: 128_000,
			inputModalities: ['Text', 'Image', 'Video', 'File'],
			outputModalities: ['Text'],
			weights: 'Open weights (320B total, 18B active)',
			weightsNote: null,
			license: 'MIT'
		},
		pricing: {
			checkedAt: '2026-11-21',
			tiers: [
				{
					label: 'Standard pay-as-you-go',
					baseline: true,
					inputUsdPerMillion: 0.15,
					cachedInputUsdPerMillion: 0.03,
					outputUsdPerMillion: 0.5,
					note: 'Cached-input storage is listed as limited-time free.'
				}
			],
			source: ZAI_PRICING,
			note: 'GLM-5.3-FlashX is a separate, faster API-only variant with different rates and is not this profile.'
		},
		sources: [
			{
				label: 'Z.ai GLM-5.3-Flash model documentation',
				url: 'https://docs.z.ai/guides/vlm/glm-5.3-flash'
			},
			{
				label: 'Z.ai GLM-5.3-Flash model card (Hugging Face)',
				url: 'https://huggingface.co/zai-org/GLM-5.3-Flash'
			},
			ZAI_PRICING
		],
		notes: [
			'GLM-5.3-FlashX uses the same weights but is a separate API-only variant and is not merged here.'
		]
	},
	{
		slug: 'deepseek-v4.1-flash',
		canonicalId: 'deepseek-v4.1-flash-1017',
		displayName: 'DeepSeek V4.1 Flash',
		maker: 'DeepSeek',
		aliases: ['deepseek-flash', 'deepseek/deepseek-v4.1-flash-1017'],
		specifications: {
			exactVersion:
				'DeepSeek-V4.1-Flash-1017 (current API snapshot; first-party alias deepseek-flash)',
			contextWindowTokens: 1_000_000,
			contextWindowNote: 'Published as 1M tokens.',
			maxOutputTokens: 384_000,
			inputModalities: ['Text', 'Image'],
			outputModalities: ['Text'],
			weights: 'Open weights (552B total MoE)',
			weightsNote: null,
			license: 'MIT'
		},
		pricing: {
			checkedAt: '2026-11-21',
			tiers: [
				{
					label: 'Peak (weekday 01:00–04:00 and 06:00–10:00 UTC)',
					baseline: true,
					inputUsdPerMillion: 0.3,
					cachedInputUsdPerMillion: 0.006,
					outputUsdPerMillion: 1.2,
					note: null
				},
				{
					label: 'Off-peak',
					baseline: false,
					inputUsdPerMillion: 0.15,
					cachedInputUsdPerMillion: 0.003,
					outputUsdPerMillion: 0.6,
					note: 'Off-peak is half of peak; weekends and Chinese public holidays are off-peak all day.'
				}
			],
			source: DEEPSEEK_PRICING,
			note: 'Peak hours are Monday–Friday, 01:00–04:00 and 06:00–10:00 UTC, excluding Chinese public holidays. The headline baseline is peak.'
		},
		sources: [
			{
				label: 'DeepSeek-V4.1-Flash-1017 model card (Hugging Face)',
				url: 'https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017'
			},
			{
				label: 'DeepSeek API change log (1017 snapshot)',
				url: 'https://api-docs.deepseek.com/updates/'
			},
			DEEPSEEK_PRICING
		],
		notes: [
			'OpenRouter also lists an unqualified deepseek/deepseek-v4.1-flash entry with different pricing; this catalog does not assume it is the 1017 snapshot.'
		]
	}
];

function aliasKey(id: string): string {
	return id.trim().toLowerCase();
}

const ALIASES = new Map<string, ModelEntry>();
for (const model of MODEL_CATALOG) {
	if (model.pricing.tiers.filter((tier) => tier.baseline).length !== 1) {
		throw new Error(`model catalog entry ${model.slug} needs exactly one baseline price tier`);
	}
	for (const id of [model.canonicalId, ...model.aliases]) {
		const key = aliasKey(id);
		if (key === '') throw new Error(`model catalog entry ${model.slug} has an empty alias`);
		if (ALIASES.has(key)) throw new Error(`model catalog alias ${id} is listed twice`);
		ALIASES.set(key, model);
	}
}

/** The model whose catalog entry lists this exact trial ID, or null. */
export function modelForTrialId(id: string | null | undefined): ModelEntry | null {
	if (id === null || id === undefined) return null;
	const key = aliasKey(id);
	return key === '' ? null : (ALIASES.get(key) ?? null);
}

/** The catalog entry at `slug`, or null. */
export function modelBySlug(slug: string): ModelEntry | null {
	return MODEL_CATALOG.find((model) => model.slug === slug) ?? null;
}

/** The model a benchmark row names, when the row maps unambiguously. */
export function profileForRowValue(by: string, value: string): ModelEntry | null {
	if (by === 'model') return modelForTrialId(value);
	if (by === 'harness_model') {
		const separator = value.lastIndexOf(' + ');
		return separator === -1 ? null : modelForTrialId(value.slice(separator + 3));
	}
	return null;
}

/** The one price tier a profile headlines. */
export function baselineTier(model: ModelEntry): ModelPricingTier {
	const tier = model.pricing.tiers.find((candidate) => candidate.baseline);
	if (!tier) throw new Error(`model catalog entry ${model.slug} has no baseline price tier`);
	return tier;
}

/** Every path the model catalog adds to the static site. */
export function modelPaths(): string[] {
	return ['/models/', ...MODEL_CATALOG.map((model) => `/models/${model.slug}/`)];
}
