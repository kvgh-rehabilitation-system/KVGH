# API 契約測試 runner:依賴 pin 進 image layer,同機 daemon cache 讓重跑零安裝時間。
# 測試檔不進 image——compose 服務(ci/compose.ci.yml 的 api-tests)以 ro 掛載 backend/tests/api。
FROM python:3.12-slim
# 容器內以 root 跑 pip 是常態，關掉 root 警告與升版 notice（CI build log 保持零警告）
ENV PIP_ROOT_USER_ACTION=ignore \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN pip install --no-cache-dir pytest==9.1.1 httpx==0.28.1
WORKDIR /tests
# -p no:cacheprovider:掛載是唯讀的,不寫 .pytest_cache
CMD ["pytest", "-v", "-p", "no:cacheprovider"]
