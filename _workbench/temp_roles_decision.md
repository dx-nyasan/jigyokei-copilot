# 一時記録: アカウントの役割定義

**【注意】このファイルは、GitHub Actions設定完了後にプロジェクトの最上位ルールに本内容を記録したのち、削除されます。**

## 役割定義

1.  **`admin@dx-nyasan.com` (Google組織アカウント)**
    *   **役割**: Google Cloud Platform (GCP) の管理者
    *   **担当範囲**:
        *   Cloud Run, FirestoreなどのGCPサービスの設定と管理。
        *   課金情報の集約。
        *   GitHub Actions連携に必要なIAMやWorkload Identityの設定。

2.  **`yochiyochi.dx.channel@gmail.com` (Google個人アカウント - プロジェクト用)**
    *   **役割**: 開発の実行者 & App Scriptの所有者
    *   **担当範囲**:
        *   このアカウントに紐づくGitHubアカウントを使用して、`git push` を行う。
        *   Google Drive上でGoogle Apps Script (GAS) プロジェクトを所有する。

3.  **`hirobrandneo@gmail.com` (Google個人アカウント - プライベート用)**
    *   **役割**: 今回の開発ワークフローでは使用しない。
