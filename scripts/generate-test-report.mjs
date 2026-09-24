#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [, , inputPathArg = '.artifacts/vitest-report.json', outputPathArg = 'site/test-report.html'] = process.argv;
const inputPath = path.resolve(process.cwd(), inputPathArg);
const outputPath = path.resolve(process.cwd(), outputPathArg);

function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFailureRows(payload) {
  const results = Array.isArray(payload?.testResults) ? payload.testResults : [];
  const rows = [];

  for (const suite of results) {
    const assertionResults = Array.isArray(suite?.assertionResults) ? suite.assertionResults : [];
    for (const assertion of assertionResults) {
      if (assertion?.status !== 'failed') continue;

      const suiteName = Array.isArray(suite?.ancestorTitles) ? suite.ancestorTitles.join(' > ') : (suite?.name ?? 'Unknown suite');
      const testName = assertion?.fullName || assertion?.title || 'Unknown test';
      const failureMessages = Array.isArray(assertion?.failureMessages) && assertion.failureMessages.length > 0
        ? assertion.failureMessages
        : ['No failure details were captured.'];

      rows.push({
        title: `${suiteName} > ${testName}`,
        failureMessages,
      });
    }
  }

  return rows;
}

function summarizePayload(payload) {
  const numPassedTests = Number(payload?.numPassedTests ?? 0);
  const numFailedTests = Number(payload?.numFailedTests ?? 0);
  const numTotalTests = Number(payload?.numTotalTests ?? 0);
  const failedSuites = Number(payload?.numFailedTestSuites ?? 0);
  const passedSuites = Number(payload?.numPassedTestSuites ?? 0);
  const totalSuites = Number(payload?.numTotalTestSuites ?? 0);

  return {
    numPassedTests,
    numFailedTests,
    numTotalTests,
    numPassedTestSuites: passedSuites,
    numFailedTestSuites: failedSuites,
    numTotalTestSuites: totalSuites,
  };
}

let payload = {
  numPassedTests: 0,
  numFailedTests: 0,
  numPassedTestSuites: 0,
  numFailedTestSuites: 0,
  numTotalTestSuites: 0,
  numTotalTests: 0,
  testResults: [],
};

if (fs.existsSync(inputPath)) {
  try {
    const raw = fs.readFileSync(inputPath, 'utf8');
    payload = raw ? JSON.parse(raw) : payload;
  } catch (error) {
    payload = {
      ...payload,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const summary = summarizePayload(payload);
const failures = buildFailureRows(payload);
const statusLabel = summary.numFailedTests > 0 || summary.numFailedTestSuites > 0 ? 'FAIL' : 'PASS';
const statusClass = statusLabel === 'FAIL' ? 'status-fail' : 'status-pass';
const failureHtml = failures.length > 0
  ? failures.map(({ title, failureMessages }) => `
      <article class="failure-item">
        <h3>${escapeHtml(title)}</h3>
        <pre>${escapeHtml(failureMessages.join('\n\n'))}</pre>
      </article>
    `).join('\n')
  : '<p class="empty">No failed assertions were captured.</p>';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test Report</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0f172a;
        --panel: #111827;
        --muted: #94a3b8;
        --border: #334155;
        --pass: #22c55e;
        --fail: #ef4444;
        --text: #e2e8f0;
        --code: #f8fafc;
      }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      h1 {
        margin-bottom: 0.5rem;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        margin: 2rem 0;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
      }
      .label {
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .value {
        font-size: 2rem;
        font-weight: 700;
        margin-top: 0.5rem;
      }
      .status {
        display: inline-block;
        padding: 0.5rem 0.9rem;
        border-radius: 999px;
        font-weight: 700;
        margin-top: 1rem;
      }
      .status-pass {
        background: rgba(34, 197, 94, 0.16);
        color: var(--pass);
      }
      .status-fail {
        background: rgba(239, 68, 68, 0.18);
        color: var(--fail);
      }
      .failure-item {
        margin-top: 1.25rem;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
      }
      .failure-item h3 {
        margin-top: 0;
        color: #fbbf24;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #020617;
        color: var(--code);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.75rem;
        overflow-x: auto;
      }
      .empty {
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Test execution report</h1>
      <div class="status ${statusClass}">${statusLabel}</div>

      <section class="summary">
        <div class="card">
          <div class="label">Passed tests</div>
          <div class="value">${summary.numPassedTests}</div>
        </div>
        <div class="card">
          <div class="label">Failed tests</div>
          <div class="value">${summary.numFailedTests}</div>
        </div>
        <div class="card">
          <div class="label">Test suites</div>
          <div class="value">${summary.numTotalTestSuites}</div>
        </div>
        <div class="card">
          <div class="label">Failed suites</div>
          <div class="value">${summary.numFailedTestSuites}</div>
        </div>
      </section>

      <section>
        <h2>Failures</h2>
        ${failureHtml}
      </section>
    </main>
  </body>
</html>`;

const directory = path.dirname(outputPath);
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Generated test report at ${outputPath}`);
