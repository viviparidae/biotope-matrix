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

    dashboard_md = f'''# プロダクト品質・プロジェクト品質ダッシュボード

## 概要

現在のリリースは **{quality_state.lower()}** 状態で、総合品質スコアは **{overall_score:.2f}/100** です。

| 指標 | 値 | 状態 |
| --- | ---: | --- |
| カバレッジ | {coverage.get('coverage_pct', 0.0):.2f}% | {'健全' if coverage.get('coverage_pct', 0.0) >= 75 else '要注意'} |
| 要件トレーサビリティ | {requirement.get('traceability_pct', 0.0):.2f}% | {'健全' if requirement.get('traceability_pct', 0.0) >= 90 else '要注意'} |
| 要件数 | {requirement.get('total_requirements', 0)} | N/A |
| 品質スコア | {overall_score:.2f}/100 | {quality_state} |

<div class="grid cards" markdown>

-   :material-check-circle:{' green' if overall_score >= 80 else ''}  **プロダクト品質**
    - カバレッジ: {coverage.get('coverage_pct', 0.0):.2f}%
    - 状態: {'健全' if coverage.get('coverage_pct', 0.0) >= 75 else '要注意'}

-   :material-file-document-check:{' green' if requirement.get('traceability_pct', 0.0) >= 90 else ''}  **プロジェクト品質**
    - トレーサビリティ: {requirement.get('traceability_pct', 0.0):.2f}%
    - 状態: {'健全' if requirement.get('traceability_pct', 0.0) >= 90 else '要注意'}

</div>

```mermaid
flowchart TD
    A[CI 品質ゲート] --> B[プロダクト品質]
    A --> C[プロジェクト品質]
    B --> D[カバレッジ: {coverage.get('coverage_pct', 0.0):.2f}%]
    C --> E[トレーサビリティ: {requirement.get('traceability_pct', 0.0):.2f}%]
    D --> F[品質スコア: {overall_score:.2f}/100]
    E --> F
```

## カテゴリ別の要件カバレッジ

| カテゴリ | 件数 |
| --- | ---: |
{chr(10).join(f'| {category} | {count} |' for category, count in sorted(requirement.get('categories', {}).items())) or '| N/A | 0 |'}

## 品質メモ

- カバレッジとトレーサビリティは、`docs/requirements/data` 配下の要求モデルと CI の実行結果から算出されています。
- ダッシュボードは自動生成され、Material for MkDocs と GitHub Pages によって公開されます。
- 次のリリースでは、最も低い指標を改善してから機能拡張を進めるのが望ましいです。

## 関連アーティファクト

- JSON 出力: [../reports/quality-report.json](../reports/quality-report.json)
- 要件モデル: [../requirements.md](../requirements.md)
- ドキュメントガイド: [../DOCS_SYSTEM_GUIDE.md](../DOCS_SYSTEM_GUIDE.md)
'''

    (DASHBOARD_DIR / 'index.md').write_text(dashboard_md, encoding='utf-8')


if __name__ == '__main__':
    main()
