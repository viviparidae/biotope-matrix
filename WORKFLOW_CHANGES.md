# GitHub Actions ワークフロー修正：テスト失敗時 Pages デプロイ強制実行

## 変更概要

以下のワークフローを修正し、**テスト・型チェック失敗時でも GitHub Pages へレポートをデプロイ**できるようにしました。

---

## 修正対象ワークフロー

### 1. `.github/workflows/quality-dashboard.yml`
**目的**: メイン Pages 発行ワークフロー

**主な変更**:
- ✅ TypeScript 型チェック失敗時も後続ステップへ進む
- ✅ ユニット・統合テスト失敗時も `if: always()` で報告処理を継続
- ✅ MkDocs ビルド失敗時も Pages デプロイまで続行

**キー修正**:
```yaml
# Before: 型チェック失敗で即停止
- name: TypeScript type check
  run: pnpm run typecheck

# After: エラーを記録し続行
- name: TypeScript type check
  run: |
    set +e
    pnpm run typecheck
    echo "TYPECHECK_EXIT=$?" >> "$GITHUB_ENV"
```

---

### 2. `.github/workflows/cd-pipeline.yml`
**目的**: 本番 CD パイプライン（ブランチ保護付き）

**主な変更**:
- ✅ `capacity-fitness-stage` のテスト失敗を記録（処理継続）
- ✅ `deploy-stage` の全ステップに `if: always()` を適用
- ✅ Pages 生成・デプロイまで失敗状態でも続行
- ✅ シンセティックトランザクションテスト失敗時も警告ログで対応（プロセス継続）

**段階的実行フロー**:
- ❌ `commit-stage` 失敗 → 後段は実行されない（品質ゲート）
- ❌ `acceptance-stage` 失敗 → `deploy-stage` 不実行（品質ゲート）
- ⚠️ `capacity-fitness-stage` 失敗 → `deploy-stage` は実行（失敗状態で Pages 発行）

---

### 3. `.github/workflows/fitness.yml`
**目的**: 適合度・パフォーマンステスト（独立実行）

**主な変更**:
- ✅ `set +e` でテスト失敗時も次ステップへ
- ✅ シンセティックテスト検証を失敗時も警告レベルで続行
- ✅ exit code を記録して可視化

---

## 修正の技術詳細

### エラー制御パターン

#### Pattern 1: 失敗を記録して続行（テスト実行）
```bash
set +e                                  # ← シェル内エラーで中止しない
pnpm run test:unit:coverage \           # ← テスト実行
  --reporter=json \
  --outputFile=.artifacts/unit-report.json
echo "UNIT_EXIT=$?" >> "$GITHUB_ENV"    # ← 終了コードを環境変数に記録
```

#### Pattern 2: 失敗を続行（報告処理）
```yaml
- name: Generate test failure HTML reports
  if: always()                           # ← 前ステップの成否に関わらず実行
  run: |
    set +e
    node scripts/generate-test-report.mjs \
      .artifacts/unit-report.json \
      site/reports/unit-test-report.html || true
    true                                 # ← 常に成功扱い
```

#### Pattern 3: Pages デプロイ強制実行
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

---

## レポート発行フロー

### 失敗状態でのレポート生成

1. **テスト実行失敗** → JSON レポート生成（ただし失敗状態を記録）
2. **HTML 変換** → `scripts/generate-test-report.mjs` で失敗状態を含む HTML へ変換
3. **集約** → `site/reports/` へ全レポートをコピー
4. **ナビゲーション生成** → 存在するレポートのリンクのみ表示
5. **Pages アップロード・デプロイ** → 失敗状態のレポートも含めて発行

### ブラウザでの確認

```
https://viviparidae.github.io/biotope-matrix/reports/
├─ 📊 カバレッジレポート (HTML)
├─ 🧪 ユニットテストレポート ← 失敗状態も表示
├─ 🔗 統合テストレポート ← 失敗状態も表示
└─ ⚡ フィットネス・アーキテクチャテストレポート ← 失敗状態も表示
```

---

## 品質ゲートとの共存

### SKILL.md との関係

| ステージ | 品質ゲート | Pages 発行 | 説明 |
|---------|----------|----------|------|
| Commit | ✅ 必須 | ❌ なし | 型チェック・単体テスト失敗で PR に戻す |
| Acceptance | ✅ 必須 | ❌ なし | BDD/受入テスト失敗で修復優先 |
| Capacity/Fitness | ⚠️ 参照 | ✅ 発行 | 失敗状態でも Pages へ公開（ダッシュボード可視化） |
| Deployment | ✅ Pages のみ | ✅ 発行 | 失敗状態のレポートも含めて発行 |

**要点**:
- **品質ゲート** (SKILL.md): 本番マージ前の守りは変わらない
- **Pages 公開** (新設定): 失敗状態も可視化し、ブラウザで確認可能に

---

## 新規ドキュメント

### `docs/PAGES_DEPLOYMENT_POLICY.md`
- Pages デプロイ運用方針を詳細記載
- 各ワークフローの発行条件
- トラブルシューティング

### `scripts/test-pages-deployment-resilience.sh`
- ローカル環境でワークフロー設定を検証
- `if: always()` の適切な配置を確認

---

## ローカル検証方法

```bash
# 1. 検証スクリプト実行
bash scripts/test-pages-deployment-resilience.sh

# 2. 指定ブランチへ push
git push origin main

# 3. GitHub Actions ログを監視
# https://github.com/viviparidae/biotope-matrix/actions

# 4. ワークフロー完了後、Pages を確認
# https://viviparidae.github.io/biotope-matrix/reports/
```

---

## よくある質問 (FAQ)

### Q: テスト失敗時に Pages が発行されるのは本当ですか？
**A**: はい。`if: always()` と `set +e` により、テスト失敗時も最後の `Deploy to GitHub Pages` ステップまで到達します。

### Q: 品質ゲートが機能しなくなるのでは？
**A**: いいえ。`commit-stage` と `acceptance-stage` は依然として失敗時に後段を実行しません。Pages 発行はあくまでダッシュボード用です。

### Q: PR でも Pages が発行されますか？
**A**: いいえ。`cd-pipeline.yml` の `deploy-stage` は `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` で制限されています。

### Q: 失敗レポートが空の場合は？
**A**: `|| true` と `continue-on-error: true` により、ファイル不在でもワークフローは続行します。ナビゲーションページは存在するレポートのみ表示します。

---

## 関連リンク

- 📖 [Pages 運用方針](./PAGES_DEPLOYMENT_POLICY.md)
- 🔧 [SKILL.md - 開発スキル規約](../.github/SKILL.md)
- ✅ [テスト戦略](./test-strategy.md)
- 📋 [要件仕様](./requirements.md)
