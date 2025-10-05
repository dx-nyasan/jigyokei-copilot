/**
 * @fileoverview プロジェクトJSONファイル群を安全かつ効率的に更新・資産化するための公式エンジン
 * @version 7.0 (ID管理方式の変更、バグ修正)
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

// 【更新履歴1】〜【更新履歴18】は省略

/**
 * 【更新履歴19】最終開発フロー及びアカウント認証ルールの公式化
 */
const updateConfig_FinalizeConstitution = {
  updateName: "Finalize_Development_Constitution_including_Workflow_and_Auth_Rules",
  updates: {
    "意思決定ログ.JSON": function(currentLog) {
      const now = new Date();
      const timestamp = now.toISOString();
      const logId = `LOG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-5)}`;
      
      const newLogEntry = {
        "logId": logId,
        "timestamp": timestamp,
        "subject": "最終開発フロー及びアカウント認証ルールの公式化",
        "context_why": "CI/CDパイプライン構築後、その運用方法と人間-AIの役割分担を明確にする必要があった。また、開発者が複数のGoogleアカウント（組織用、個人用、プロジェクト用）を使い分けているため、認証を伴う操作での混乱やミスを防ぐための明確なルールが求められた。",
        "decision_what": "1. 【開発フローの採択】開発の最終的な意思決定（コミットメッセージ確定）と実行権限（git push）は常に人間が保持し、AIはその前段階の準備（コード生成、コマンド準備）までを担う協業モデルを採択する。\n2. 【認証ルールの制定】AIが開発者に認証を伴う操作（例: GitHubへのpush, Google Cloudへのログイン）を依頼する際は、使用すべきアカウント（admin@dx-nyasan.com, hirobrandneo@gmail.com, yochiyochi.dx.channel@gmail.com のいずれか）を必ず明示することを公式ルールとして制定する。",
        "impact_how": "AIの効率性と人間の最終統制を両立させる安全な開発体制が確立された。加えて、アカウントの使い分けが明確になることで、認証エラーや権限設定のミスが撲滅され、開発者はより安心して本質的な開発作業に集中できるようになった。これはプロジェクトの『憲法』となる。"
      };
      if (!currentLog.decisionLog) currentLog.decisionLog = { logs: [] };
      currentLog.decisionLog.logs.push(newLogEntry);
      currentLog.decisionLog.最終更新日 = timestamp;
      return currentLog;
    }
  }
};

function _runUpdate_FinalizeConstitution() {
  applyProjectUpdate(updateConfig_FinalizeConstitution);
}

/**
 * 【更新履歴20】システム構成図とアカウント責務の定義
 */
const updateConfig_RecordSystemArchitecture = {
  updateName: "Record_System_Architecture_and_Account_Responsibilities",
  updates: {
    "意思決定ログ.JSON": function(currentLog) {
      const now = new Date();
      const timestamp = now.toISOString();
      const logId = `LOG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-5)}`;
      
      const newLogEntry = {
        "logId": logId,
        "timestamp": timestamp,
        "subject": "【正式記録】システム構成図とアカウント責務の定義",
        "context_why": "開発体制が固まった現時点において、各サービス（IDX, GitHub, GAS, GDrive）の役割と、それらを操作するGoogleアカウント（admin@dx-nyasan.com, yochiyochi.dx.channel@gmail.com）の権限・責務を明確に文書化し、プロジェクトの公式記録とするため。",
        "decision_what": "以下の4つのサービス構成と、それぞれに関わるアカウントの役割・権限を定義した文書を、正式な意思決定として記録する。\n\n1. **Firebase Studio (IDX):** 開発と思考の場。アカウント：admin@dx-nyasan.com（IDEアクセス）、yochiyochi.dx.channel@gmail.com（git push認証）。\n2. **GitHub:** コードの保管庫とCI/CDの起点。アカウント：yochiyochi.dx.channel@gmail.com（Owner権限）。\n3. **Google Apps Script (GAS):** 本番実行環境。アカウント：yochiyochi.dx.channel@gmail.com（Owner権限）。\n4. **Google Drive:** 永続データストレージ。アカウント：yochiyochi.dx.channel@gmail.com（Owner権限）。",
        "impact_how": "これにより、開発者（人間・AI双方）が役割分担を正確に理解し、権限エラーやセキュリティリスクを低減できる。この記録は、将来のプロジェクト参加者への引き継ぎ資料としても機能する。"
      };
      
      if (!currentLog.decisionLog) currentLog.decisionLog = { logs: [] };
      currentLog.decisionLog.logs.push(newLogEntry);
      currentLog.decisionLog.最終更新日 = timestamp;
      return currentLog;
    }
  }
};

function _runUpdate_RecordSystemArchitecture() {
  applyProjectUpdate(updateConfig_RecordSystemArchitecture);
}

// ---------------------------------------------------------------------------------
// ▼▼▼【今回実行する唯一の関数】▼▼▼
// ---------------------------------------------------------------------------------

// 新しい更新はここに追記してください
