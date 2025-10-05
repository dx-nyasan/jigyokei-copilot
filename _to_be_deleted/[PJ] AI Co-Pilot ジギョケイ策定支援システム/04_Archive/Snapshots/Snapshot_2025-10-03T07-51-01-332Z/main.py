# -*- coding: utf-8 -*-
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import google.generativeai as genai
from google.cloud import pubsub_v1
from fastapi.middleware.cors import CORSMiddleware
import json
import textwrap

# --- モデル設定 ---
GEMINI_MODEL = 'gemini-pro-latest'

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

# --- AI思考エンジンの機能 ---
def analyze_conversation_for_risks(conversation_log: str) -> dict:
    """
    会話ログを分析し、リスクを抽出し、指定されたJSON形式で返す。
    AIの応答からJSONデータのみを確実に抽出する。
    """
    risk_extraction_model = genai.GenerativeModel(GEMINI_MODEL)
    
    # AIへの指示（プロンプト）：挨拶や補足説明を一切行わず、JSONのみを出力するように厳格に指示
    risk_extraction_prompt = textwrap.dedent(f'''
        あなたは、与えられた会話ログから経営リスクを抽出し、指定されたJSONフォーマットで出力する専門家です。
        以下の会話ログから、事業継続を脅かす可能性のある「経営リスク」を抽出し、指定されたJSONフォーマットで出力してください。

        # 出力フォーマット（必ずこのJSON形式に厳密に従うこと）
        ```json
        {{
          "risks": [
            {{
              "risk_category": "（リスクの分類）",
              "risk_summary": "（抽出したリスクの概要）",
              "trigger_phrase": "（きっかけとなった経営者の発言）"
            }}
          ]
        }}
        ```
        
        # 指示
        - 冒頭の挨拶、前置き、そして末尾の補足説明や結論の言葉は一切含めないでください。
        - 出力は、上記「出力フォーマット」で指定された `json` コードブロックのみとしてください。
        - 他の形式のテキストは絶対に出力しないでください。

        # 入力：会話ログ
        {conversation_log}
    ''')
    
    # AIからの応答を生成
    response = risk_extraction_model.generate_content(risk_extraction_prompt)
    raw_text = response.text.strip()
    
    # AIの応答からJSON部分のみを抽出し、辞書に変換する
    try:
        # ```json と ``` というマークダウンの囲いを削除
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        
        # JSON文字列をPythonの辞書にパース
        parsed_json = json.loads(raw_text.strip())
        return parsed_json
    except json.JSONDecodeError:
        print(f"❌ JSONパースエラー。AIの応答が不正です: {raw_text}")
        # 将来の高度な構想のため、エラー時も安定して動作するよう空のリストを返す
        return {{"risks": [], "error_message": f"AI response was not valid JSON: {raw_text}"}}

# --- APIの受付窓口の定義 ---
class ConversationRequest(BaseModel):
    conversation_log: str

@app.post("/")
def analyze_endpoint(request: ConversationRequest):
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="APIキーが設定されていません。Cloud Runの環境変数を確認してください。")
    
    genai.configure(api_key=api_key)

    try:
        # --- 完成版：AIの思考エンジンを呼び出し、整形されたJSONを受け取る ---
        analysis_result = analyze_conversation_for_risks(request.conversation_log)
        
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
