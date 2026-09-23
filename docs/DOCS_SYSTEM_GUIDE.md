# Documentation Quality System Guide

## 1. Purpose

This repository applies a document-as-code workflow that aligns project requirements, implementation tests, and design evidence with the ISO/IEC 29148 and ISO/IEC 25010 quality expectations.

## 2. Quality objectives

The quality gate protects the following system characteristics:

- Consistency: requirement IDs, titles, and parent relationships are unique and not contradictory.
- Traceability: every requirement links to its parent, design evidence, and test evidence.
- Verifiability: functional requirements use Given-When-Then phrases, while non-functional requirements include response measures.
- Completeness and clarity: no unresolved placeholders, no broken parent references, and no ambiguous wording.
- Maintainability: the portal and CI pipeline keep evidence and documentation synchronized.

## 3. Required sources of truth

- Requirement data: docs/requirements/data/*.yml
- Human-readable requirement summary: docs/requirements.md
- Test strategy: docs/test-strategy.md
- Architecture and coding rules: docs/architecture.md and docs/coding-standards.md
- CI validation: .github/workflows/docs-ci.yml

## 4. Operating procedure

1. Define requirement data in YAML under docs/requirements/data.
2. Ensure each requirement has a unique ID, a parent list, a category, and a verification rule.
3. Add or update a corresponding Gherkin scenario or response-measure based validation.
4. Run the validation script locally before opening a pull request.
5. Regenerate the traceability diagram and review the generated Mermaid DAG.
6. Confirm the MkDocs portal still builds with the docs index and navigation.

## 5. Local validation commands

```bash
python3 scripts/validate_requirements.py
python3 scripts/generate_traceability.py
mkdocs build --strict
```

## 6. CI policy

The quality pipeline fails when any of the following issues are detected:

- duplicate or undefined requirement IDs
- circular parent relationships
- missing response measures for non-functional requirements
- functional requirement descriptions without Given-When-Then language
- broken internal or external links
- markdown or text lint issues that violate the repository style rules

## 7. Release checklist

- All active requirements are represented in YAML.
- Parent-child traceability is free of cycles.
- Every requirement maps to either a feature scenario or a measurable quality scenario.
- Documentation portal builds cleanly.
- The generated traceability graph reflects the current requirement set.

## 8. Quality scorecard

The compliance review check should confirm the following thresholds:

- 100% requirement ID uniqueness
- 100% parent reference integrity
- 100% verifiability for active requirements
- 0 broken links in the documentation set
- 0 markdown lint violations

This document is the operational policy for the ISO-aligned documentation system and should be updated whenever the requirement model evolves.
