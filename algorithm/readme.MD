## 📁 資料夾結構

```
.
├── .venv/                    # Python 虛擬環境資料夾
├── 2D_and_3D_project/        # 用來提取 2D 與 3D 骨架的相關專案
├── alphapose_output/         # AlphaPose 輸出的 2D 姿態結果（JSON、影片）
├── fig/                      # 比對系統產生的圖片或圖表
├── json/                     # 儲存手動標註的動作（導師動作資料）
├── motionbert_output/        # MotionBERT 產生的 3D 姿態結果（npy、影片）
├── output_video/             # 復健系統處理後的影片
├── ppt/                      # 儲存影片封面（目前未使用）
├── video/                    # 放置輸入影片的資料夾
├── get_2D_3D_script.py       # 將影片轉換成 2D 與 3D 姿態的主要腳本
├── make_vid_json.py          # 標註
├── humanpose.ipynb           # 主程式 Notebook，用於產生復健系統比對資料
└── readme.MD                 # 專案說明文件
```

---

## 🚀 使用流程

### **步驟 1：將原始影片轉換為 2D / 3D 姿態資料**

1. 將原始影片放入 `video/` 資料夾
2. 執行以下指令，生成 AlphaPose（2D）與 MotionBERT（3D）的輸出結果：

```bash
python get_2D_3D_script.py \
  --alphapose_script_path /home/ciot/physiotherapy_vghks/2D_and_3D_project/AlphaPose-master/demo_inference.py \
  --motionbert_script_path /home/ciot/physiotherapy_vghks/2D_and_3D_project/MotionBERT-main/infer_wild.py \
  --video_path /home/ciot/physiotherapy_vghks/video/golf2.mp4
```

執行後會在 `alphapose_output/` 與 `motionbert_output/` 產生對應的 2D/3D 資料。

---

### **步驟 2：使用 humanpose.ipynb 產生復健系統比對資料**

開啟 `humanpose.ipynb`：
* 需要改變的地方有
```
charactor = ["DPPatient"]#病人
charactor1 = "DPMentor" #導師
```
* 可輸入導師與學生的動作資料，生成比對用的結果
* 同時可以產生可視化影片，快速確認動作偵測是否正確
