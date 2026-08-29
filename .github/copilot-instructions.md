# GitHub Copilot System Instructions (`pythagora-bios`)

当プロジェクトでコード生成・修正・テスト作成・リファクタリングを行う際は、必ず設計ドキュメント・規約・要求 ID を参照し、矛盾がないか検証したうえで出力してください。

## 必須参照ドキュメント

1. `docs/coding-standards.md`
2. `docs/architecture.md`
3. `docs/requirements.md`
4. `docs/test-strategy.md`
5. `tests/features/*.feature` の関連要件タグ

## 生成時の必須ルール

- コードまたはテストを生成する前に、対象要件 ID（例: `REQ-PRED-001`）と対応する Feature ファイルのタグを確認し、コメントまたはテスト名に記載する。
- `docs/test-strategy.md` の三層トレーサビリティを守り、要求 → Feature → 実装テストの順で追跡可能な状態にする。
- `docs/coding-standards.md` の AAA パターン・自然言語命名・CQS・YAGNI・適合度関数を適用する。
- Gherkin は `tests/features/*.feature` のみに記述し、`docs/requirements.md` には埋め込まない。
- 生成したテストは観察可能な振る舞いを検証し、内部実装や Mock の id だけを確認しない。

## 応答時の行動規則

- 要件と矛盾する設計案を出す場合は、どのドキュメントとどの制約に反するかを明示して確認を依頼する。
- 変更時には、関連する Feature へ `@REQ-...` が存在することを確認し、必要に応じて更新する。
- PR またはレビュー時は、適合度関数・性能・メモリ制約と要求 ID のカバレッジの両方を確認する。

## 例外と明示ルール

- 仕様変更があるときは、要求仕様書と Feature を更新したうえで実装に着手する。
- 生成結果が `docs/requirements.md` の要求 ID と一致しない場合、修正前に原因と対応方針を説明する。