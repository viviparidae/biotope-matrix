#!/usr/bin/env python3
"""Validate documentation requirements against ISO 29148/25010 expectations."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

try:
    import yaml
except ImportError as exc:  # pragma: no cover - runtime dependency in CI
    raise SystemExit("PyYAML is required. Install it with: python -m pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS_DIR = ROOT / "docs" / "requirements"

ALLOWED_CATEGORIES = {
    "functional",
    "performance_efficiency",
    "compatibility",
    "reliability",
    "maintainability",
    "portability",
    "security",
    "usability",
}

def iter_requirement_files(base_dir: Path) -> Iterable[Path]:
    if not base_dir.exists():
        return []
    return sorted(base_dir.rglob("*.yml")) + sorted(base_dir.rglob("*.yaml"))


def load_requirements() -> Tuple[Dict[str, Dict[str, Any]], List[str]]:
    errors: List[str] = []
    requirements: Dict[str, Dict[str, Any]] = {}

    for file_path in iter_requirement_files(REQUIREMENTS_DIR):
        try:
            payload = yaml.safe_load(file_path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            errors.append(f"{file_path}: invalid YAML: {exc}")
            continue

        items = payload.get("requirements", []) if isinstance(payload, dict) else []
        if not isinstance(items, list):
            errors.append(f"{file_path}: expected a list under 'requirements'")
            continue

        for item in items:
            if not isinstance(item, dict):
                errors.append(f"{file_path}: each requirement must be an object")
                continue

            req_id = item.get("id")
            if not req_id:
                errors.append(f"{file_path}: requirement is missing an 'id'")
                continue

            if not isinstance(req_id, str) or not re.fullmatch(r"(?:REQ|NFR)-[A-Z0-9-]+(?:-\d+)?", req_id):
                errors.append(f"{file_path}: invalid requirement id '{req_id}'")
                continue

            if req_id in requirements:
                errors.append(f"Duplicate requirement id '{req_id}' found in {requirements[req_id].get('source', '<unknown>')} and {file_path}")
                continue

            item = dict(item)
            item["source"] = str(file_path)
            requirements[req_id] = item

    return requirements, errors


def validate_required_fields(requirements: Dict[str, Dict[str, Any]]) -> List[str]:
    errors: List[str] = []

    for req_id, req in requirements.items():
        missing = [field for field in ("title", "description", "parents", "category", "verification_method") if field not in req]
        if missing:
            errors.append(f"{req_id}: missing required fields: {', '.join(missing)}")
            continue

        title = str(req["title"]).strip()
        description = str(req["description"]).strip()
        parents = req.get("parents", [])
        category = str(req["category"]).strip()
        verification = str(req["verification_method"]).strip()

        if not title:
            errors.append(f"{req_id}: title cannot be empty")
        if len(title) < 5:
            errors.append(f"{req_id}: title is too short to be clear: '{title}'")
        if not description:
            errors.append(f"{req_id}: description cannot be empty")
        if "TODO" in description.upper() or "TBD" in description.upper() or "<" in description or ">" in description:
            errors.append(f"{req_id}: description contains placeholders or unresolved text")
        if category not in ALLOWED_CATEGORIES:
            errors.append(f"{req_id}: category '{category}' is not in the ISO 25010 set")
        if not isinstance(parents, list):
            errors.append(f"{req_id}: parents must be a list")
        if not verification:
            errors.append(f"{req_id}: verification_method cannot be empty")

    return errors


def validate_parent_links(requirements: Dict[str, Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    for req_id, req in requirements.items():
        parents = req.get("parents", [])
        if not isinstance(parents, list):
            continue
        for parent_id in parents:
            if parent_id not in requirements:
                errors.append(f"{req_id}: parent '{parent_id}' is not defined")
    return errors


def detect_cycle(requirements: Dict[str, Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    visited: Dict[str, int] = {}
    stack: List[str] = []

    def dfs(node_id: str) -> None:
        visited[node_id] = 1
        stack.append(node_id)
        for parent in requirements.get(node_id, {}).get("parents", []):
            if parent not in requirements:
                continue
            state = visited.get(parent, 0)
            if state == 1:
                cycle = stack[stack.index(parent):] + [parent]
                errors.append(f"Cycle detected: {' -> '.join(cycle)}")
            elif state == 0:
                dfs(parent)
        stack.pop()
        visited[node_id] = 2

    for node_id in requirements:
        if visited.get(node_id, 0) == 0:
            dfs(node_id)

    return errors


def validate_verifiability(requirements: Dict[str, Dict[str, Any]]) -> List[str]:
    errors: List[str] = []

    for req_id, req in requirements.items():
        description = str(req.get("description", "")).strip()
        category = str(req.get("category", "")).strip().lower()
        verification = str(req.get("verification_method", "")).strip()
        response_measure = req.get("response_measure")

        if category in {"functional"}:
            if not re.search(r"\b(Given|When|Then)\b", description, flags=re.IGNORECASE):
                errors.append(f"{req_id}: functional requirements should use a Given-When-Then style description")
            if "Gherkin" not in verification and "Scenario" not in verification and "Test" not in verification:
                errors.append(f"{req_id}: functional requirements should specify Gherkin or test-based verification")
        else:
            if response_measure is None:
                errors.append(f"{req_id}: non-functional requirements need a quantitative response_measure")
            elif not re.search(r"\d+\s*(ms|fps|%|seconds?|minutes?|requests?|MB|GB|kB)", str(response_measure), flags=re.IGNORECASE):
                errors.append(f"{req_id}: response_measure is not quantitative enough: '{response_measure}'")

    return errors


def validate_clarity(requirements: Dict[str, Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    for req_id, req in requirements.items():
        title = str(req.get("title", "")).strip()
        description = str(req.get("description", "")).strip()
        if re.search(r"\b(should|maybe|possibly|kind of|sort of|probably)\b", description, flags=re.IGNORECASE):
            errors.append(f"{req_id}: description uses vague wording that weakens requirement clarity")
        if title and re.search(r"\b(etc|and/or|stuff|things)\b", title, flags=re.IGNORECASE):
            errors.append(f"{req_id}: title contains ambiguous language")
        if title and title.endswith("."):
            errors.append(f"{req_id}: title should not end with a period")
    return errors


def main() -> int:
    requirements, errors = load_requirements()
    errors.extend(validate_required_fields(requirements))
    errors.extend(validate_parent_links(requirements))
    errors.extend(detect_cycle(requirements))
    errors.extend(validate_verifiability(requirements))
    errors.extend(validate_clarity(requirements))

    if errors:
        print("Requirement validation failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print(f"Requirement validation succeeded for {len(requirements)} requirements across {len(iter_requirement_files(REQUIREMENTS_DIR))} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
