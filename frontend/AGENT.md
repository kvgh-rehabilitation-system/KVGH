# KVGH 前端

React 19 + Vite + TypeScript + Tailwind 3.4 + framer-motion。設計語言：溫暖人文感（米白/陶土/鼠尾草綠）、豐富動畫是賣點。全站文案 zh-TW。

## 結構慣例

- Feature-based：`src/features/{doctor,nurse,patient}/pages/...`，跨 feature 元件放 `src/components/ui/`
- API 層 `src/api/`：`client.ts` 是 axios 實例（自動帶 Bearer、401 導回 login）；錯誤訊息用 `apiErrorMessage(err)`
- 媒體 URL：`src/api/media.ts` 產生 `<video>` 用的 `?token=` URL（video 標籤帶不了 header）；非 video 的二進位（如 .npy）走 axios `responseType:'arraybuffer'` 即可用 Bearer
- 3D（three.js/@react-three/fiber/drei）一律經 `src/components/three/lazy.tsx` lazy 載入，讓 three 獨立 chunk 不拖慢一般頁面
- 圖表用 recharts；色票直接用 hex（palette 見 `tailwind.config.js`：cream/parchment/sand、clay-500 `#C67B5C`、sage `#8A9B6E`、rust `#B5543B`、amber `#D9A441`）
- **影片分析狀態文案唯一來源 `src/utils/submissionStatus.ts`**：badge 一律用後端預算的 `display_status`（FAILED > 管線階段 > 業務狀態，勿自行組合 `status`+`analysis_status`），醫護/管理員用 `statusLabel(s)`、病患用 `statusLabel(s,'patient')`；「分析中→完成」的自動刷新用 `src/hooks/usePollingReload.ts`（reload 不得先清空資料）

## 審核頁元件地圖（`features/nurse/pages/SubmissionReviewPage.tsx`）

頁面只負責三路平行載入（`getSubmission` / `getAnalysisData`→404 回 null / `fetchPose3d`→404 回 null）與排版；面板在 `features/nurse/components/review/`：

- `MotionReplayPanel`：pose 有 → `HumanReplay`（rehab_human.glb 素體，.npy 17 關節重定向驅動）；null → `HumanMotionReplay`（同素體，關節角度示意動畫，seed 資料 fallback）。舊版 `MannequinReplay`（程式化球+膠囊）/`MotionReplay`（Michelle.glb）保留未刪，可隨時切回
- `AnalysisPanel` + `BodyHeatmap`：四分數環 + 演算法自動判讀（`summary_text` 是演算法輸出，非護理師評論）+ 人體熱區圖（8 關節偏差上色，15° 門檻）
- `ActionBreakdown` / `SimilarityTimeline`：吃 analysis-data 的 `actions` / `curve`，點擊呼叫 `ComparisonVideoPanel` 的 seek
- `ComparisonVideoPanel`：**seek 中樞**（forwardRef handle）。三畫面切換：2×2（`variant=plain`，預設）/ 完整分析畫面 / 原始影片並排。**各影片時間軸不同**，跳轉必須用後端預算的 `t_plain`/`t_full`/`t_patient`/`t_mentor`，不可自己換算（原因見根目錄 CLAUDE.md 的幀映射陷阱）
- `AiReportCard`：`analysis.ai_report` null 時顯示「即將推出」，未來 LLM 報告直接落在這

## 3D 素體

- 現行素體 = `public/models/rehab_human.glb`（MakeHuman，137 骨蒙皮）：`components/three/human-model.ts` 統一載入（移除檔內重複副本、素色膚材、`JOINT_TO_BONE` 映射；**GLTFLoader 會剝掉骨名的「.」**，查找一律走 `normalizeBoneName`，且不可剝數字否則 upperarm01/02 撞名）
- `components/three/retarget.ts`：.npy 17 關節座標 → 蒙皮骨架的基底驅動（swing+twist）重定向：骨盆/軀幹/頭三正交框架驅動 root/spine05/neck01（yaw 忠實傳遞），四肢用骨段方向+彎曲平面法線（直肢退化時由身體框架搬運綁定法線防抖），骨盆錨定量測式平移；`HumanReplay` 用。**勿退回 swing-only 最短弧**（會抵銷身體 yaw，全身姿勢錯亂）。`localStorage.debugPose='1'` 會疊 17 關節資料點供校驗（點應貼合素體關節；鼻點浮在臉前屬預期）。頭部框架 up=頸根(8)→頭頂(10) 跳過鼻、面向由 胸廓(8)→鼻(9) 決定（H36M 第 9 關節 MotionBERT 實為鼻，不可當頸用）
- `components/three/pose-utils.ts`：`preparePose()` 做座標轉換（`x=-x, y=-y, z=+z` → three.js Y-up）、一次性朝向正規化（站立幀脊椎轉直立、面向轉 +Z；**傾角 ≥45° 躺姿跳過矯正**）、身高正規化 1.65m、踝高第 5 百分位貼地；`MIRROR_Z` 開關備左右鏡像校正用。正規化後素體直立、面向 +Z、貼地，`HumanReplay` 預設鏡位即正面
- `.npy` 解析：`src/utils/npy.ts`（僅支援 `<f4` C-order）
- H36M 關節索引/邊表/8 關節映射都在 `pose-utils.ts`，別在元件裡重複定義

## 建置陷阱

- **package-lock.json 必須用容器內 npm 產生**（`docker run --rm -v $PWD:/app -w /app node:24-alpine npm install --package-lock-only`），本機 npm 版本不同會讓 `npm ci` 因 @emnapi/* optional 依賴差異失敗
- Dockerfile 用 node:24-alpine + `npm ci`
- 驗證：`npm run build`（= `tsc -b && vite build`）；lint 用 oxlint
