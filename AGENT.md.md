# KVGH 高榮智慧復健系統系統

高雄榮總復健科原型：病患上傳復健動作影片 → 演算法與導師示範影片比對評分 → 護理師審核回饋 → 醫生調整計畫。三角色（doctor / nurse / patient）。

## 系統地圖

| 目錄 | 內容 | 詳見 |
|---|---|---|
| `frontend/` | React 19 + Vite + TS + Tailwind（feature-based） | frontend/CLAUDE.md |
| `backend/` | FastAPI + SQLAlchemy（core/db/models/schemas/services/api 分層） | backend/CLAUDE.md |
| `worker/` | Celery worker（gpu/cpu 佇列），跑演算法管線 | worker/CLAUDE.md |
| `algorithm/` | 演算法腳本（`humanpose_api.py` ~3300 行遺留程式、`get_2D_3D_script.py`）；`2D_and_3D_project/` = 引擎工作目錄（程式碼與編譯好的 .so 進 git；~1.5GB 權重為 gitignore，由 GitHub Release `weights-v1` 經 `scripts/download_weights.sh` 首次啟動自動下載；`ENGINE_DIR` 預設指此） | worker/CLAUDE.md |
| `media/` | 影片與演算法產物（bind mount 進 backend 與 worker 的 `/data/media`） | 下方 |

## 啟動與帳號

- 新機器：`git clone https://github.com/kvgh-rehabilitation-system/KVGH.git` → `docker compose up -d --build` 即用（權重自動下載，無需資料夾外操作）
- `docker compose up -d --build` → 前端 http://localhost:2000（**port 2000 是使用者指定，勿改**）
- 服務：frontend(nginx) / backend(uvicorn:8000) / postgres / rabbitmq / worker-gpu / worker-cpu / weights-init（一次性，權重齊全秒過；workers 依賴其成功完成）
- 帳號：doctor01-03、nurse01-03、patient01-20，密碼一律 `1234`
- 種子 `backend/app/seed.py` **預設只建帳號**；`python -m app.seed --demo` 才建假臨床資料（TODAY 相對日期，重跑永遠有「今日」資料）。seed 會把 id 序列跳到 submissions≥1000、teacher_videos≥100，避開磁碟殘留的舊 media 產物
- backend 程式碼**打進 image、無 bind mount**：小改用 `docker cp backend/app/... kvgh-backend:/app/app/...` + `docker restart kvgh-backend` 熱修，收尾再乾淨 rebuild

## media/ 產物目錄（演算法輸出契約）

```
media/
├─ teacher_videos/{tid}/          t{tid}.mp4、motionbert/t{tid}.npy、alphapose/、annotation/t{tid}.json
├─ submissions/{sid}/             s{sid}.mp4（轉檔後）、motionbert/s{sid}.npy、alphapose/
├─ results/{sid}/                 analysis.json、scores.json、stair.json、angles.json、
│                                 output.mp4（完整分析畫面）、output_plain.mp4（2×2 比對）、
│                                 dashboard.json（backend 快取，重新分析後自動重算）
└─ jobs/                          worker 暫存（會清除）
```

- `.npy` = MotionBERT 3D 骨架 `(幀, 17, 3)` float32，**H36M 17 關節**、root 置中、Y 向下為正、數值 ≈[-1,1]
- 命名慣例：導師 `t{teacher_video_id}`、病患 `s{submission_id}`（演算法的 charactor 名）

## ⚠️ 幀↔秒數映射陷阱（審核頁跳轉功能的根基）

輸出影片與病患原片**不是同一條時間軸**：

- 病患原片 ≈60fps；`output.mp4` / `output_plain.mp4` 皆為 **30fps 寫死**
- 合成邏輯：每個 TALMA 步驟寫 `max(Δ導師幀, Δ病患幀)` 幀（先到者凍結）；`output.mp4` 每步驟後**再加 60 幀停留**，`output_plain.mp4` 沒有
- 映射數學集中在 `backend/app/services/analysis_data_service.py`（常數 `OUTPUT_FPS=30`、`HOLD_FRAMES=60`），前端只用後端預算好的 `t_plain` / `t_full` / `t_patient` / `t_mentor`
- **若 `algorithm/humanpose_api.py` 的影片合成邏輯改動，必須同步改該 service 並將 `VERSION` +1**（dashboard.json 快取會自動失效重算）

## 認證慣例

- 一般 API：Bearer header（axios 攔截器自動帶）
- `<video>` / 媒體串流：`?token=` query（`GET /api/media/...`，`get_user_flexible` 兩者皆收）

## Seed 與真實資料的差異

`--demo` seed 的 submission 有 DB 分析列（假 `motion_sequence`、假 `summary_text`）但**磁碟上沒有任何檔案**：pose3d 與 analysis-data 會 404，審核頁自動降級（示意動畫 + 只有原始影片並排）。2026-07 清庫後 DB 從空帳號起步；磁碟仍保留舊產物 `submissions/74`、`results/74`、`teacher_videos/2` 供參考（DB 已無對應列）。

## 導師影片庫（護理師端）

- 一支導師影片可被多個動作共用；`GET/POST /api/nurse/teacher-videos` 為影片庫列表/獨立上傳（上傳必填 `name`），綁定/切換走 plan item 的 `teacher_video_id`（後端驗證 `extraction_status == "EXTRACTED"`，未標註可後補）
- 標註是**影片級**屬性：改標註會影響所有引用該影片的動作
- `teacher_videos.name` 欄位無 Alembic，只在全新 DB（create_all）生效
