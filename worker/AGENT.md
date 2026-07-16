# KVGH 演算法 Worker

Celery worker ×2（gpu/cpu 佇列），把 `algorithm/` 的遺留腳本包成 pipeline：`transcode`(cpu) → `extract_pose`(gpu, AlphaPose 2D + MotionBERT 3D) → `run_comparison`(cpu, TALMA/ALPS 比對)。導師影片只跑到 extract，產物跨計畫版本重用。

## ⚠️ 環境硬約束（重建 image / 搬 GPU server 必看）

- **torch 必須 cu126**（不是 cu118）：引擎 `algorithm/2D_and_3D_project`（`ENGINE_DIR`；程式碼與編譯好的 .so 進 git，~1.5GB 權重 gitignore、由 compose 的 weights-init 服務從 GitHub Release `weights-v1` 自動下載）內編譯的 AlphaPose CUDA 擴充 .so 連結 `libcudart.so.12`；編譯環境 = python 3.12 + torch 2.7.1+cu126，worker image 必須對齊
- image 需 apt 裝 **`python3.12-tk`**（AlphaPose coco_wholebody 會 import tkinter）
- `humanpose_api.py` 以 **CWD 相對路徑**寫 `fig/`、`vid/`、`output_video/` 等目錄且**沒有 makedirs**（cv2.VideoWriter 對缺目錄靜默失敗 → 比對影片直接消失）；還會讀 `ppt/alpha.png` 等素材。`pipeline/compare.py` 已在 job 目錄預建全部目錄 + symlink `algorithm/assets/ppt/`——改 compare.py 時別把這段弄掉
- `worker/db.py` 必須 `import app.db.base` 載入全部 models，否則 `relationship('RehabPlan')` 字串解析失敗
- 主機磁碟常態緊繃（219G 用 9 成）：worker image 11GB，每次真重建舊層變 dangling；日常清理用 `docker image prune -f`。**`docker buildx prune` 別隨手跑**——會清掉 default builder 的 build cache，下次 rebuild 從 2 秒退化回 30–60 分鐘，磁碟真的見底才用
- 全域 buildx builder 必須是 `default`（docker driver）：2026-04 曾被切到 docker-container driver 的 `ci-builder`，即使全 cache hit 也要搬 11GB tarball（無改動 rebuild 12 分鐘）；2026-07 已切回並在 `.env` 設 `COMPOSE_BAKE=false`，CI 腳本也自帶 `BUILDX_BUILDER=default`
- compose build 偶爾 bake 完成後 hang 住不退出——`.env` 已設 `COMPOSE_BAKE=false` 迴避；若仍遇到，images 都 tag 好即可 kill 掉改 `docker compose up -d`
- 迭代小改：`algorithm/` 是 bind mount 免重建；worker 程式碼用 `docker cp` + `docker restart` 熱修，收尾再乾淨 rebuild

## 產物契約（`pipeline/compare.py` 的 _collect 邊界）

跑完只收 6 個檔進 `media/results/{sid}/`：`analysis.json`、`scores.json`、`stair.json`、`angles.json`、`output.mp4`、`output_plain.mp4`（faststart remux 後），其餘（fig/ PNG 等）隨 job 目錄 `rmtree` 銷毀。DB 寫入在 `tasks.py`：四分數 + `summary_text` + `metrics`（含 `joint_deviations`、`motion_sequence`、`raw` 相對路徑表）。

- 命名：導師 `t{teacher_video_id}`、病患 `s{submission_id}`（--charactor 參數）
- `angles.json.all_frames[i]` 的 mentor/patient 是**各自影片的第 i 幀**（未時間對齊；導師較短則缺 `mentor` 鍵）——要對齊需用 TALMA 段表映射（backend `analysis_data_service.py` 有實作）

## ⚠️ 影片合成寫死值（改了要同步 backend）

`humanpose_api.py`：輸出影片 30fps 寫死；每 TALMA 步驟寫 `max(Δ導師, Δ病患)` 幀（先到者凍結）；`output.mp4` 每步驟後加 60 停留幀、`output_plain.mp4` 沒有；合成涵蓋全部步驟（2026-07 前寫死只做前 11 步，舊影片需重新分析才有 12+ 步）。**動到這段 → 同步改 `backend/app/services/analysis_data_service.py`（OUTPUT_FPS / HOLD_FRAMES / 段表邏輯）並將 VERSION +1。**

## 3D .npy 格式

MotionBERT `(幀, 17, 3)` float32，H36M 順序（0骨盆 1-3右腿 4-6左腿 7脊椎 8胸廓 9頸 10頭 11-13左臂 14-16右臂），root 置中、Y 向下、≈[-1,1]（`infer_wild.py` 未帶 `--pixel`）。存放：`submissions/{sid}/motionbert/s{sid}.npy`、`teacher_videos/{tid}/motionbert/t{tid}.npy`。
