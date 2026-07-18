# 後端 unit 測試 runner:直接以 kvgh-backend image 為底(有全部 runtime 依賴與 /app/app
# 程式碼),只補 pytest。backend-build 先建好 kvgh-backend 後此層全 cache hit 秒過。
# 測試檔不進 image——CI job 以 ro 掛載 backend/tests/unit 到 /tests、ci/contracts 到 /contracts。
FROM kvgh-backend
RUN pip install --no-cache-dir pytest==9.1.1
WORKDIR /app
# pytest 收集 /tests 時 rootdir 在掛載點，需明示 app 套件位置
ENV PYTHONPATH=/app
# -p no:cacheprovider:掛載是唯讀的,不寫 .pytest_cache
ENTRYPOINT ["pytest", "-v", "-p", "no:cacheprovider", "/tests"]
