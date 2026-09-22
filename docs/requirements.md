# アジャイル型要求仕様書

## 1. スコープと目的

観察者は、ブラウザ上で自律的に変化する生態系を確認し、個体の行動・捕食・環境変化・分解といった振る舞いを視覚的に追跡できることを期待する。要求は、検証可能な要件 ID で管理し、BDD シナリオは Feature ファイルへ集約して、実装テストとトレーサビリティを自動的に結びつける。

## 2. 要求一覧（要求 ID と実装対応）

| 要件 ID | 旧仕様 ID | 機能概要 | 主要評価基準 | 主な検証先 |
| --- | --- | --- | --- | --- |
| REQ-GEN-001 | F-01 | 草の生成・枯死と成長制御 | 草の数が上限未満なら増殖し、寿命超過で枯死する | `tests/acceptance/requirements.acceptance.test.ts` |
| REQ-HERB-001 | F-02 | 草食個体の採餌と分裂 | 近距離の草へ移動し、エネルギー閾値超過で分裂する | `tests/acceptance/requirements.acceptance.test.ts` |
| REQ-PRED-001 | F-03 | 条件付き捕食 | サイズ比率・攻撃・防御・形態で成功率を判定する | `tests/features/predation.feature`, `tests/unit/predation.test.ts` |
| REQ-CANN-001 | F-03 | 飢餓時の同種捕食 | 飢餓状態の肉食個体は小型同種も候補にする | `tests/features/predation.feature`, `tests/unit/predation.test.ts` |
| REQ-MORPH-001 | F-04 | 形態・サイズの遺伝変異 | `size` と `shape` を継承し、変異でトレードオフを発生させる | `tests/features/predation.feature`, `tests/unit/core.test.ts` |
| REQ-FLOCK-001 | F-05 | 空間グリッドによる群れ行動 | 分離・整列・結合ベクトルを合成し、$O(N)$ 近傍探索で踏襲する | `tests/features/predation.feature`, `tests/unit/core.test.ts` |
| REQ-ARCH-001 | - | 適合度関数: 計算予算保護 | 1 フレーム内の計算時間（16.6ms以内）を自動検査する | `src/architecture.fitness.test.ts` |
| REQ-ARCH-002 | - | 適合度関数: 依存境界保護 | コアECSロジックがブラウザ専用APIへ直接依存しないことを検査する | `src/architecture.fitness.test.ts` |
| REQ-ARCH-003 | - | 適合度関数: バイナリ境界検証 | Entity状態が `ArrayBuffer` 境界を完全に往復・復元できることを検査する | `src/architecture.fitness.test.ts` |
| REQ-SUST-001 | - | 長期生態系持続性監視 | 10,000 ステップで草食・肉食の絶滅ゼロを継続監視し、個体数振幅が安全範囲内である | `src/tests/syntheticTransaction.test.ts` |
| REQ-SUST-002 | F-08 | 災害復旧と環境緩和 | 80% 個体喪失イベント後に再生と安定回復が起こり、避難所と負のフィードバックが維持される | `src/tests/syntheticTransaction.test.ts` |

## 3. BRIEF 原則と UI 要件

### 3.1 BRIEF 原則

UI と仕様の記述は、実装の詳細まで踏み込まない。要求は観察可能な振る舞いに限定し、レイアウトや CSS、DOM の細部は設計書へ委ねる。

- Behavior: 観察者にとって意味のある変化だけを要求する。
- Requirement: 画面上で確認できる状態と操作の必要性を明示する。
- Interface: 入出力はユーザーが知る必要のある境界だけで定義する。
- Environment: 現在の環境状態を画面から確認できるようにする。
- Feedback: 変化の結果と状態遷移を可視化する。

### 3.2 UI に関する要求

| 要件 ID | 機能概要 | 主要評価基準 | 主な検証先 |
| --- | --- | --- | --- |
| REQ-UI-001 | 環境状態の可視化 | 画面上で明るさ・気温・生態系の健全性を確認できる | `apps/frontend/src/main.ts`, `apps/frontend/index.html` |
| REQ-UI-002 | 観測可能な制御 | 追加操作と設定変更がシミュレーションへ反映される | `tests/unit/controls-ui.test.ts` |
| REQ-UI-003 | 要求の範囲を超えない UI 仕様 | UI の細部仕様を過剰に定義せず、要求に必要な情報のみを扱う | `docs/architecture.md` |

> UI の最終的な見た目や装飾は実装に委ねるが、利用者に必要な状態と操作は明示し、環境状態の可視化は必須とする。

## 4. 非機能要求

| ID | 品質特性 | 刺激 | 応答・測定基準 | 主な対応・検証 |
| --- | --- | --- | --- | --- |
| NFR-01 | 性能 | 個体数と草の増加 | 平均 30 FPS 以上、95 パーセンタイル 33ms 以下 | 固定tick・SoA・空間グリッド |
| NFR-02 | 応答性 | 初期画面開く | 3 秒以内に描画開始 | Vite最適化・初期スナップショット購読 |
| NFR-03 | 安定性 | 24 時間実行 | メモリ増加なし、異常終了 0 | FreeList・TypedArray・再利用バッファ |
| NFR-04 | 可観測性 | 主要イベント変化 | 構造化ログとデバッグオーバーレイで確認可能 | `debug-overlay.ts`・コンソールログ |
| NFR-05 | スケーラビリティ | 個体数・CPU が閾値超過 | HPA/KEDA が自動調整開始 | `infra/keda/scaled-object.yaml` |
| NFR-06 | データ整合性 | 複数イベント同時発生 | 総数と資源収支が二重計上なし | Command Buffer一括コミット |
| NFR-07 | 保守性 | ルール・閾値更新 | 要件 ID と Feature / テストをトレース可能 | 3層トレーサビリティ |
| NFR-08 | 実行互換性 | ブラウザまたは音声拒否 | 描画継続と可視化維持 | Web Audio APIフォールバック |
| NFR-09 | 音声環境適応 | Web Audio 起動遅延・権限拒否 | ユーザー操作まで待機し、エラー時もシミュレーションを中断しない | `AudioManager`（`pointerdown` 起動） |
| NFR-10 | 視覚的表現力 | 生態系イベント・災害発生 | 生物のドットサイズ差、地形色、死骸残渣エフェクトで視覚的に判別 | `renderer.ts`（Composed Method描画） |
| NFR-11 | アクセシビリティ | 色覚多様性環境 | 単色に依存せず、形状（Shape）やサイズ差、模様で識別可能 | `BodyShape`・サイズ別描画 |
| NFR-12 | 決定論・再現性 | シミュレーション再接続・検証 | イベント連番、状態ハッシュ、固定シードで状態を確定 | イベント連番（`sequence`）、決定論的乱数注入 |

## 4. 受け入れ方針

- 要件 ID を基準に、Feature と実装テストを対応づける。
- Gherkin は `tests/features/*.feature` へ集約し、要求仕様書には Gherkin を置かない。
- 実装テストは AAA パターンに従い、要求 ID を `describe` / `it` の名称やコメントへ記録する。
- 仕様変更時は、Feature 検証の追跡表を更新してからコードを修正する。
- 未指定閾値は設定値として外部化し、環境設定・配布ファイルを経由して管理する。

## 5. トレーサビリティの運用ルール

1. 要件仕様: `docs/requirements.md` に要件 ID と概要を記載する。
2. BDD: `tests/features/*.feature` に `@REQ-...` タグ付きの Gherkin を記述する。
3. 実装テスト: `vitest` の `describe` / `it` 名へ `REQ-...` を埋め込み、各要求との対応を明示する。
4. CI: `.github/workflows/fitness.yml` で性能・境界・依存構造を自動チェックする。

> 例: `REQ-PRED-001` は `tests/features/predation.feature` の `@REQ-PRED-001` シナリオと、Vitest の `REQ-PRED-001` テストが対応する。
