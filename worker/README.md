# KVGH 演算法 Worker

Celery worker：處理影片轉檔、2D/3D 姿態萃取（GPU）、humanpose 比對與標註存檔。
由 `docker compose up` 一併啟動（`worker-gpu` 與 `worker-cpu` 兩個服務、同一個 image）。

## 任務與佇列

| 任務 | 佇列 | 說明 |
|---|---|---|
| `worker.tasks.transcode` | cpu | 任意上傳格式 → H.264 mp4 + faststart（h264 來源只 remux，秒級） |
| `worker.tasks.extract_pose` | gpu | AlphaPose(2D) → MotionBERT(3D)，產出 npy；artifact 已存在則短路 |
| `worker.tasks.run_comparison` | cpu | humanpose_api 比對導師/病患，寫 `AnalysisResult`（真分數） |
| `worker.tasks.save_annotation` | cpu | 以 make_vid_json_api 產生演算法標註 JSON |

導師影片 chain：`transcode → extract_pose`
病患影片 chain：`transcode → extract_pose → run_comparison`

## 防 OOM 的兩層保護

1. **autoscale 硬上限**：`--autoscale=${GPU_MAX_CONCURRENCY},1`——無任務時常駐
   1 個 process，佇列有任務自動擴增到上限（2080 8GB = 2），超過的排隊，絕不超收。
   換更大 VRAM 的 GPU server 時只需調 `.env` 的 `GPU_MAX_CONCURRENCY`。
2. **VRAM 動態守門**：GPU 任務啟動前用 pynvml 查剩餘 VRAM，低於
   `GPU_MIN_FREE_VRAM_MB` 就 retry（每 60 秒、最多 1 小時）——GPU 被其他程式
   佔用時只是延後執行；subprocess 以 CUDA OOM 失敗也會 backoff 重試。

## 依賴的掛載（見 docker-compose.yml）

- `./media:/data/media`：影片與產物永久儲存（與 backend 共用）
- `./algorithm:/algorithm`：git 追蹤的演算法腳本
- `${ENGINE_DIR}:/engine/2D_and_3D_project`：含模型權重與已編譯 .so 的
  AlphaPose/MotionBERT 工作目錄（預設 `./algorithm/2D_and_3D_project`，
  權重與 .so 為 gitignore、隨專案目錄整包拷貝遷移）。
  image 用 ubuntu:24.04 對齊主機 glibc，才能直接載入主機編譯的 cpython-312 .so。

## 未來部署到遠端 GPU server

RabbitMQ 5672 已發布到主機。遠端 server 上跑同一個 image（或 host 直跑），
`CELERY_BROKER_URL`/`DATABASE_URL` 指回本機，`MEDIA_ROOT` 需共享儲存（NFS）。
調高該機的 `GPU_MAX_CONCURRENCY` 即可平行更多任務。
