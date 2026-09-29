#!/usr/bin/env node
/**
 * scripts/build-pages.mjs
 *
 * GitHub Pages 用に全成果物を一つのディレクトリ（./pages）へ統合する。
 *
 * 最終的なディレクトリ構造:
 *   pages/
 *     index.html          ... MkDocs / ドキュメントトップ
 *     (mkdocs site files)
 *     reports/
 *       index.html        ... レポートナビゲーション
 *       unit-test-report.html
 *       integration-test-report.html
 *       fitness-test-report.html
 *       coverage/         ... Vitest HTML カバレッジレポート
 *         index.html
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGES_DIR = path.join(ROOT, 'pages');

function log(message) {
  process.stdout.write(`[build-pages] ${message}\n`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    log(`Skip (not found): ${src}`);
    return false;
  }
  ensureDir(dest);
  fs.cpSync(src, dest, { recursive: true });
  log(`Copied: ${src} -> ${dest}`);
  return true;
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    log(`Skip file (not found): ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  log(`Copied file: ${src} -> ${dest}`);
  return true;
}

// ── 1. 出力ディレクトリをクリーン ──────────────────────────────
if (fs.existsSync(PAGES_DIR)) {
  fs.rmSync(PAGES_DIR, { recursive: true });
}
ensureDir(PAGES_DIR);
ensureDir(path.join(PAGES_DIR, 'reports'));
ensureDir(path.join(PAGES_DIR, 'reports', 'coverage'));

// ── 2. MkDocs サイト (ドキュメント) ────────────────────────────
const mkdocsSite = path.join(ROOT, 'site');
if (fs.existsSync(mkdocsSite)) {
  // site/reports 以下は上書きされるが、後でレポートで上書きするので問題なし
  fs.cpSync(mkdocsSite, PAGES_DIR, { recursive: true });
  log(`Copied MkDocs site: ${mkdocsSite} -> ${PAGES_DIR}`);
} else {
  log('MkDocs site not found; creating placeholder index.html');
  fs.writeFileSync(
    path.join(PAGES_DIR, 'index.html'),
    `<!doctype html>
<html lang="ja">
  <head><meta charset="utf-8"><title>Biotope Matrix</title></head>
  <body>
    <h1>Biotope Matrix Documentation</h1>
    <p><a href="reports/">CI Reports</a></p>
  </body>
</html>`,
  );
}

// ── 3. Vitest カバレッジ HTML レポート ──────────────────────────
copyDirIfExists(
  path.join(ROOT, 'coverage'),
  path.join(PAGES_DIR, 'reports', 'coverage'),
);

// ── 4. テストレポート HTML ───────────────────────────────────────
const artifactsDir = path.join(ROOT, '.artifacts');
const reportsDestDir = path.join(PAGES_DIR, 'reports');

const reportMappings = [
  { src: 'unit-test-report.html', input: 'unit-report.json' },
  { src: 'integration-test-report.html', input: 'integration-report.json' },
  { src: 'fitness-test-report.html', input: 'fitness-report.json' },
];

for (const { src, input } of reportMappings) {
  // site/reports/ にすでに生成されている場合はそちらを使う
  const fromSite = path.join(mkdocsSite, 'reports', src);
  const fromRoot = path.join(ROOT, 'site', 'reports', src);
  const destFile = path.join(reportsDestDir, src);

  if (fs.existsSync(fromSite)) {
    fs.copyFileSync(fromSite, destFile);
    log(`Copied report: ${src}`);
  } else if (fs.existsSync(fromRoot)) {
    fs.copyFileSync(fromRoot, destFile);
    log(`Copied report (fallback): ${src}`);
  } else {
    // アーティファクト JSON から生成
    const inputPath = path.join(artifactsDir, input);
    if (fs.existsSync(inputPath)) {
      try {
        execSync(`node "${path.join(ROOT, 'scripts', 'generate-test-report.mjs')}" "${inputPath}" "${destFile}"`, {
          stdio: 'inherit',
          cwd: ROOT,
        });
        log(`Generated report from JSON: ${src}`);
      } catch {
        log(`Failed to generate report: ${src}`);
      }
    } else {
      log(`No source for report: ${src}`);
    }
  }
}

// ── 5. reports/index.html ナビゲーション ─────────────────────────
const coverageExists = fs.existsSync(path.join(PAGES_DIR, 'reports', 'coverage', 'index.html'));
const unitExists = fs.existsSync(path.join(PAGES_DIR, 'reports', 'unit-test-report.html'));
const integrationExists = fs.existsSync(path.join(PAGES_DIR, 'reports', 'integration-test-report.html'));
const fitnessExists = fs.existsSync(path.join(PAGES_DIR, 'reports', 'fitness-test-report.html'));

const reportLinks = [
  coverageExists && '<li><a href="coverage/">📊 カバレッジレポート (HTML)</a></li>',
  unitExists && '<li><a href="unit-test-report.html">🧪 ユニットテストレポート</a></li>',
  integrationExists && '<li><a href="integration-test-report.html">🔗 統合テストレポート</a></li>',
  fitnessExists && '<li><a href="fitness-test-report.html">⚡ フィットネス / アーキテクチャテストレポート</a></li>',
].filter(Boolean).join('\n              ');

fs.writeFileSync(
  path.join(PAGES_DIR, 'reports', 'index.html'),
  `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CI Reports – Biotope Matrix</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0; padding: 0; background: #0f172a; color: #e2e8f0; }
      main { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
      h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
      .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px;
               background: rgba(34,197,94,0.15); color: #22c55e;
               font-size: 0.75rem; font-weight: 700; margin-left: 0.5rem; }
      ul { list-style: none; padding: 0; margin: 1.5rem 0; }
      li { margin: 0.75rem 0; }
      a { color: #60a5fa; text-decoration: none; font-size: 1.05rem; }
      a:hover { text-decoration: underline; }
      .back { margin-top: 2rem; border-top: 1px solid #334155; padding-top: 1rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>CI Reports <span class="badge">GitHub Pages</span></h1>
      <p>最新 CI ビルドのテスト結果とカバレッジをブラウザで確認できます。</p>
      <ul>
        ${reportLinks || '<li>レポートがまだ生成されていません。</li>'}
      </ul>
      <div class="back">
        <a href="../">← ドキュメントトップへ戻る</a>
      </div>
    </main>
  </body>
</html>`,
);
log('Generated reports/index.html');

// ── 6. 完了サマリー ───────────────────────────────────────────────
const pageFiles = fs.readdirSync(PAGES_DIR);
log(`\nPages bundle complete: ${PAGES_DIR}`);
log(`Top-level entries: ${pageFiles.join(', ')}`);

