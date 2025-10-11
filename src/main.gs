// v11.0 - Project Normalization Complete. Auto-deployment pipeline activated.

/**
 * @fileoverview プロジェクトJSONファイル群を安全かつ効率的に更新・資産化するための公式エンジン
 * @version 10.0 (製品版)
 * @description マスタープラン、プロジェクト状態、意思決定ログの3ファイルを対象に、Deltas（差分）とSnapshots（全体）のアーカイブ戦略を実装。フォルダIDをスクリプトプロパティで管理する最終安定版。
 */

// =========================================================================================
// ▼▼▼【設定用】GASプロジェクトのプロパティを管理する関数群 ▼▼▼
// =========================================================================================

function setFolderIds() {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    \'MASTER_FOLDER_ID\': \'1EPkPvug2qTwfjxuyIAFRLWoTtXk9jZrc\', // マスターJSONファイル群が格納されているフォルダID
    \'ARCHIVE_FOLDER_ID\': \'1463itoS4sLl-60gxCJgafOlPfdI1ZEnbw\'  // アーカイブ（Deltas, Snapshots）を保存するフォルダID
  });
  Logger.log('✅ フォルダIDをスクリプトプロパティに保存しました。');
}

function getFolderIds() {
  const properties = PropertiesService.getScriptProperties();
  const masterFolderId = properties.getProperty(\'MASTER_FOLDER_ID\');
  const archiveFolderId = properties.getProperty(\'ARCHIVE_FOLDER_ID\');
  
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
        targetFile = files.next();
        // バックアップを作成
        targetFile.makeCopy(`${timestamp}_${fileName}`, deltasFolder);
        // ファイル内容を読み取り
        const content = targetFile.getBlob().getDataAsString();
        if (content && fileName.toLowerCase().endsWith('.json')) {
          fileObject = JSON.parse(content);
        }
      }

      // 更新処理を実行
      const updatedObject = updateFunction(fileObject);
      const newContent = JSON.stringify(updatedObject, null, 2);

      // 結果を書き込み
      if (targetFile) {
        targetFile.setContent(newContent);
      } else {
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

// ... (過去の実行済み関数はここにアーカイブされていく) ...

function _runUpdate_FinalizeArchitecture() {
  applyProjectUpdate(updateConfig_FinalizeArchitecture);
}

const updateConfig_FinalizeArchitecture = {
  updateName: "Finalize_Data_Architecture_and_Pipeline",
  updates: {
    "意思決定ログ.JSON": function(currentLog) {
      const now = new Date();
      const timestamp = now.toISOString();
      const logId = `LOG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Date.now().toString().slice(-5)}`;
      
      const newLogEntry = {
        "logId": logId,
        "timestamp": timestamp,
        "subject": "最終アーキテクチャ決定：データの『温度』に基づく、IDE・GitHub・Drive・GCSの役割分担と知識資産化パイプラインの完成",
        "context_why": "旧来の未分化な資産管理は、思考のノイズ、デプロイ事故のリスク、そして何より『経験』という無形資産の散逸を招いていた。特に、GASスナップショット等の『歴史的記録（Cold Data）』と、日々参照する『公式文書（Warm Data）』の保管場所が未定義であったため、一貫性のあるデータライフサイクル管理の確立が最終課題となった。",
        "decision_what": {
          "role_redefinition": {
            "FirebaseStudio_IDE": "『開発司令室』。src（製品コード）と_workbench（思考ログ）を生成・編集する唯一の場所と定義。",
            "GitHub": "『全資産のバージョン管理台帳』。IDEで生まれた全成果物（src, _workbench, _reference_assets）の『全てのバージョン』を記録する。",
            "Google_Drive": "『外部共有ポータル』。_reference_assets内の最新の公式文書（Warm Data）のみを同期し、非開発者向けにクリーンな閲覧環境を提供する。",
            "Google_Cloud_Storage": "『永続的な記録保管庫（Deep Archive）』。GASスナップショット等の歴史的記録（Cold Data）を、IDEやDriveから隔離し、低コストで長期保管する場所と定義。"
          },
          "knowledge_asset_pipeline": "①【記録@IDE】思考と実験の全過程を_workbenchに記録 → ②【蒸留@IDE】知見を形式知化し_reference_assetsに格納 → ③【共有@Google Drive】_reference_assetsの最新版を外部公開 → ④【アーカイブ@GCS】GASスナップショット等の歴史的記録は、専用保管庫へ移管。この4段階のデータライフサイクルを正式な運用プロセスとする。"
        },
        "impact_how": "データの『温度』に基づき最適な保管場所を割り当てたことで、完全な役割分担が実現した。これにより、開発効率の向上、事故リスクの根絶、そして『個人の経験が組織の永続的な資産へと転換される』真のナレッジマネジメント基盤が完成した。"
      };
      
      if (!currentLog.decisionLog) currentLog.decisionLog = { logs: [] };
      currentLog.decisionLog.logs.push(newLogEntry);
      currentLog.decisionLog.最終更新日 = timestamp;
      return currentLog;
    }
  }
};


// ---------------------------------------------------------------------------------
// ▼▼▼【今回実行する唯一の関数】▼▼▼
// ---------------------------------------------------------------------------------

// ※現在、実行待機中の新規更新はありません。