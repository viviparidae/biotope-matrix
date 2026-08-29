# アジャイル型要求仕様書

## 1. スコープと目的

観察者は、ブラウザ上で自律的に変化する生態系を確認し、個体の行動・捕食・環境変化・分解といった振る舞いを視覚的に追跡できることを期待する。要求は、検証可能な要件 ID で管理し、BDD シナリオは Feature ファイルへ集約して、実装テストとトレーサビリティを自動的に結びつける。

## 2. 要求一覧（要求 ID と実装対応）

| 要件 ID | 機能概要 | 主要評価基準 | 対応 Feature |
| --- | --- | --- | --- |
| REQ-GEN-001 | 草の生成・枯死と成長制御 | 草の数が上限未満なら増殖し、寿命超過で枯死する | `tests/features/predation.feature` |
| REQ-HERB-001 | 草食個体の採餌と分裂 | 近距離の草へ移動し、エネルギー閾値超過で分裂する | `tests/features/predation.feature` |
| REQ-PRED-001 | 条件付き捕食 | サイズ比率・攻撃・防御・形態で成功率を判定する | `tests/features/predation.feature` |
| REQ-CANN-001 | 飢餓時の同種捕食 | 飢餓状態の肉食個体は小型同種も候補にする | `tests/features/predation.feature` |
| REQ-MORPH-001 | 形態・サイズの遺伝変異 | `size` と `shape` を継承し、変異でトレードオフを発生させる | `tests/features/predation.feature` |
| REQ-FLOCK-001 | 空間グリッドによる群れ行動 | 分離・整列・結合ベクトルを合成し、$O(N)$ 近傍探索で踏襲する | `tests/features/predation.feature` |
| REQ-ARCH-001 | 適合度関数と CI 保護 | 1 フレーム内の計算時間と依存境界を自動検査する | `tests/features/predation.feature` |
| REQ-ARCH-002 | メモリ再利用とシリアライズ境界 | `ArrayBuffer` と Free List / Recycle Pool で再割り当てを抑える | `tests/features/predation.feature` |

## 3. 非機能要求

| ID | 品質特性 | 刺激 | 応答・測定基準 |
| --- | --- | --- | --- |
| NFR-01 | 性能 | 個体数と草の増加 | 平均 30 FPS 以上、95 パーセンタイル 33ms 以下 |
| NFR-02 | 応答性 | 初期画面開く | 3 秒以内に描画開始 |
| NFR-03 | 安定性 | 24 時間実行 | メモリ増加なし、異常終了 0 |
| NFR-04 | 可観測性 | 主要イベント変化 | 構造化ログとデバッグオーバーレイで確認可能 |
| NFR-05 | スケーラビリティ | 個体数・CPU が閾値超過 | HPA/KEDA が自動調整開始 |
| NFR-06 | データ整合性 | 複数イベント同時発生 | 総数と資源収支が二重計上なし |
| NFR-07 | 保守性 | ルール・閾値更新 | 要件 ID と Feature をトレース可能 |
| NFR-08 | 実行互換性 | ブラウザまたは音声拒否 | 描画継続と可視化維持 |

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
