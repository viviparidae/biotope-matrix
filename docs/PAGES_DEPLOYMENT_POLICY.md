# Pages デプロイ運用方針

## 概要

本プロジェクトは、テスト・型チェック失敗時でも GitHub Pages へビルド成果物とレポートを発行する方針を採用しています。

---

## 1. 発行対象ワークフロー

### 1.1 `quality-dashboard.yml` (統合報告用・主要)

- **トリガー**: `push` to main / 手動 `workflow_dispatch`
- **品質ゲート**: 適用しない（失敗時も推奨）
- **発行対象**:
  - ✅ MkDocs ドキュメントサイト
  - ✅ Vitest HTML カバレッジレポート
  - ✅ ユニットテストレポート
  - ✅ 統合テストレポート
  - ✅ 品質メトリクスダッシュボード

**発行条件**: 最後の `Deploy to GitHub Pages` ステップまで必ず到達し、失敗状態のレポートも含めて発行します。

---

### 1.2 `cd-pipeline.yml` (本番 CD パイプライン)

- **トリガー**: `push` to main のみ（PR では発行しない）
- **品質ゲート**: 段階的に適用（ただし全ステップ失敗時も Pages 発行は実行）
- **発行対象**:
  - ✅ MkDocs ドキュメントサイト
  - ✅ 適合度テスト・カバレッジレポート
  - ✅ シンセティックエコシステムテストレポート

**発行条件**:

- `acceptance-stage` 失敗時: `capacity-fitness-stage` は実行されず、`deploy-stage` も実行されない（ブランチ保護）
- `capacity-fitness-stage` 失敗時: `deploy-stage` は実行されるが、失敗状態のレポートを含める
- `deploy-stage` 内ステップ失敗時: その時点までのレポートを集約し、Pages 発行まで続行

---

### 1.3 `fitness.yml` (適合度・パフォーマンステスト独立実行)

- **トリガー**: PR / push（型チェック後に単独実行）
- **品質ゲート**: デプロイゲート非対象（参照情報のみ）
- **発行対象**: アーティファクト保存のみ（Pages 発行なし）

---

## 2. 失敗時のレポート生成・集約ロジック

### 2.1 エラー制御パターン

各テスト実行ステップで以下パターンを採用:

```bash
set +e                              # エラーで中止しない
pnpm exec vitest run ...           # テスト実行
echo "EXIT_CODE=$?" >> "$GITHUB_ENV"  # 終了コードを環境変数へ記録
```

これにより、テスト失敗でも後続ステップが実行されます。

### 2.2 レポート生成の強制実行

```yaml
- name: Generate test failure HTML reports
  if: always()  # ← 全ステップの前後条件に関わらず実行
  run: |
    set +e
    node scripts/generate-test-report.mjs \
      .artifacts/unit-report.json \
      site/reports/unit-test-report.html || true
    true  # ← 常に成功として扱う
```

- `if: always()`: テスト失敗・成功に関わらず実行
- `|| true`: スクリプト失敗時も後続へ進む

### 2.3 MkDocs ビルド失敗時の対応

```yaml
- name: Build MkDocs documentation site
  if: always()
  run: mkdocs build -d site || true  # 失敗時も次ステップへ
```

MkDocs ビルド失敗は Pages デプロイを阻止せず、既存サイトコンテンツを保持したまま新規レポートを追加します。

---

## 3. GitHub Pages への統合・デプロイフロー

### 3.1 レポート集約ステップ

```yaml
- name: Integrate coverage and test reports into Pages bundle
  if: always()
  run: |
    mkdir -p site/reports/coverage
    
    # カバレッジレポートをコピー
    if [ -d coverage ]; then
      cp -R coverage/. site/reports/coverage/
    fi
    
    # 生成された HTML レポートをコピー
    cp site/reports/*.html . || true
```

- **site/** ディレクトリへ全レポートを集約
- 存在しないファイルはスキップ（`|| true` で継続）

### 3.2 レポートナビゲーションページの生成

```yaml
- name: Generate reports navigation page
  if: always()
  run: |
    # 存在するレポートへのリンクのみ生成
    [ -f site/reports/coverage/index.html ] && \
      COVERAGE_LINK='<li><a href="coverage/">📊 ...</a></li>'
    
    # HTML を生成・出力
    cat > site/reports/index.html <<HTML
    ...
    HTML
```

- 失敗時のレポートは「生成されない場合がある」ため、条件分岐で対応
- 利用可能なレポートのリンクのみ表示

### 3.3 Pages アーティファクト・デプロイ

```yaml
- name: Upload Pages artifact
  if: always()
  uses: actions/upload-pages-artifact@v3
  with:
    path: ./site

- name: Deploy to GitHub Pages
  if: always()
  uses: actions/deploy-pages@v4
```

- `if: always()`: 前段ステップの成否に関わらず実行
- アーティファクトが `site/` に存在しなくてもエラーにしない設定

---

## 4. ブラウザでの確認フロー

### 4.1 アクセスポイント

```text
https://viviparidae.github.io/biotope-matrix/
  ├─ (MkDocs ドキュメント)
  └─ /reports/
      ├─ index.html (ナビゲーション)
      ├─ unit-test-report.html (ユニットテスト失敗時も含む)
      ├─ integration-test-report.html
      ├─ fitness-test-report.html (適合度テスト失敗状態)
      └─ coverage/index.html (カバレッジレポート)
```

### 4.2 失敗状態の可視化

- テスト失敗時は、HTML レポート内に赤色警告・エラースタックトレース・実行時間などが表示されます
- カバレッジ不足個所も視覚的に指摘

---

## 5. 品質ゲートとの関係

### 5.1 SKILL.md との分岐

| 判定軸 | CD パイプラインゲート | Pages 発行ゲート |
| --- | --- | --- |
| TypeScript 型チェック失敗 | ❌ commit-stage 停止 | ✅ Pages 発行（失敗状態） |
| ユニットテスト失敗 | ❌ commit-stage 停止 | ✅ Pages 発行（失敗状態） |
| 受入テスト失敗 | ❌ acceptance-stage 停止 → deploy-stage 不実行 | ❌ Pages 発行されない |
| 適合度テスト失敗 | ⚠️ 情報提供（非ブロック） | ✅ Pages 発行（失敗状態） |

**要点**:

- **コミット・受入ゲート**: 品質確保のため必須（SKILL.md 遵守）
- **Pages ゲート**: 失敗状態のレポートも「結果の可視化」として発行

### 5.2 運用上の判断基準

1. **PR・feature ブランチ**: Pages 未発行（GitHub Actions 実行のみ）
2. **main へのマージ後**:
   - commit-stage 失敗 → PR に戻す（Pages なし）
   - acceptance-stage 失敗 → 修復優先（Pages なし）
   - capacity-fitness-stage 失敗 → 失敗状態で Pages 発行（ダッシュボードで確認可能）
   - deploy-stage 失敗 → 部分的なレポートで Pages 発行

---

## 6. トラブルシューティング

### 6.1 Pages が発行されない場合

**原因**: `upload-pages-artifact` または `deploy-pages` がエラーで停止した

**確認**:

1. GitHub Actions ログで最後のステップを確認
2. `site/` ディレクトリが存在・非空であることを確認（`ls -la .github/workflows/.../artifacts/`）
3. Repository Settings → Pages: Source が "GitHub Actions" に設定されているか確認

### 6.2 レポートが表示されない場合

**原因 1**: HTML ファイルが `site/reports/` へコピーされていない

```bash
# ワークフロー内で確認
- run: |
    ls -la site/reports/ || echo "reports directory missing"
    find site/reports -name "*.html" || echo "No HTML reports found"
```

**原因 2**: レポート生成スクリプトが失敗

```bash
# scripts/generate-test-report.mjs の存在・実行権限を確認
ls -la scripts/generate-test-report.mjs
```

**原因 3**: `.artifacts/` に JSON レポートが生成されていない

```bash
- run: |
    ls -la .artifacts/ || echo "artifacts missing"
    file .artifacts/*.json || echo "No JSON files"
```

### 6.3 Pages ビルドが遅延する場合

**原因**: 大量のカバレッジレポート（数 MB）を転送中

**対策**:

- `retention-days` を短縮（`cleanup-artifact` で自動削除）
- `site/reports/coverage/` のサイズを制限（圧縮 or 要約表示）

---

## 7. ドキュメント参照

- テスト戦略: [docs/test-strategy.md](/workspaces/biotope-matrix/docs/test-strategy.md)
- 要件仕様: [docs/requirements.md](/workspaces/biotope-matrix/docs/requirements.md)
- ワークフロー定義: [.github/workflows/quality-dashboard.yml](/workspaces/biotope-matrix/.github/workflows/quality-dashboard.yml), [.github/workflows/cd-pipeline.yml](/workspaces/biotope-matrix/.github/workflows/cd-pipeline.yml)
- 品質ゲート規約: [.github/SKILL.md](/workspaces/biotope-matrix/.github/SKILL.md)
