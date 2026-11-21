"""Contract test: the browser's query.sql and matrix.ts agree with aicsbench.

Run from the web repository root with `aicsbench` and `duckdb` installed:

    python tests/contract/compare_contract.py

It loads tests/fixtures/export/data/trials.json into DuckDB, runs query.sql for
every compare-by option, and compares the numbers and order with
comparison.compare_trials. It then runs query.sql per matrix column and asks
the browser's matrix.ts (through tsx) to combine them, comparing the result
with comparison.compare_matrix.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

import duckdb

from ai_benchmark.comparison import compare_matrix, compare_trials
from ai_benchmark.models import (
    AuthMode,
    ComparisonDimension,
    Metric,
    MetricSource,
    ToolingMode,
    TrialStatus,
)
from ai_benchmark.models.metrics import PerformanceMetrics, TrialMetrics, UsageMetrics
from ai_benchmark.models.results import (
    AgentRecord,
    EnvironmentRecord,
    RateLimitEvent,
    ToolingRecord,
    TrialResult,
)
from ai_benchmark.storage.base import ResultFilter

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests" / "fixtures" / "export" / "data" / "trials.json"
QUERY = ROOT / "src" / "lib" / "compare" / "query.sql"
MATRIX_TS = ROOT / "tests" / "contract" / "matrix-contract.ts"
SUITE_A = "bdb9517ac7138804403bef6c0ea36941de29d5cb1fb51a33448f6360c556d20b"

DIMENSIONS = {
    "harness": ComparisonDimension.HARNESS,
    "harness_version": ComparisonDimension.HARNESS_VERSION,
    "model": ComparisonDimension.MODEL,
    "harness_model": ComparisonDimension.HARNESS_MODEL,
    "stack": ComparisonDimension.STACK,
    "language": ComparisonDimension.LANGUAGE,
    "framework": ComparisonDimension.FRAMEWORK,
    "provider": ComparisonDimension.PROVIDER,
}

# Must stay in step with src/lib/compare/dimensions.ts; the rows this produces
# are checked against compare_trials below.
DIMENSION_SQL = {
    "harness": "harness",
    "harness_version": "harness || ' ' || coalesce(harness_version, 'unknown')",
    "model": "model",
    "harness_model": "harness || ' + ' || model",
    "stack": "stack",
    "language": "language",
    "framework": "framework",
    "provider": "coalesce(provider, 'unknown')",
}


def load_rows() -> list[dict[str, Any]]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def base_filters(**overrides: Any) -> dict[str, Any]:
    filters: dict[str, Any] = {
        "verified": True,
        "include_rate_limited": False,
        "harness": [],
        "harness_version": [],
        "model": [],
        "stack": [],
        "language": [],
        "framework": [],
        "provider": [],
        "mode": [],
        "auth": [],
        "repairs": [],
        "parallel": [],
        "suite": None,
    }
    filters.update(overrides)
    return filters


def model_key(row: dict[str, Any]) -> str:
    label = row["model"].lower()
    if row["harness"] == "opencode":
        provider, separator, model = label.partition("/")
        if provider and separator and model:
            return model
    return label


def selected(rows: list[dict[str, Any]], task: str, version: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
    def one_of(values: list[Any], value: Any) -> bool:
        return not values or value in values

    result = []
    for row in rows:
        if row["task"] != task or row["task_version"] != version:
            continue
        if filters["verified"] and not row["verified"]:
            continue
        if not filters["include_rate_limited"] and row["rate_limited"]:
            continue
        if filters["suite"] is not None and row["suite_sha256"] != filters["suite"]:
            continue
        if not one_of(filters["harness"], row["harness"]):
            continue
        if not one_of(filters["harness_version"], row["harness_version"] or "unknown"):
            continue
        if filters["model"] and not any(
            value == row["model"] or value.lower() == model_key(row) for value in filters["model"]
        ):
            continue
        if not one_of(filters["stack"], row["stack"]):
            continue
        if not one_of(filters["language"], row["language"]):
            continue
        if not one_of(filters["framework"], row["framework"]):
            continue
        if not one_of(filters["provider"], row["provider"] or "unknown"):
            continue
        if not one_of(filters["mode"], row["tooling_mode"]):
            continue
        if not one_of(filters["auth"], row["auth_mode"]):
            continue
        if not one_of(filters["repairs"], row["max_repairs"]):
            continue
        if not one_of(filters["parallel"], row["max_parallel"]):
            continue
        result.append(row)
    return result


def trial(row: dict[str, Any]) -> TrialResult:
    seconds = (
        Metric[float].of(row["agent_seconds"], MetricSource.MEASURED)
        if row["agent_seconds"] is not None
        else Metric[float]()
    )
    cost = (
        Metric[float].of(row["cost_usd"], MetricSource.AGENT_REPORTED)
        if row["cost_usd"] is not None and row["cost_availability"] == "available"
        else Metric[float]()
    )
    installed = {
        key: value
        for key, value in {
            "language": row["language_version_installed"],
            "framework": row["framework_version_installed"],
        }.items()
        if value is not None
    }
    return TrialResult(
        trial_id=row["trial_id"],
        run_id=row["run_id"],
        task_id=row["task"],
        task_version=row["task_version"],
        trial_index=row["trial_index"],
        execution_order=row["trial_index"],
        max_repairs=row["max_repairs"],
        max_parallel=row["max_parallel"],
        status=TrialStatus(row["status"]),
        agent=AgentRecord(
            name=row["harness"],
            version=row["harness_version"],
            requested_model=row["requested_model"],
            resolved_model=row["model"],
            reasoning_effort=row["reasoning_effort"],
            auth_mode=AuthMode(row["auth_mode"]),
            provider=row["provider"],
            endpoint_host=row["endpoint_host"],
        ),
        environment=EnvironmentRecord(
            stack=row["stack"],
            language=row["language"],
            language_version=row["language_version"],
            framework=row["framework"],
            framework_version=row["framework_version"],
            installed_versions=installed,
            framework_version_changed=row.get("framework_version_changed"),
        ),
        tooling=ToolingRecord(mode=ToolingMode(row["tooling_mode"])),
        metrics=TrialMetrics(
            performance=PerformanceMetrics(agent_execution_seconds=seconds),
            usage=UsageMetrics(cost=cost),
        ),
        rate_limit_events=[RateLimitEvent(message="fixture limit")] if row["rate_limited"] else [],
    )


def sql_params(task: str, version: str, filters: dict[str, Any]) -> dict[str, Any]:
    return {
        "task": task,
        "task_version": version,
        "verified": 1 if filters["verified"] else 0,
        "include_rate_limited": 1 if filters["include_rate_limited"] else 0,
        "since": None,
        "suite": filters["suite"],
        "harness": json.dumps(filters["harness"]),
        "harness_version": json.dumps(filters["harness_version"]),
        "model": json.dumps(filters["model"]),
        "stack": json.dumps(filters["stack"]),
        "language": json.dumps(filters["language"]),
        "framework": json.dumps(filters["framework"]),
        "provider": json.dumps(filters["provider"]),
        "mode": json.dumps(filters["mode"]),
        "auth": json.dumps(filters["auth"]),
        "repairs": json.dumps(filters["repairs"]),
        "parallel": json.dumps(filters["parallel"]),
        "min_trials": 3,
    }


def sql_text(dimensions: list[str]) -> str:
    expressions = [DIMENSION_SQL[dimension] for dimension in dimensions]
    value = expressions[0] if len(expressions) == 1 else "(" + " || ' + ' || ".join(expressions) + ")"
    return QUERY.read_text(encoding="utf-8").replace("{{value}}", value).replace(
        "{{group_by}}", ", ".join(expressions)
    )


def run_sql(
    con: duckdb.DuckDBPyConnection, dimensions: list[str], task: str, version: str, filters: dict[str, Any]
) -> list[dict[str, Any]]:
    result = con.execute(sql_text(dimensions), sql_params(task, version, filters))
    names = [description[0] for description in result.description]
    rows = []
    for values in result.fetchall():
        row = dict(zip(names, values, strict=True))
        row["success_rate"] = row["passed"] / row["trials"]
        rows.append(row)
    return rows


def expected_rows(trials: list[TrialResult], dimensions: list[str]) -> list[dict[str, Any]]:
    rows = compare_trials(trials, [DIMENSIONS[dimension] for dimension in dimensions])
    return [
        {**asdict(row), "success_rate": row.passed / row.trials}
        for row in rows
    ]


FLOAT_FIELDS = {"mean_seconds", "stdev_seconds", "mean_cost_usd", "success_rate"}
FIELDS = [
    "value",
    "trials",
    "passed",
    "rate_limited",
    "timed",
    "mean_seconds",
    "stdev_seconds",
    "mean_cost_usd",
    "cost_samples",
    "low_confidence",
    "success_rate",
]


def equal_value(left: Any, right: Any) -> bool:
    if left is None or right is None:
        return left is right
    if isinstance(left, float) or isinstance(right, float):
        return math.isclose(float(left), float(right), rel_tol=1e-9, abs_tol=1e-9)
    return left == right


def assert_rows(actual: list[dict[str, Any]], expected: list[dict[str, Any]], label: str) -> None:
    if len(actual) != len(expected):
        raise AssertionError(f"{label}: {len(actual)} rows, expected {len(expected)}")
    for index, (got, want) in enumerate(zip(actual, expected, strict=True)):
        for field in FIELDS:
            if not equal_value(got[field], want[field]):
                raise AssertionError(
                    f"{label}: row {index} field {field}: {got[field]!r}, expected {want[field]!r}"
                )


CASES: list[tuple[str, str, list[str], dict[str, Any]]] = [
    ("auth-api", "1", ["harness"], base_filters()),
    ("auth-api", "1", ["harness"], base_filters(include_rate_limited=True)),
    ("misc-api", "1", ["harness_model"], base_filters()),
    (
        "url-shortener-api",
        "1",
        ["harness_model"],
        base_filters(include_rate_limited=True, stack=["fastapi-latest"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness_version"],
        base_filters(
            suite=SUITE_A,
            harness=["codex"],
            model=["gpt-6-luna"],
            stack=["fastapi"],
        ),
    ),
    ("task-management-api", "2", ["model"], base_filters(suite=SUITE_A, harness=["claude"], stack=["fastapi"])),
    (
        "task-management-api",
        "2",
        ["harness_model"],
        base_filters(suite=SUITE_A, stack=["fastapi"]),
    ),
    (
        "url-shortener-api",
        "1",
        ["stack"],
        base_filters(harness=["codex"], model=["gpt-6-luna"]),
    ),
    (
        "url-shortener-api",
        "1",
        ["language"],
        base_filters(harness=["codex"], model=["gpt-6-luna"], stack=["fastapi-latest"]),
    ),
    (
        "url-shortener-api",
        "1",
        ["framework"],
        base_filters(harness=["codex"], model=["gpt-6-luna"], stack=["fastapi-latest"]),
    ),
    (
        "notes-api",
        "1",
        ["provider"],
        base_filters(harness=["codex"], model=["gpt-6-luna"], stack=["fastapi-latest"]),
    ),
    ("auth-api", "1", ["harness", "model"], base_filters()),
    ("auth-api", "1", ["harness", "model", "provider"], base_filters()),
    (
        "task-management-api",
        "2",
        ["stack", "model"],
        base_filters(suite=SUITE_A, harness=["claude"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness", "provider"],
        base_filters(suite=SUITE_A, model=["gpt-6-luna"], stack=["fastapi"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness_model", "stack"],
        base_filters(suite=SUITE_A, harness=["claude"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness", "model", "stack"],
        base_filters(suite=SUITE_A),
    ),
    (
        "task-management-api",
        "2",
        ["provider"],
        base_filters(
            suite=SUITE_A,
            harness=["claude"],
            model=["claude-opus-5-5"],
            stack=["fastapi"],
        ),
    ),
    ("url-shortener-api", "1", ["stack", "model"], base_filters(harness=["codex"])),
    (
        "task-management-api",
        "2",
        ["language", "model"],
        base_filters(suite=SUITE_A, harness=["claude"], stack=["fastapi"]),
    ),
    (
        "task-management-api",
        "2",
        ["framework", "model"],
        base_filters(suite=SUITE_A, harness=["claude"], stack=["fastapi"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness_version", "model"],
        base_filters(suite=SUITE_A, harness=["codex"], stack=["fastapi"]),
    ),
    (
        "notes-api",
        "1",
        ["harness", "provider"],
        base_filters(stack=["fastapi-latest"], model=["gpt-6-luna"]),
    ),
    (
        "notes-api",
        "1",
        ["provider", "model"],
        base_filters(harness=["codex"], stack=["fastapi-latest"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness_model", "provider"],
        base_filters(suite=SUITE_A, stack=["fastapi"]),
    ),
    (
        "task-management-api",
        "2",
        ["harness", "model", "provider"],
        base_filters(suite=SUITE_A, stack=["fastapi"]),
    ),
    (
        "auth-api",
        "1",
        ["harness_version", "provider"],
        base_filters(stack=["fastapi-latest"], model=["gpt-6-luna"]),
    ),
    ("auth-api", "1", ["harness", "model", "stack"], base_filters(stack=["fastapi-latest"])),
]


def test_single_comparisons(rows: list[dict[str, Any]], con: duckdb.DuckDBPyConnection) -> set[str]:
    tested: set[str] = set()
    for task, version, dimensions, filters in CASES:
        chosen = selected(rows, task, version, filters)
        if len({row["suite_sha256"] for row in chosen}) > 1:
            raise AssertionError(f"{task}@{version} {dimensions}: case mixes suites")
        expected = expected_rows([trial(row) for row in chosen], dimensions)
        actual = run_sql(con, dimensions, task, version, filters)
        assert_rows(actual, expected, f"{task}@{version} {'+'.join(dimensions)}")
        tested.update(dimensions)
    required = set(DIMENSIONS) | {"harness_model"}
    missing = required - tested
    if missing:
        raise AssertionError(f"no contract case covered dimensions: {sorted(missing)}")
    return tested


def matrix_input(
    rows: list[dict[str, Any]], con: duckdb.DuckDBPyConnection
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    filters = base_filters(stack=["fastapi-latest"])
    chosen = [
        row
        for row in rows
        if row["verified"] and not row["rate_limited"] and row["stack"] == "fastapi-latest"
    ]
    suites = {row["run_id"]: row["suite_sha256"] for row in rows}
    matrix = compare_matrix(
        [trial(row) for row in chosen],
        ComparisonDimension.HARNESS_MODEL,
        ["auth-api", "url-shortener-api", "notes-api"],
        ResultFilter(stack="fastapi-latest"),
        suite_of=suites.get,
    )
    columns = []
    for column in matrix.columns:
        if column.refused is not None:
            sql_rows: list[dict[str, Any]] = []
        else:
            sql_rows = run_sql(
                con,
                ["harness_model"],
                column.task,
                column.task_version or "",
                filters,
            )
            assert_rows(
                sql_rows,
                [
                    {**asdict(row), "success_rate": row.passed / row.trials}
                    for row in column.rows
                ],
                f"matrix column {column.task}@{column.task_version}",
            )
        columns.append(
            {
                "task": column.task,
                "task_version": column.task_version,
                "rows": sql_rows,
                "refused": column.refused,
                "href": "",
            }
        )
    expected = []
    for row in matrix.rows:
        expected.append(
            {
                "value": row.value,
                "cells": [
                    None
                    if cell is None
                    else {**asdict(cell), "success_rate": cell.passed / cell.trials}
                    for cell in row.cells
                ],
                "overall": asdict(row.overall),
            }
        )
    return columns, expected


def assert_matrix(actual: list[dict[str, Any]], expected: list[dict[str, Any]]) -> None:
    if len(actual) != len(expected):
        raise AssertionError(f"matrix: {len(actual)} rows, expected {len(expected)}")
    for index, (got, want) in enumerate(zip(actual, expected, strict=True)):
        if got["value"] != want["value"]:
            raise AssertionError(f"matrix row {index}: {got['value']!r}, expected {want['value']!r}")
        if len(got["cells"]) != len(want["cells"]):
            raise AssertionError(f"matrix row {index}: cell count differs")
        for cell_index, (got_cell, want_cell) in enumerate(
            zip(got["cells"], want["cells"], strict=True)
        ):
            if (got_cell is None) != (want_cell is None):
                raise AssertionError(f"matrix row {index} cell {cell_index}: null differs")
            if got_cell is not None:
                for field in FIELDS:
                    if not equal_value(got_cell[field], want_cell[field]):
                        raise AssertionError(
                            f"matrix row {index} cell {cell_index} field {field}: "
                            f"{got_cell[field]!r}, expected {want_cell[field]!r}"
                        )
        for field, value in want["overall"].items():
            if not equal_value(got["overall"][field], value):
                raise AssertionError(
                    f"matrix row {index} overall {field}: {got['overall'][field]!r}, expected {value!r}"
                )


def main() -> None:
    rows = load_rows()
    con = duckdb.connect()
    con.execute("CREATE TABLE trials AS SELECT * FROM read_json_auto(?)", [str(FIXTURE)])
    tested = test_single_comparisons(rows, con)

    columns, expected = matrix_input(rows, con)
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump({"columns": columns}, handle)
        input_path = handle.name
    try:
        result = subprocess.run(
            ["pnpm", "exec", "tsx", str(MATRIX_TS), input_path],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    finally:
        Path(input_path).unlink(missing_ok=True)
    assert_matrix(json.loads(result.stdout), expected)

    print(
        f"contract ok: {len(CASES)} single comparisons over {len(tested)} dimensions; "
        f"{len(columns)} matrix columns"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - the script's exit code is the signal
        print(f"contract failed: {error}", file=sys.stderr)
        raise
