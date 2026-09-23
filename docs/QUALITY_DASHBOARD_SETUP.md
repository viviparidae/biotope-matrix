# Quality Dashboard Setup

This project publishes a quality dashboard and project report to GitHub Pages using Material for MkDocs and the GitHub Pages deployment action.

## 1. Repository settings

In the GitHub repository UI:

1. Open Settings.
2. Open Pages.
3. Set Source to GitHub Actions.
4. Save the setting.

This enables GitHub to publish the static site built by the workflow in `.github/workflows/quality-dashboard.yml`.

## 2. Workflow behavior

The workflow runs on:

- push to `main`
- manual dispatch via `workflow_dispatch`

It performs the following steps:

- installs project dependencies
- runs unit and integration checks
- generates the quality metrics JSON and dashboard Markdown
- builds the MkDocs site
- uploads the site as a GitHub Pages artifact
- deploys it with `actions/deploy-pages`

## 3. Output URL

The site is published at:

`https://<username>.github.io/<repository>/`

For this repository, the configured site URL is:

`https://viviparidae.github.io/biotope-matrix/`

## 4. Useful files

- `scripts/generate_quality_report.py`
- `mkdocs.yml`
- `docs/dashboard/index.md`
- `docs/reports/quality-report.json`
- `.github/workflows/quality-dashboard.yml`

## 5. Troubleshooting

If the deployment fails:

- confirm the Pages source is set to GitHub Actions
- confirm the workflow has `pages: write` and `id-token: write`
- verify the `mkdocs build -d site` step succeeds locally
- inspect the generated JSON under `docs/reports/quality-report.json`
