#!/usr/bin/env python3

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / 'docs'
REPORT_DIR = DOCS_DIR / 'reports'
DASHBOARD_DIR = DOCS_DIR / 'dashboard'
COVERAGE_FILE = ROOT / 'coverage' / 'coverage-final.json'


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_requirement_data() -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    for file_path in sorted((ROOT / 'docs' / 'requirements' / 'data').glob('*.yml')):
        try:
            with file_path.open('r', encoding='utf-8') as handle:
                data = yaml.safe_load(handle) or {}
            for item in data.get('requirements', []):
                if isinstance(item, dict):
                    requirements.append(item)
        except Exception:
            continue
    return requirements


def coverage_summary() -> dict[str, Any]:
    if not COVERAGE_FILE.exists():
        return {
            'statements_covered': 0,
            'statements_total': 0,
            'coverage_pct': 0.0,
            'source': 'not-generated',
        }

    try:
        raw = json.loads(COVERAGE_FILE.read_text(encoding='utf-8'))
    except json.JSONDecodeError:
        return {
            'statements_covered': 0,
            'statements_total': 0,
            'coverage_pct': 0.0,
            'source': 'invalid-json',
        }

    covered = 0
    total = 0
    for entry in raw.values():
        if not isinstance(entry, dict):
            continue
        statements = entry.get('s', {})
        if not isinstance(statements, dict):
            continue
        total += len(statements)
        covered += sum(1 for value in statements.values() if safe_float(value, 0.0) > 0)

    pct = (covered / total * 100.0) if total else 0.0
    return {
        'statements_covered': covered,
        'statements_total': total,
        'coverage_pct': round(pct, 2),
        'source': 'coverage-final.json',
    }


def requirement_summary(requirements: list[dict[str, Any]]) -> dict[str, Any]:
    categories = Counter(str(item.get('category', 'unknown')) for item in requirements)
    coverage_count = len(requirements)
    traceable = sum(1 for item in requirements if item.get('test_refs'))
    return {
        'total_requirements': coverage_count,
        'traceable_requirements': traceable,
        'traceability_pct': round((traceable / coverage_count * 100.0) if coverage_count else 0.0, 2),
        'categories': dict(sorted(categories.items())),
        'ids': [str(item.get('id', 'UNKNOWN')) for item in requirements],
    }


def quality_score(coverage_pct: float, traceability_pct: float) -> float:
    return round((coverage_pct * 0.7) + (traceability_pct * 0.3), 2)


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)

    requirements = load_requirement_data()
    coverage = coverage_summary()
    requirement = requirement_summary(requirements)
    overall_score = quality_score(coverage.get('coverage_pct', 0.0), requirement.get('traceability_pct', 0.0))

    report_payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'product_quality': {
            'coverage_pct': coverage.get('coverage_pct', 0.0),
            'test_coverage_status': 'healthy' if coverage.get('coverage_pct', 0.0) >= 75 else 'needs_attention',
            'statements_covered': coverage.get('statements_covered', 0),
            'statements_total': coverage.get('statements_total', 0),
        },
        'project_quality': {
            'traceability_pct': requirement.get('traceability_pct', 0.0),
            'traceability_status': 'healthy' if requirement.get('traceability_pct', 0.0) >= 90 else 'needs_attention',
            'total_requirements': requirement.get('total_requirements', 0),
            'traceable_requirements': requirement.get('traceable_requirements', 0),
            'quality_score': overall_score,
        },
        'requirements': requirement,
        'status': 'ok' if overall_score >= 80 else 'warning',
    }

    (REPORT_DIR / 'quality-report.json').write_text(json.dumps(report_payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    quality_state = 'Healthy' if overall_score >= 80 else 'Needs attention'
    status_color = 'green' if overall_score >= 80 else 'orange'

    dashboard_md = f'''# Product Quality & Project Quality Dashboard

## Executive summary

The current release is in **{quality_state.lower()}** status with an overall quality score of **{overall_score:.2f}/100**.

| Metric | Value | Status |
| --- | ---: | --- |
| Statement coverage | {coverage.get('coverage_pct', 0.0):.2f}% | {'Healthy' if coverage.get('coverage_pct', 0.0) >= 75 else 'Needs attention'} |
| Requirement traceability | {requirement.get('traceability_pct', 0.0):.2f}% | {'Healthy' if requirement.get('traceability_pct', 0.0) >= 90 else 'Needs attention'} |
| Total requirements | {requirement.get('total_requirements', 0)} | N/A |
| Quality score | {overall_score:.2f}/100 | {quality_state} |

<div class="grid cards" markdown>

-   :material-check-circle:{' green' if overall_score >= 80 else ''}  **Product quality**
    - Coverage: {coverage.get('coverage_pct', 0.0):.2f}%
    - Status: {'Healthy' if coverage.get('coverage_pct', 0.0) >= 75 else 'Needs attention'}

-   :material-file-document-check:{' green' if requirement.get('traceability_pct', 0.0) >= 90 else ''}  **Project quality**
    - Traceability: {requirement.get('traceability_pct', 0.0):.2f}%
    - Status: {'Healthy' if requirement.get('traceability_pct', 0.0) >= 90 else 'Needs attention'}

</div>

```mermaid
flowchart TD
    A[CI Quality Gate] --> B[Product Quality]
    A --> C[Project Quality]
    B --> D[Coverage: {coverage.get('coverage_pct', 0.0):.2f}%]
    C --> E[Traceability: {requirement.get('traceability_pct', 0.0):.2f}%]
    D --> F[Quality Score: {overall_score:.2f}/100]
    E --> F
```

## Requirement coverage by category

| Category | Count |
| --- | ---: |
{chr(10).join(f'| {category} | {count} |' for category, count in sorted(requirement.get('categories', {}).items())) or '| N/A | 0 |'}

## Quality notes

- Coverage and traceability are measured from the live CI artifacts and the requirement model under `docs/requirements/data`.
- Dashboard generation is automatic and is designed to be published via GitHub Pages with Material for MkDocs.
- The next release should focus on raising the lowest-scoring area before broadening feature scope.

## Related artifacts

- JSON payload: [../reports/quality-report.json](../reports/quality-report.json)
- Requirement model: [../requirements.md](../requirements.md)
- Documentation guide: [../DOCS_SYSTEM_GUIDE.md](../DOCS_SYSTEM_GUIDE.md)
'''

    (DASHBOARD_DIR / 'index.md').write_text(dashboard_md, encoding='utf-8')


if __name__ == '__main__':
    main()
