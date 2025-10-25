from fastapi import FastAPI, Request, Response
import httpx
import os

app = FastAPI()

# 専門エージェント（リスク分析）のエンドポイントURL
# 環境変数から取得することを推奨
SPECIALIST_AGENT_URL = os.environ.get("SPECIALIST_AGENT_URL", "https://jigyokei-copilot-backend-310523847405.asia-northeast2.run.app/analyze-risk/")

@app.post("/")
async def command(request: Request):
    """
    司令塔として、リクエストを専門エージェントに転送する。
    """
    try:
        # リクエストボディをそのまま取得
        data = await request.json()

        # 専門エージェントにリクエストを転送
        async with httpx.AsyncClient() as client:
            response = await client.post(SPECIALIST_AGENT_URL, json=data, timeout=120.0)

        # 専門エージェントからのレスポンスをそのまま返す
        return Response(content=response.content, status_code=response.status_code, media_type=response.headers.get("content-type"))

    except Exception as e:
        return Response(content=f"Error: {e}", status_code=500)
