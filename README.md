# AI Co-Pilot ジギョケイ策定支援システム

## 1. このプロジェクトについて

このプロジェクトは、AIとの協業を通じて、商工会職員の伴走支援業務を革新するためのシステムです。AIが対話から経営リスクを抽出し、事業主の気づきを促すことで、より質の高いコンサルティングを実現することを目的としています。

システムの全体像や設計思想、開発ロードマップについては、プロジェクトの「憲法」である[`_reference_assets/マスタープラン.JSON`](_reference_assets/マスタープラン.JSON)を参照してください。

## 2. 【最重要】協業におけるアカウントの役割分担

本プロジェクトでは、開発の安全性と効率性を担保するため、操作主体に応じてアカウントを明確に分離しています。これは、**人間がCloud Workstations上のIDE/ブラウザで見る世界**と、**AIエージェント群がCloud Workstations上のIDE/CLI/APIで操作する世界**が異なることを認識し、それに起因する事故を防ぐための最重要原則です。

| ニックネーム | 用途 | 主体 | 視点 | 責任 |
| :--- | :--- | :--- | :--- | :--- |
| **【主】開発者・オーナーアカウント** | オーナーによる操作 | **人間** | Cloud Workstations上のIDE / ブラウザ(GUI) | 意思決定、成果物確認 |
| **【従】Cloud Workstationsサービスアカウント** | AIエージェント群による自動化、GCPリソース操作 | **機械** | Cloud Workstations上のIDE/CLI/API | コマンド実行、GCPリソースへのアクセス、デプロイ |

**Cloud Workstations上のIDE/CLI/API経由の操作は、すべて【従】Cloud Workstationsサービスアカウントとして実行されます。**
**ブラウザで成果物を確認する際は、必ず【主】アカウントでログインしてください。**

アカウントの詳細な定義については、[`_reference_assets/アカウントリスト.JSON`](_reference_assets/アカウントリスト.JSON)を参照してください。

### 2.1.【確定】権限モデルと開発ワークフロー

上記役割分担に基づき、2025年10月24日時点での公式な権限モデルと開発フローを以下のように確定する。

*   **オーナー（人間）:** Google Apps Scriptプロジェクトの「オーナー」権限を保持し、Cloud Workstations上のIDEを通じて開発を主導する。
*   **自動化パイプライン（GitHub Actions）:** Google Apps Scriptプロジェクトの「編集者」権限を保持し、GitへのPushをトリガーとした自動デプロイを担う。
*   **Cloud Workstationsサービスアカウント:** Cloud WorkstationsのVMに割り当てられ、GCPリソース（Cloud Runへのデプロイ、Firestoreへのアクセスなど）へのアクセスを担う。GASプロジェクトへの直接的な権限は持たず、GitHub Actionsを通じてデプロイされる。
*   **AIエージェント群（司令塔AI / 専門AI）:** Cloud Workstations上のIDE/CLI/APIを通じてオーナーの開発を補助する。Google Apps Scriptプロジェクトへの**いかなる権限も保持しない。**

これにより、以下のゴールデンルール（黄金の鉄則）が確立される。

1.  **IDEが正:** 全てのコードは、Cloud Workstations上のIDE（ローカル環境）を唯一の「正」とする。
2.  **GAS直接編集の禁止:** Google Apps Scriptエディタ上での直接的なコード編集は、理由の如何を問わず、固く禁止する。
3.  **Push to Deploy:** Cloud Workstations上のIDEでのコード変更は、必ず `git push` を通じて自動化パイプラインに委ねられ、本番環境へ反映されなければならない。

## 3. 行動規範

AI Co-Pilotとの円滑な協業のため、以下の行動規範を定めています。開発に参加する際は、必ずご一読ください。

*   [`行動規範_Co-Pilot.md`](行動規範_Co-Pilot.md)

## 4. 開発の記録

過去の主要な意思決定や、苦闘の記録は以下のログにまとめられています。

*   [`_reference_assets/意思決定ログ.JSON`](_reference_assets/意思決定ログ.JSON)
