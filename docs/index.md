# Biotope Matrix Documentation Portal

This portal centralizes the project requirement model, quality gates, architecture decisions, and validation artifacts.

## Quality model

- ISO/IEC/IEEE 29148: requirement clarity, consistency, and traceability
- ISO/IEC 25010: quality attribute coverage across functional and non-functional requirements

## Primary views

- Requirement catalog: [requirements.md](requirements.md)
- Requirement data: [requirements/data/predation.yml](requirements/data/predation.yml)
- Traceability graph: [requirements/traceability.md](requirements/traceability.md)
- Documentation operations: [DOCS_SYSTEM_GUIDE.md](DOCS_SYSTEM_GUIDE.md)

## CI policy

Every pull request runs the documentation quality gate to validate YAML requirement integrity, text quality, markdown correctness, and site generation.
