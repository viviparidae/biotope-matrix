# biotope-matrix

生態系シミュレーション `pythagora-bios` の要求仕様とアーキテクチャ設計を管理するリポジトリです。

## ドキュメント

| 文書 | 内容 |
| --- | --- |
| [要求仕様書](docs/requirements.md) | ユーザーストーリー、Gherkin形式の機能要求、品質シナリオ、受け入れ方針 |
| [アーキテクチャ設計書](docs/architecture.md) | C4 Model、Mermaid図、ECS設計、Kubernetes構成、ADR |

## 実行方法

Node.js と npm を用意したうえで、リポジトリのルートで依存関係をインストールします。

```bash
npm install
```

開発サーバーを起動します。

```bash
npm run dev
```

表示された URL（通常は `http://localhost:5173`）をブラウザで開いてください。

本番用ビルドを作成する場合は、次を実行します。TypeScript の型チェック後、`dist/` にビルド成果物が生成されます。

```bash
npm run build
```

## プロダクト概要

観察者が、数ピクセルの生物・地形・災害・環境音が自律的に連鎖する生態系を、操作なしで眺めて楽しむシミュレーションです。シミュレーションの正本はWorker Pod、描画と音声再生はブラウザが担当します。

## 要求と設計の対応

| 要求 | 主な設計要素 |
| --- | --- |
| F-01〜F-09 | Worker内のECS Rule Systems、Canvas、Web Audio API |
| F-10 | Kubernetes Operator、CRD/ConfigMap、HPA/KEDA |
| NFR-01〜NFR-04 | 固定tick、SoA、差分スナップショット、メトリクス |
| NFR-05〜NFR-07 | Leader Worker、Shard、チェックポイント、Pod復旧 |
| NFR-08〜NFR-11 | Transport Adapter、音声フォールバック、視覚的な状態表現 |
| NFR-12 | Command Buffer、イベント連番、状態ハッシュ |

## 文書の読み方

1. [要求仕様書](docs/requirements.md)で受け入れ条件と品質目標を確認する。
2. [アーキテクチャ設計書](docs/architecture.md)で要求を実現する境界とデータフローを確認する。
3. 実装時は要求ID（`F-*` / `NFR-*`）とADR番号をテストや変更に紐付ける。

## ディレクトリ構成

- `apps/frontend`: Canvas、UI、Web Audio API を担当するブラウザアプリケーション
- `apps/worker`: シミュレーション Worker の実行入口
- `packages/ecs`: Entity、Component、Query、System の共有実装
- `packages/shared-types`: API、ECS、イベントの共有型
- `packages/config`: ESLint と TypeScript の共有設定
- `infra`: Kubernetes、KEDA、CRD のマニフェスト
- `tests`: unit、integration、performance テスト

シミュレーションの正本は Worker 側へ集約し、フロントエンドは描画と音響を担当します。現時点では仕様・設計段階のため、未指定の災害閾値、湿度閾値、分解者密度などは設定値として後続実装で合意します。
