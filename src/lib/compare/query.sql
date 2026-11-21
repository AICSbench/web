-- One comparison group, mirroring comparison.compare_trials.
--
-- The page replaces {{value}} and {{group_by}} with whitelisted dimension
-- expressions from dimensions.ts (a selection of up to three dimensions).
-- Every filter is a named parameter:
--   $task, $task_version, $verified, $include_rate_limited, $since, $suite,
--   $harness, $harness_version, $model, $stack, $language, $framework,
--   $provider, $mode, $auth, $repairs, $parallel, $min_trials
-- The list parameters are JSON arrays of strings/numbers. DuckDB-WASM binds
-- prepared statements positionally, so query.ts replaces each named parameter
-- with ? in order; the Python contract test binds them by name.
WITH lists AS (
  SELECT
    CAST(from_json($harness, '["VARCHAR"]') AS VARCHAR[]) AS harness_values,
    CAST(from_json($harness_version, '["VARCHAR"]') AS VARCHAR[]) AS harness_version_values,
    CAST(from_json($model, '["VARCHAR"]') AS VARCHAR[]) AS model_values,
    CAST(from_json($stack, '["VARCHAR"]') AS VARCHAR[]) AS stack_values,
    CAST(from_json($language, '["VARCHAR"]') AS VARCHAR[]) AS language_values,
    CAST(from_json($framework, '["VARCHAR"]') AS VARCHAR[]) AS framework_values,
    CAST(from_json($provider, '["VARCHAR"]') AS VARCHAR[]) AS provider_values,
    CAST(from_json($mode, '["VARCHAR"]') AS VARCHAR[]) AS mode_values,
    CAST(from_json($auth, '["VARCHAR"]') AS VARCHAR[]) AS auth_values,
    CAST(from_json($repairs, '["INTEGER"]') AS INTEGER[]) AS repair_values,
    CAST(from_json($parallel, '["INTEGER"]') AS INTEGER[]) AS parallel_values
),
selected AS (
  SELECT
    trials.*,
    CASE
      WHEN harness = 'opencode' AND regexp_matches(lower(model), '^[^/]+/.+$')
      THEN regexp_replace(lower(model), '^[^/]+/', '')
      ELSE lower(model)
    END AS model_key_value
  FROM trials, lists
  WHERE task = $task
    AND task_version = $task_version
    AND ($verified = 0 OR verified)
    AND ($include_rate_limited = 1 OR NOT rate_limited)
    AND ($since IS NULL OR CAST(submitted_at AS TIMESTAMPTZ) >= CAST($since AS TIMESTAMPTZ))
    AND ($suite IS NULL OR suite_sha256 = $suite)
    AND (len(lists.harness_values) = 0 OR list_contains(lists.harness_values, harness))
    AND (
      len(lists.harness_version_values) = 0
      OR list_contains(lists.harness_version_values, coalesce(harness_version, 'unknown'))
    )
    AND (
      len(lists.model_values) = 0
      OR list_contains(lists.model_values, lower(model))
      OR list_contains(lists.model_values, model_key_value)
    )
    AND (len(lists.stack_values) = 0 OR list_contains(lists.stack_values, stack))
    AND (len(lists.language_values) = 0 OR list_contains(lists.language_values, language))
    AND (len(lists.framework_values) = 0 OR list_contains(lists.framework_values, framework))
    AND (
      len(lists.provider_values) = 0
      OR list_contains(lists.provider_values, coalesce(provider, 'unknown'))
    )
    AND (len(lists.mode_values) = 0 OR list_contains(lists.mode_values, tooling_mode))
    AND (len(lists.auth_values) = 0 OR list_contains(lists.auth_values, auth_mode))
    AND (len(lists.repair_values) = 0 OR list_contains(lists.repair_values, max_repairs))
    AND (len(lists.parallel_values) = 0 OR list_contains(lists.parallel_values, max_parallel))
)
SELECT
  {{value}} AS value,
  count(*) AS trials,
  count(*) FILTER (WHERE status = 'passed') AS passed,
  count(*) FILTER (WHERE rate_limited) AS rate_limited,
  count(*) FILTER (
    WHERE status = 'passed' AND NOT rate_limited AND agent_seconds IS NOT NULL
  ) AS timed,
  avg(agent_seconds) FILTER (
    WHERE status = 'passed' AND NOT rate_limited AND agent_seconds IS NOT NULL
  ) AS mean_seconds,
  stddev_samp(agent_seconds) FILTER (
    WHERE status = 'passed' AND NOT rate_limited AND agent_seconds IS NOT NULL
  ) AS stdev_seconds,
  avg(cost_usd) FILTER (
    WHERE status = 'passed'
      AND NOT rate_limited
      AND cost_availability = 'available'
      AND cost_usd IS NOT NULL
  ) AS mean_cost_usd,
  count(cost_usd) FILTER (
    WHERE status = 'passed'
      AND NOT rate_limited
      AND cost_availability = 'available'
      AND cost_usd IS NOT NULL
  ) AS cost_samples,
  (count(*) < $min_trials) AS low_confidence
FROM selected
GROUP BY {{group_by}}
ORDER BY mean_seconds IS NULL, mean_seconds, value
