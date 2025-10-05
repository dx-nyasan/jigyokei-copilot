# -*- coding: utf-8 -*-
import os
import json
import textwrap
import google.generativeai as genai

# --- 認証 ---
# このIDE環境では、以前に `gcloud auth application-default login` を実行済みのため、
# ライブラリが自動で認証情報を探しに行きます。
# そのため、APIキーをコードに直接記述したり、.envファイルを使う必要はありません。
print("--- Google Cloud SDKの認証情報を確認しています ---")

def analyze_risks_from_conversation(conversation_log: str) -> dict:
    """
    会話ログを分析し、経営リスクを抽出し、厳格なJSON形式で返す思考エンジン。

    Args:
        conversation_log: 分析対象の会話ログ（全文テキスト）。

    Returns:
        リスク分析結果を含む辞書（JSON形式）。
    """
    try:
        # モデルの初期化（APIキーを指定しないことで、ADCが自動的に使用されます）
        model = genai.GenerativeModel('gemini-pro')
    except Exception as e:
        print(f"❌ モデルの初期化中にエラーが発生しました: {e}")
        print("💡 'gcloud auth application-default login' が正しく実行されているか確認してください。")
        return {"risks": [], "error_message": "Failed to initialize model."}

    # AIへの指示（プロンプト）
    prompt = textwrap.dedent(f'''
        あなたは、与えられた会話ログから経営リスクを抽出し、指定されたJSONフォーマットで出力する専門家です。
        以下の会話ログから、事業継続を脅かす可能性のある「経営リスク」を抽出し、指定されたJSONフォーマットで出力してください。

        # 出力フォーマット（必ずこのJSON形式に厳密に従うこと）
        ```json
        {{
          "risks": [
            {{
              "risk_category": "（リスクの分類：例 設備リスク, 人的リスク, 災害リスク, 賠償責任リスクなど）",
              "risk_summary": "（抽出したリスクの具体的な内容を要約）",
              "trigger_phrase": "（リスクの根拠となった会話中の具体的な発言）"
            }}
          ]
        }}
        ```
        
        # 指示
        - 冒頭の挨拶、前置き、そして末尾の補足説明や結論の言葉は一切含めないでください。
        - 出力は、上記「出力フォーマット」で指定された `json` コードブロックのみとしてください。
        - 他の形式のテキストは絶対に出力しないでください。
        - 会話ログにリスクが見当たらない場合は、risks配列を空 `[]` にしてください。

        # 入力：会話ログ
        {conversation_log}
    ''')

    try:
        # AIに分析をリクエスト
        response = model.generate_content(prompt)
        
        # AIの応答からJSON部分のみを慎重に抽出
        raw_text = response.text.strip()
        
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        # JSON文字列をPythonの辞書にパース（変換）
        parsed_json = json.loads(raw_text.strip())
        return parsed_json

    except json.JSONDecodeError:
        print(f"❌ JSONパースエラー。AIの応答が不正です: {raw_text}")
        return {"risks": [], "error_message": "AI response was not valid JSON."}
    except Exception as e:
        print(f"❌ 予期せぬエラーが発生しました: {e}")
        return {"risks": [], "error_message": str(e)}


# --- ここからがテスト実行部分です ---
if __name__ == "__main__":
    
    # 私たちが作成したテストシナリオ（〇〇キッチン編）
    test_conversation = """
    職員：〇〇社長、本日はありがとうございます。
    社長：はい、よろしくお願いします。厨房のオーブンが古くてね。いつ壊れるかヒヤヒヤしてるんだ。
    職員：なるほど、設備投資ですね。
    社長：うーん、やっぱり食中毒かな。万が一うちの店から出してしまったら、もう信用はガタ落ちで、店を続けられないかもしれない。
    職員：衛生管理には万全を期していても、可能性はゼロではないですからね。
    社長：考えたくないけど、俺が倒れたら、この店は終わりだよ。レシピも仕入れも、全部俺の頭の中にあるからな…。
    """
    
    print("--- 思考エンジンのプロトタイプを起動します ---")
    print("分析対象：〇〇キッチン編 会話ログ")
    
    # 思考エンジンを呼び出し、分析を実行
    analysis_result = analyze_risks_from_conversation(test_conversation)
    
    print("\n--- 分析結果（JSON形式） ---")
    # 結果をきれいに整形して表示
    print(json.dumps(analysis_result, indent=2, ensure_ascii=False))
    print("---------------------------\n")

    if "error_message" in analysis_result:
        print("💡 テスト中にエラーが検知されました。メッセージを確認してください。")
    elif analysis_result.get("risks"):
        print("🎉 テスト成功！会話ログからリスクが正しく抽出され、JSON形式で出力されました。")
    else:
        print("💡 リスクは検出されませんでした。会話ログの内容を確認してください。")
