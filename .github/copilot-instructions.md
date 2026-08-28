# GitHub Copilot System Instructions (`pythagora-bios`)

当プロジェクトでコード生成・修正・テスト作成・リファクタリングを行う際は、必ずリポジトリ内の設計ドキュメントおよび規約ファイルを参照し、矛盾がないか検証した上で出力を行ってください。

## 必須参照ドキュメント

コードを出力する前に、必ず以下のドキュメントをチェックして制約を遵守してください。

1. **コーディング規約 & 設計ガイド**: `docs/coding-standards.md`
	* 『進化的アーキテクチャ』原則（適合度関数による自動保護、パフォーマンス・メモリのガードレール、増分変更）
	* Martin Fowler の『リファクタリング』『Bliki』原則（Code Smells 排除、Composed Method、CQS、YAGNI、ユビキタス言語）
	* 『単体テストの考え方/使い方』に完全準拠したテスト設計（自然言語命名、振る舞い検証、古典派スタイル、AAAパターン）
	* 『Clean Code』『Clean Architecture』の設計原則（関心の分離、DIP、意味のある命名）
	* パフォーマンス指針（60fps ループ内の GC 回避、TypedArray 活用）
2. **アーキテクチャ設計書**: `docs/architecture.md` (または指定の設計ドキュメント)
	* ECS (Entity Component System) パターンの厳守
	* 空間グリッド分割、描画基盤 (Canvas API)、音響基盤 (Web Audio API) の制約
3. **アーキテクチャ決定記録 (ADR)**: `docs/adr/` 以下の全記録
	* 各 ADR で採択された技術選定・制約ルールとのアライメント（矛盾する代替提案の禁止）
4. **要求仕様書**: `docs/requirements.md`
5. **テスト戦略**: `docs/test-strategy.md`

## 応答時の行動規則

* **矛盾検知**: ユーザの指示が `docs/` 以下のドキュメントや ADR と矛盾している場合は、コードを出力する前に「どのドキュメントのどの設計と矛盾するか」を指摘し、確認をとること。
* **コード・テスト生成規約**: コードやテストの生成・修正時には、必ず `docs/coding-standards.md` の全原則（進化的アーキテクチャ/適合度関数/Martin Fowler/Clean Code/Clean Architecture/単体テストの考え方）を適用し、可読性・保守性・リファクタリング耐性の高いコードを出力すること。