# 動作偵測與相似度比對流程概要

本文件彙整 `get_2D_3D_script.py` 與 `humanpose_api.py` 的重點，作為簡報講稿／流程圖的素材。

## 整體流程
- 目標：從患者影片產生 2D 關鍵點、推論 3D 骨架，並與導師影片進行動作相似度比對。
- 兩大步驟：  
  1) 影片 → AlphaPose 產出 2D JSON，並以簡單距離條件過濾異常幀。  
  2) AlphaPose JSON → MotionBERT 產出 3D npy，再進入 TALMA 相似度比對與圖表輸出。

## 前置需求
- 環境：AlphaPose、MotionBERT 已可在本機執行。
- 輸入：目標影片 (`.mp4`) 以及導師/病患對應的 `json/<name>.json`（內含導師 highlight 幀 `frameCount` 列表）。
- 產出資料夾：腳本會自動建立 `alphapose_output/`、`motionbert_output/`、`fig/`、`scores_json/`、`stair_json/`、`angles_json/`。

## Step 1：2D/3D 轉檔 (`get_2D_3D_script.py`)
- 目的：呼叫 AlphaPose 取得 2D keypoints，再呼叫 MotionBERT 產生對應 3D 骨架 (`.npy`)。
- 關鍵流程：
  - `demo_inference.py --outdir alphapose_output --video <影片>`  
  - 針對 JSON 逐幀檢查肩寬（關節 17 vs 23 的距離），距離 < 100 的幀會被濾除，減少姿態偏移。
  - `infer_wild.py -o motionbert_output -j <對應 JSON> -v <影片>` 產出 3D 骨架。
- 範例指令（需填絕對路徑）：  
  ```bash
  python get_2D_3D_script.py \
    --alphapose_script_path /abs/path/to/AlphaPose/demo_inference.py \
    --motionbert_script_path /abs/path/to/MotionBERT/infer_wild.py \
    --video_path /abs/path/to/video.mp4
  ```

## Step 2：動作相似度比對 (`humanpose_api.py`)
- 目的：將導師/病患的 3D 骨架對齊，輸出 TALMA 相似度、對齊幀與視覺化圖表。
- 執行方式：  
  ```bash
  python humanpose_api.py --charactor1 <mentor_name> --charactor <patient_name>
  ```
  - `motionbert_output/<name>.npy`：對應 Step 1 生成的 3D 骨架。
  - `json/<mentor>.json`：提供導師的 highlight 幀清單。
- 核心計算重點：
  - 建立 16 條肢段向量（依固定關節順序），並計算全身/左/右的餘弦相似度矩陣。
  - 以導師 highlight 幀當特徵，對病患全幀做 DTW（含時間比例懲罰的 adaptive soft regulation）求最短路徑。
  - `filter_one_to_one_look_ahead`：將多對一配對壓縮為 1 對 1，並回溯修補低於門檻的區段（預設相似度門檻約 0.75，前 15% 高分段取平均）。
  - 全身/左/右三組 DTW 結果，依各自的相似度挑選最佳配對幀，避免左右側動作失配。
- 主要輸出：
  - `fig/`：各視角的匹配結果圖（P1/P2/P3 Matching），含導師與病患的對應線、β/α 標記。
  - `scores_json/<patient>.json`：每個動作的相似度與幀對應。
  - `stair_json/<patient>.json`：配對階梯圖資料（steps/actions/mentor_hlt 等）。
  - `angles_json/<patient>.json`：每個對應動作的 16 維角度對照，以及全幀角度序列。

## PPT 可用重點
- 管線圖：影片 → AlphaPose(JSON) → MotionBERT(3D) → TALMA(DTW+相似度) → 圖表與 JSON 輸出。
- 演算法亮點：  
  - 肢段餘弦相似度矩陣（全身/左右分開）。  
  - 加入時間比例懲罰的 DTW，避免幀位移。  
  - 1 對 1 篩選與回溯修補，確保每個導師動作都有最佳病患對應。  
  - 左右側獨立比對後再融合，降低側向遮擋影響。
- 成果展示：`fig/` 圖檔可直接放入簡報（P1/P2/P3 Matching、左/右/全身曲線）。
