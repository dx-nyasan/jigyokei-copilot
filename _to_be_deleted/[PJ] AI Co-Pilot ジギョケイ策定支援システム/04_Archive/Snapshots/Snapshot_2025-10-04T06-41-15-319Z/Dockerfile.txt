# ベースとなるPythonの公式イメージを指定
FROM python:3.12-slim

# 作業ディレクトリを作成し、移動する
WORKDIR /app

# 必要なライブラリをインストールするためのファイルをコピー
COPY requirements.txt .

# requirements.txtに書かれたライブラリをインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションのソースコードをすべてコピー
COPY . .

# Cloud Runから渡されるPORT環境変数をリッスンするようにuvicornを起動
CMD exec uvicorn main:app --host 0.0.0.0 --port $PORT