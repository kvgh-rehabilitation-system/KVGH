# KVGH 後端

FastAPI + SQLAlchemy 2.0 + PostgreSQL（`DATABASE_URL` 注入；本機 fallback SQLite）。

## 分層

`app/{core,db,models,schemas,services,api}`：router 只做參數綁定與權限依賴（`require_admin/doctor/nurse/patient`），邏輯在 services，序列化統一走 `services/common.py` 的 `*_to_out`。

停用帳號（`users.is_active=false`）在 `deps.py` 的 `get_current_user` **與** `get_user_flexible` 都回 403（media 串流也擋），login 端點另擋。無 Alembic，`users.is_active` 這類新欄位登記在 `db/ensure_schema.py` 的 `_COLUMNS`。

## 媒體串流

- **沒有 StaticFiles mount**。所有媒體走 `api/routers/media.py`：影片用 `media_service.stream_video`（HTTP Range/206 邊播邊緩衝），小檔（.npy）用 `media_service.send_file`（FileResponse）
- 路徑一律經 `media_service.abs_path()` 防跳脫；DB 只存相對 MEDIA_ROOT 的路徑
- 認證 `get_user_flexible`：Bearer header 或 `?token=` query（`<video>` 標籤用）

## 分析資料契約

- `AnalysisResult.metrics` 是 JSON 直通欄位（`analysis_to_out` 原樣帶出）。**`ai_report` 藏在 `metrics["ai_report"]`**，schema 加欄免 migration——未來 LLM worker 只要寫這個 key
- `summary_text` 是演算法規則式輸出（`algorithm/humanpose_api.py`），不是護理師評論（那是 `VideoSubmission.feedback`）
- `services/analysis_data_service.py`：審核頁儀表板 payload（動作卡/相似度曲線/關節偏差序列，各影片跳轉秒數皆後端預算）。**快取契約**：首次算完寫 `results/{id}/dashboard.json`；`scores.json` mtime 更新（重新分析）或 `VERSION` 提升即重算。改 payload 結構或幀映射邏輯必須 `VERSION` +1
- 幀映射常數 `OUTPUT_FPS=30`、`HOLD_FRAMES=60` 對應 `humanpose_api.py` 的影片合成寫死值，兩邊要同步（詳見根目錄 CLAUDE.md）

## Seed 注意

`app/seed.py` 造的 submission 是 `analysis_status='DONE'` 但**磁碟無任何檔案**（無 .npy、無 results/）：pose3d 與 analysis-data 對 seed 資料回 404 是預期行為，前端會降級。日期以 TODAY 相對計算，重跑 seed 永遠有今日資料。

## 測試

- `tests/api/`：對已起好的 stack 打真 HTTP（`API_BASE_URL`），只驗狀態碼與頂層形狀；`test_openapi.py` 釘住關鍵路由存在
- `tests/unit/`：純函式單元測試，不碰 DB（假物件用 SimpleNamespace）。CI 以 `ci/backend-unit/Dockerfile`（FROM kvgh-backend + pytest）跑，測試檔與 `ci/contracts` golden 皆 ro 掛載；本機重現：`docker build -t kvgh-backend-unit ci/backend-unit/ && docker run --rm -v $PWD/backend/tests/unit:/tests:ro -v $PWD/ci/contracts:/contracts:ro kvgh-backend-unit`
- `tests/unit/test_contract_golden.py` 釘住 `VERSION`/`OUTPUT_FPS`/`HOLD_FRAMES` 與 `display_status` 值域（golden `ci/contracts/submission_status.json`，前端 vitest 驗同一份）——改幀映射/值域時測試會逼你同步所有耦合端

## 部署

程式碼打進 image（無 bind mount）。迭代小改：`docker cp backend/app/... kvgh-backend:/app/app/...` + `docker restart kvgh-backend`；收尾一次乾淨 rebuild。
