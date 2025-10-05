# -*- coding: utf-8 -*-
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import google.generativeai as genai
from google.cloud import pubsub_v1
from fastapi.middleware.cors import CORSMiddleware
import json

# 思考エンジンを外部ファイルから読み込む
from main_engine import analyze_risks_from_conversation

# --- Pub/Subクライアントの初期化 ---
publisher = pubsub_v1.PublisherClient()
project_id = os.getenv("GCP_PROJECT")
topic_name = "jigyokei-analysis-completed"
topic_path = None
if project_id:
    topic_path = publisher.topic_path(project_id, topic_name)
else:
    print("警告: 環境変数 GCP_PROJECT が見つかりません。Pub/Subへの送信は無効になります。")

# --- FastAPIアプリケーションを初期化 ---
app = FastAPI()
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- APIの受付窓口の定義 ---
class ConversationRequest(BaseModel):
    conversation_log: str

@app.get("/")
def read_root():
    return {"message": "サーバーは正常に起動しています。POSTリクエストを / に送信して、会話分析を実行してください。"}

@app.post("/")
def analyze_endpoint(request: ConversationRequest):
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="APIキーが設定されていません。環境変数 'GOOGLE_API_KEY' を確認してください。")
    
    # 環境変数から読み込んだAPIキーをGenerative AIモデルに設定
    genai.configure(api_key=api_key)

    try:
        # --- 思考エンジンを呼び出し、整形されたJSONを受け取る ---
        analysis_result = analyze_risks_from_conversation(request.conversation_log)
        
        # Pub/Subに分析結果を送信（プロジェクトIDが設定されている場合のみ）
        if topic_path and analysis_result.get("risks"):
            try:
                message_data = json.dumps(analysis_result).encode("utf-8")
                future = publisher.publish(topic_path, message_data)
                future.result() # 送信完了を待つ
                print(f"✅ 分析結果をPub/Subトピック '{topic_name}' に正常に送信しました。")
            except Exception as pubsub_error:
                print(f"⚠️ Pub/Subへの送信に失敗しました: {pubsub_error}")

        return analysis_result

    except Exception as e:
        print(f"❌ API処理中に予期せぬエラー: {e}")
        raise HTTPException(status_code=500, detail=f"サーバー内部でエラーが発生しました: {e}")
