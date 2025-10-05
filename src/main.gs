/**
 * @fileoverview プロジェクトJSONファイル群を安全かつ効率的に更新・資産化するための公式エンジン
 * @version 7.2 (アカウント責務とリソース紐付けの定義)
 * @description マスタープラン、プロジェクト状態、意思決定ログの3ファイルを対象に、Deltas（差分）とSnapshots（全体）のアーカイブ戦略を実装。フォルダIDをスクリプトプロパティで管理する方式に変更。
 */

// =========================================================================================
// ▼▼▼【設定用】GASプロジェクトのプロパティを管理する関数群 ▼▼▼
// =========================================================================================

/**
 * 💡 この関数を一度実行して、フォルダIDをスクリプトプロパティに保存します。
 * フォルダIDが変更になった場合も、この中の値を書き換えて再度実行してください。
 */
function setFolderIds() {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    'MASTER_FOLDER_ID': '1EPkPvug2qTwfjxuyIAFRLWoTtXk9jZrc', // マスターJSONファイル群が格納されているフォルダID
    'ARCHIVE_FOLDER_ID': '1463itoS4sLl-60gxCJgafOlPfdI1ZEnbw'  // アーカイブ（Deltas, Snapshots）を保存するフォルダID
  });
  Logger.log('✅ フォルダIDをスクリプトプロパティに保存しました。');
}

/**
 * スクリプトプロパティからフォルダIDを取得します。
 * @returns {{MASTER_FOLDER_ID: string, ARCHIVE_FOLDER_ID: string}} フォルダIDを含むオブジェクト
 */
function getFolderIds() {
  const properties = PropertiesService.getScriptProperties();
  const masterFolderId = properties.getProperty('MASTER_FOLDER_ID');
  const archiveFolderId = properties.getProperty('ARCHIVE_FOLDER_ID');
  
  if (!masterFolderId || !archiveFolderId) {
    const message = '❌ スクリプトプロパティにフォルダIDが設定されていません。「setFolderIds」関数を実行して、IDを設定してください。';
    Logger.log(message);
    throw new Error(message);
  }
  
  return {
    MASTER_FOLDER_ID: masterFolderId,
    ARCHIVE_FOLDER_ID: archiveFolderId
  };
}


// =========================================================================================
// ▼▼▼【処理の心臓部】個別の更新関数から呼び出される共通更新エンジン ▼▼▼
// =========================================================================================

function applyProjectUpdate(config) {
  try {
    const FOLDER_IDS = getFolderIds();
    const masterFolder = DriveApp.getFolderById(FOLDER_IDS.MASTER_FOLDER_ID);
    const archiveFolder = DriveApp.getFolderById(FOLDER_IDS.ARCHIVE_FOLDER_ID);

    let deltasFolder;
    const deltasFolders = archiveFolder.getFoldersByName("Deltas");
    deltasFolder = deltasFolders.hasNext() ? deltasFolders.next() : archiveFolder.createFolder("Deltas");

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filesToUpdate = Object.keys(config.updates);

    filesToUpdate.forEach(fileName => {
      const files = masterFolder.getFilesByName(fileName);
      const updateFunction = config.updates[fileName];
      let fileObject = {};
      let targetFile;

      if (files.hasNext()) {
        // --- ファイルが存在する場合：バックアップ、読み取り、更新 ---
        targetFile = files.next();
        
        // バックアップを作成
        const backupFileName = `${timestamp}_${fileName}`;
        targetFile.makeCopy(backupFileName, deltasFolder);
        
        // ファイル内容を読み取り
        const content = targetFile.getBlob().getDataAsString();
        if (content && fileName.toLowerCase().endsWith('.json')) {
          fileObject = JSON.parse(content);
        }
      }

      // --- 更新処理を実行 ---
      const updatedObject = updateFunction(fileObject);
      const newContent = JSON.stringify(updatedObject, null, 2);

      // --- 結果を書き込み ---
      if (targetFile) {
        // 既存のファイルを更新
        targetFile.setContent(newContent);
      } else {
        // ファイルが存在しなかった場合は新規作成
        masterFolder.createFile(fileName, newContent);
      }
    });

    Logger.log(`✅ すべての更新処理が正常に完了しました。`);

  } catch (error) {
    Logger.log(`❌ エラーが発生しました: ${error.toString()}`);
    Logger.log(`エラー詳細: ${error.stack}`);
  }
}

// =========================================================================================
// ▼▼▼【手動実行用】任意のタイミングで全体をバックアップする関数 ▼▼▼
// =========================================================================================

function createSnapshot() {
  try {
    const FOLDER_IDS = getFolderIds();
    const masterFolder = DriveApp.getFolderById(FOLDER_IDS.MASTER_FOLDER_ID);
    const archiveFolder = DriveApp.getFolderById(FOLDER_IDS.ARCHIVE_FOLDER_ID);

    let snapshotsFolder;
    const snapshotFolders = archiveFolder.getFoldersByName("Snapshots");
    snapshotsFolder = snapshotFolders.hasNext() ? snapshotFolders.next() : archiveFolder.createFolder("Snapshots");
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = `Snapshot_${timestamp}`;
    const newSnapshotFolder = snapshotsFolder.createFolder(snapshotName);
    
    const files = masterFolder.getFiles();
    while(files.hasNext()){
      const file = files.next();
      file.makeCopy(file.getName(), newSnapshotFolder);
    }
    
    Logger.log(`✅ '${snapshotName}' に現在の全マスターファイルのスナップショットを作成しました。`);
  } catch (error) {
    Logger.log(`❌ スナップショットの作成中にエラーが発生しました: ${error.toString()}`);
    Logger.log(`エラー詳細: ${error.stack}`);
  }
}

// =========================================================================================
// ▼▼▼【更新実行用】特定の更新内容を適用する関数群 ▼▼▼
// =========================================================================================

/*
 * 運用ルール：
 * 1. 新しい更新を追加する際は、このセクションの一番下に新しい`updateConfig_...`と`runUpdate_...`のセットを追記します。
 * 2. 追記したら、今まで有効だった（アンダースコア "_" が付いていなかった）古い方の runUpdate 関数の名前の先頭に "_" を付けてアーカイブします。
 * 3. これにより、実行メニューには常に新しく追加した、まだ実行していない関数が１つだけ表示され、誤操作を防ぎます。
 */

// ---------------------------------------------------------------------------------
// ▼▼▼ アーカイブ済みの更新履歴 ▼▼▼
// ---------------------------------------------------------------------------------

function _runUpdate_FinalizeAccountRoles() {
  applyProjectUpdate(updateConfig_FinalizeAccountRoles);
}

// ---------------------------------------------------------------------------------
// ▼▼▼【今回実行する唯一の関数】▼▼▼
// ---------------------------------------------------------------------------------

/**
 * 💡 この関数を実行してください
 * 【更新履歴22】アカウント責務とリソース紐付けの最終定義
 */
const updateConfig_FinalizeRolesAndConnections = {
  updateName: "Finalize_Account_Roles_and_Resource_Connections",
  updates: {
    "意思決定ログ.JSON": function(currentLog) {
      const now = new Date();
      const timestamp = now.toISOString();
      const logId = `LOG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-5)}`;
      
      const newLogEntry = {
        "logId": logId,
        "timestamp": timestamp,
        "subject": "【公式憲法】アカウント責務とリソース紐付けの最終定義",
        "context_why": "プロジェクトのセキュリティと運用効率を恒久的に担保するため、各サービス（GitHub, GAS）とそれを操作するGoogleアカウントの役割分担、権限、そして具体的なリソースの紐付けを明確に定義し、プロジェクトの憲法として記録する必要がある。",
        "decision_what": "以下の通り、アカウントごとの役割、権限、および管理リソースを正式に定める。\n\n### 1. `admin@dx-nyasan.com` (開発者アカウント)\n- **役割:** 開発者本人（人間）。プロジェクト全体の意思決定者であり、最終的な実行責任を負う。\n- **権限:**\n  - **Firebase Studio (IDX):** IDEへのアクセスと操作。\n  - **Google Cloud:** プロジェクト管理全般。\n  - **GitHub:** Webコンソールからのリポジトリ管理。コミットとプッシュの最終承認。\n  - **Google Drive:** Webコンソールからのファイル閲覧・管理。\n\n### 2. `yochiyochi.dx.channel@gmail.com` (自動化・サービスアカウント)\n- **役割:** 自動化プロセスおよびサービス連携の実行主体。AI Co-Pilotが操作する前提のアカウント。\n- **権限・管理リソース:**\n  - **GitHubリポジトリ:**\n    - **リポジトリ名:** `jigyokei-copilot`\n    - **紐づくアカウント:** `yochiyochi.dx.channel@gmail.com`\n    - **権限/役割:** **Owner**。IDX環境からの`git push`認証にこのアカウントのPersonal Access Tokenを使用する。\n  - **Google Apps Script (GAS)プロジェクト:**\n    - **プロジェクト:** 本番実行環境であるGoogle Apps Scriptプロジェクト\n    - **紐づくアカウント:** `yochiyochi.dx.channel@gmail.com`\n    - **権限/役割:** **オーナー**。スクリプトの実行、トリガー管理、およびGitHub ActionsからのCI/CDによるデプロイの受け入れを行う。\n  - **Google Drive:**\n    - **対象:** マスターデータおよびアーカイブが格納されている全フォルダ\n    - **紐づくアカウント:** `yochiyochi.dx.channel@gmail.com`\n    - **権限/役割:** **オーナー**。GASからの全てのファイル読み書きを実行する。\n\n### 3. `hirobrandneo@gmail.com` (個人・レガシーアカウント)\n- **役割:** プロジェクトの公式な開発プロセス外のレガシーアカウント。Google AI Pro (旧Duet AI) を契約しており、Firebase Studioでの本格開発を開始する前の情報資産（各種ドキュメント、初期のコードスニペット等）を管理していた。\n- **権限:** 現在の公式な開発・運用プロセスにおける、いかなる認証・認可にも**関与しない**。今後は新規の情報を追加せず、過去資産の参照用としてのみ保持する。",
        "impact_how": "この定義により、誰が（どのアカウントが）何をする（できる）のか、そしてどのリソースに紐づくのかが一目瞭然となり、権限エラーの防止、セキュリティリスクの低減、円滑な開発プロセスの維持が可能となる。これは、AIと人間が協業する上での重要なガバナンス基盤となる。"
      };
      
      if (!currentLog.decisionLog) currentLog.decisionLog = { logs: [] };
      currentLog.decisionLog.logs.push(newLogEntry);
      currentLog.decisionLog.最終更新日 = timestamp;
      return currentLog;
    }
  }
};

/**
 * 💡 この関数を実行してください
 */
function runUpdate_FinalizeRolesAndConnections() {
  applyProjectUpdate(updateConfig_FinalizeRolesAndConnections);
}

// CI/CD pipeline test