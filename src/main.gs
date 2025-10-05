/**
 * @fileoverview プロジェクトJSONファイル群を安全かつ効率的に更新・資産化するための公式エンジン
 * @version 5.0 (バックエンド構築フェーズ完了)
 * @description マスタープラン、プロジェクト状態、意思決定ログの3ファイルを対象に、Deltas（差分）とSnapshots（全体）のアーカイブ戦略を実装。
 */

// =========================================================================================
// グローバル設定（ご自身の環境に合わせて変更してください）
// =========================================================================================

// ▼▼▼【要設定】▼▼▼
const MASTER_FOLDER_ID = "1VK3Y3uFwgxdoVTiDSkl5SS6lGnla90P4"; // マスターJSONファイル群が格納されているフォルダID
const ARCHIVE_FOLDER_ID = "1sVHBxUqJj7fN9uVgw8AGo1hhXlhTWiQw"; // アーカイブ（Deltas, Snapshots）を保存するフォルダID
// ▲▲▲▲▲▲▲▲▲▲▲▲

// =========================================================================================
// ▼▼▼【処理の心臓部】個別の更新関数から呼び出される共通更新エンジン ▼▼▼
// =========================================================================================

/**
 * 設定オブジェクトに基づき、複数のJSONファイルを安全に更新するメイン関数
 * （差分バックアップ作成と本体更新を一体で実行）
 * @param {object} config - 更新内容を定義した設定オブジェクト
 */
function applyProjectUpdate(config) {
  const masterFolder = DriveApp.getFolderById(MASTER_FOLDER_ID);
  const archiveFolder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
  
  let deltasFolder;
  const deltasFolders = archiveFolder.getFoldersByName("Deltas");
  deltasFolder = deltasFolders.hasNext() ? deltasFolders.next() : archiveFolder.createFolder("Deltas");

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filesToUpdate = Object.keys(config.updates);

  try {
    // 1. 変更対象のファイルをDeltasフォルダにバックアップ
    filesToUpdate.forEach(fileName => {
      const files = masterFolder.getFilesByName(fileName);
      if (files.hasNext()) {
        const file = files.next();
        const backupFileName = `${timestamp}_${fileName}`;
        file.makeCopy(backupFileName, deltasFolder);
        Logger.log(`'${fileName}' の変更前バージョンを '${backupFileName}' としてDeltasに保存しました。`);
      }
    });

    // 2. 全てのファイルを更新
    filesToUpdate.forEach(fileName => {
      const targetFiles = masterFolder.getFilesByName(fileName);
      let fileObject = {}; 

      if (targetFiles.hasNext()) {
        const file = targetFiles.next();
        const content = file.getBlob().getDataAsString();
        if (content) {
          // JSONファイル以外はそのまま文字列として扱う
          if (fileName.toLowerCase().endsWith('.json')) {
            fileObject = JSON.parse(content);
          } else {
            fileObject = content;
          }
        }
      }

      const updatedObject = config.updates[fileName](fileObject);
      
      let newContent;
      if (typeof updatedObject === 'string') {
        newContent = updatedObject;
      } else {
        newContent = JSON.stringify(updatedObject, null, 2);
      }

      const filesForUpdate = masterFolder.getFilesByName(fileName);
      if (filesForUpdate.hasNext()) {
          filesForUpdate.next().setContent(newContent);
          Logger.log(`'${fileName}' を正常に更新しました。`);
      } else {
          masterFolder.createFile(fileName, newContent);
          Logger.log(`'${fileName}' を新規作成しました。`);
      }
    });

    Logger.log(`✅ すべての更新処理が正常に完了しました。`);

  } catch (error) {
    Logger.log(`❌ エラーが発生しました: ${error.toString()}`);
    Logger.log(`エラー詳細: ${error.stack}`);
    Logger.log(`更新処理は中断されました。Deltasフォルダ内のバックアップを確認してください。`);
  }
}

// =========================================================================================
// ▼▼▼【手動実行用】任意のタイミングで全体をバックアップする関数 ▼▼▼
// =========================================================================================

/**
 * 現在のすべてのマスターファイルをSnapshotsフォルダに保存する関数
 */
function createSnapshot() {
  const masterFolder = DriveApp.getFolderById(MASTER_FOLDER_ID);
  const archiveFolder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);

  let snapshotsFolder;
  const snapshotFolders = archiveFolder.getFoldersByName("Snapshots");
  snapshotsFolder = snapshotFolders.hasNext() ? snapshotFolders.next() : archiveFolder.createFolder("Snapshots");
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotName = `Snapshot_${timestamp}`;
  const newSnapshotFolder = snapshotsFolder.createFolder(snapshotName);
  
  Logger.log(`スナップショットフォルダ '${snapshotName}' を作成しました。`);

  const files = masterFolder.getFiles();
  while(files.hasNext()){
    const file = files.next();
    file.makeCopy(file.getName(), newSnapshotFolder);
  }
  
  Logger.log(`✅ '${snapshotName}' に現在の全マスターファイルのスナップショットを作成しました。`);
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
// （実行メニューには表示されません）
// ---------------------------------------------------------------------------------

// 【更新履歴1】〜【更新履歴14】は省略

// 【更新履歴15】（アーカイブ済み）
const updateConfig_CreateDevLogPhase2 = { /* ... 内容は省略 ... */ };
function _runUpdate_CreateDevLogPhase2() {
  applyProjectUpdate(updateConfig_CreateDevLogPhase2);
}


// ---------------------------------------------------------------------------------
// ▼▼▼【今回実行する唯一の関数】▼▼▼
// （新しい更新を追加したら、この関数の名前を `_runUpdate...` に変更してください）
// ---------------------------------------------------------------------------------

/**
 * 💡 この関数を実行してください
 * 【更新履歴16】バックエンド構築フェーズの完了と次フェーズへの移行
 */
const updateConfig_FinalizeBackendPhase = {
  updateName: "Finalize_Backend_Development_Phase_And_Transition_To_Next",
  updates: {
    "マスタープラン.JSON": function(currentPlan) {
      const BACKEND_URL = "https://jigyokei-copilot-backend-310523847405.asia-northeast2.run.app";

      // 1. 機能ブロックにエンドポイントURLを追記
      const backendBlock = currentPlan.systemArchitecture.functionalBlocks.find(b => b.priority === 1);
      if (backendBlock) {
        backendBlock.status = "完了";
        backendBlock.endpointURL = BACKEND_URL;
      }

      // 2. ロードマップのステータスを更新
      const phase1 = currentPlan.roadmap.find(p => p.phase === 1);
      if (phase1) {
        phase1.status = "完了";
        phase1.title = "【完了】バックエンド構築フェーズ";
      }

      const phase2 = currentPlan.roadmap.find(p => p.phase === 2);
      if (phase2) {
        phase2.status = "進行中";
        phase2.title = "【進行中】データベースとGUIの連携開発フェーズ";
      }

      // 3. 最終更新日時を更新
      currentPlan.lastModified = new Date().toISOString();
      return currentPlan;
    },
    "意思決定ログ.JSON": function(currentLog) {
      const now = new Date();
      const timestamp = now.toISOString();
      const logId = `LOG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-5)}`;
      
      const newLogEntry = {
        "logId": logId,
        "timestamp": timestamp,
        "subject": "バックエンド構築フェーズの公式な完了を宣言",
        "context_why": "バックエンドAPIのCloud Runへのデプロイが成功し、全世界からアクセス可能な恒久的なエンドポイントURLが確保されたため。",
        "decision_what": "バックエンド構築フェーズ（ロードマップのフェーズ1）の完了を正式に決定。成功の証として、デプロイされたURLをマスタープランに記録し、プロジェクトのステータスを次なる『データベースとGUIの連携開発フェーズ』へと進める。",
        "impact_how": "プロジェクトの基盤となるサーバーサイド機能が完全に確立された。これにより、今後はフロントエンド（GUI）からのデータを受け取り、それを処理して返すという、アプリケーションの核心的な価値提供に集中できるようになった。"
      };
      if (!currentLog.decisionLog) currentLog.decisionLog = { logs: [] };
      currentLog.decisionLog.logs.push(newLogEntry);
      currentLog.decisionLog.最終更新日 = timestamp;
      return currentLog;
    },
    "プロジェクト状態.JSON": function(currentStatus) {
      const now = new Date().toISOString();
      if (!currentStatus.projectStatus) currentStatus.projectStatus = {};
      const status = currentStatus.projectStatus;

      status.最終更新日 = now;
      status.status = "バックエンド構築完了・連携開発フェーズ";
      status.lastCompletedMilestone = "バックエンドAPIのデプロイに成功し、マスタープランのロードマップを更新。プロジェクトは正式に次の開発フェーズへ移行した。";
      status.nextActionableStep = "フロントエンド（GUI）と、今回デプロイしたバックエンドAPIとの間で、データの送受信を行う連携部分の開発に着手する。";
      return currentStatus;
    }
  }
};
/**
 * 💡 この関数を実行してください
 */
function runUpdate_FinalizeBackendPhase() {
  applyProjectUpdate(updateConfig_FinalizeBackendPhase);
}
