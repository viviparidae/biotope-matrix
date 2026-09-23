#!/usr/bin/env python3
"""Generate a Mermaid traceability DAG from YAML requirement definitions."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set, Tuple

try:
    import yaml
except ImportError as exc:  # pragma: no cover - runtime dependency in CI
    raise SystemExit("PyYAML is required. Install it with: python -m pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS_DIR = ROOT / "docs" / "requirements"
OUTPUT_PATH = REQUIREMENTS_DIR / "traceability.md"


def slugify(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", value)


def load_requirements() -> Dict[str, Dict[str, Any]]:
    requirements: Dict[str, Dict[str, Any]] = {}
    for file_path in sorted(REQUIREMENTS_DIR.rglob("*.yml")) + sorted(REQUIREMENTS_DIR.rglob("*.yaml")):
        payload = yaml.safe_load(file_path.read_text(encoding="utf-8")) or {}
        for item in payload.get("requirements", []):
            req_id = item.get("id")
            if req_id:
                requirements[req_id] = item
    return requirements


def render_mermaid(requirements: Dict[str, Dict[str, Any]]) -> str:
    lines: List[str] = ["```mermaid", "graph TD"]
    seen_nodes: Set[str] = set()
    seen_edges: Set[Tuple[str, str]] = set()

    for req_id, req in sorted(requirements.items()):
        node_id = slugify(req_id)
        title = req.get("title", req_id)
        if node_id not in seen_nodes:
            lines.append(f'    {node_id}["{req_id}: {title}"]')
            seen_nodes.add(node_id)
        for parent in req.get("parents", []):
            parent_node = slugify(str(parent))
            if parent_node not in seen_nodes:
                lines.append(f'    {parent_node}["{parent}"]')
                seen_nodes.add(parent_node)
            edge = (parent_node, node_id)
            if edge not in seen_edges:
                lines.append(f"    {parent_node} --> {node_id}")
                seen_edges.add(edge)

        design_refs = req.get("design_refs", []) or []
        if isinstance(design_refs, str):
            design_refs = [design_refs]
        for design_ref in design_refs:
            design_id = slugify(f"design_{req_id}_{design_ref}")
            design_label = Path(str(design_ref)).name
            if design_id not in seen_nodes:
                lines.append(f'    {design_id}["Design: {design_label}"]')
                seen_nodes.add(design_id)
            edge = (node_id, design_id)
            if edge not in seen_edges:
                lines.append(f"    {node_id} --> {design_id}")
                seen_edges.add(edge)

        test_refs = req.get("test_refs", []) or []
        if isinstance(test_refs, str):
            test_refs = [test_refs]
        for test_ref in test_refs:
            test_id = slugify(f"test_{req_id}_{test_ref}")
            test_label = Path(str(test_ref)).name
            if test_id not in seen_nodes:
                lines.append(f'    {test_id}["Test: {test_label}"]')
                seen_nodes.add(test_id)
            edge = (node_id, test_id)
            if edge not in seen_edges:
                lines.append(f"    {node_id} --> {test_id}")
                seen_edges.add(edge)

    lines.append("```")
    return "\n".join(lines)


def main() -> int:
    requirements = load_requirements()
    markdown = "# Requirement Traceability\n\n" + render_mermaid(requirements) + "\n"
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(markdown, encoding="utf-8")
    print(f"Traceability graph generated at {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
