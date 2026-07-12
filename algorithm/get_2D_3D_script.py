import os
import subprocess
import json
import numpy as np
import math
import argparse
import sys
def modify_alphapose_json(json_data_path):
    data = json.load(open(json_data_path, 'r', encoding='utf-8'))
    blank_frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
    # print(len(data[0]['keypoints']))
    new_data = []
    print(len(data))
    for i in range(len(data)):
        #if i < 100:
        #     print(data[i]['image_id'])
        #print(data[i]['keypoints'])
        reshaped_array = np.array(data[i]['keypoints']).reshape(26, 3)
        distance = math.sqrt((reshaped_array[17][0]  -  reshaped_array[23][0])**2 + (reshaped_array[17][1]  -  reshaped_array[23][1])**2)
        #print("距離為:", distance)
        if distance < 100:
            continue
        else:
            new_data.append(data[i])
            #print("距離為:", distance)
            #print("加入", data[i]['image_id'])
            #print("加入", reshaped_array[17][0], reshaped_array[17][1], reshaped_array[23][0], reshaped_array[23][1])
            #print("加入", data[i]['keypoints'])
        #sys.exit(0)
    print(len(new_data))
    with open(json_data_path, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=4)
def get_npy(alphapose_script_path, motionbert_script_path, video_path, detbatch=1, posebatch=16, qsize=64):
    script_dir = os.path.dirname(alphapose_script_path)
    now_path = os.getcwd()

    if not os.path.exists(os.path.join(now_path, "alphapose_output")):
        os.makedirs(os.path.join(now_path, "alphapose_output"), exist_ok=True)
    alphapose_output_path = os.path.join(now_path, "alphapose_output")

    if not os.path.exists(os.path.join(now_path, "motionbert_output")):
        os.makedirs(os.path.join(now_path, "motionbert_output"), exist_ok=True)
    motionbert_output_path = os.path.join(now_path, "motionbert_output")

    print(f"[2D3D] AlphaPose start: {video_path}", flush=True)
    subprocess.run(
        [
            sys.executable,
            "demo_inference.py",
            "--outdir",
            alphapose_output_path,
            "--video",
            video_path,
            "--sp",
            "--detbatch",
            str(detbatch),
            "--posebatch",
            str(posebatch),
            "--qsize",
            str(qsize),
        ],
        cwd=script_dir,
        check=True
    )
    print(f"[2D3D] AlphaPose done: {video_path}", flush=True)
    modify_alphapose_json(os.path.join(alphapose_output_path, os.path.basename(video_path).replace('.mp4','.json')))
    script_dir = os.path.dirname(motionbert_script_path)
    
    print(f"[2D3D] MotionBERT start: {video_path}", flush=True)
    subprocess.run(
        [sys.executable, "infer_wild.py", 
        "-o", motionbert_output_path,
        "-j", os.path.join(alphapose_output_path, os.path.basename(video_path).replace('.mp4','.json')),
        "-v", video_path],
        cwd=script_dir,
        check=True
    )
    print(f"[2D3D] MotionBERT done: {video_path}", flush=True)

if __name__ == "__main__":
    #######################請填寫絕對路徑，不然會報錯########################
    #alphapose_script_path 為 AlphaPose 專案的 demo_inference.py 的絕對路徑
    #motionbert_script_path 為 MotionBERT 專案的 infer_wild.py 的絕對路徑
    #video_path 為要處理的影片的絕對路徑
    #執行時會自動產生兩個輸出資料夾，分別為 alphapose_output 和 motionbert_output
    
    # get_npy(alphapose_script_path="/home/boris/AlphaPose-master/demo_inference.py",
    #         motionbert_script_path="/home/boris/MotionBERT-main/infer_wild.py",
    #         video_path="/home/boris/auto_alphapose_motionbert/golf2.mp4")

    parser = argparse.ArgumentParser(description="Process video with AlphaPose and MotionBERT.")
    parser.add_argument('--alphapose_script_path', type=str, required=True, help='Absolute path to AlphaPose demo_inference.py')
    parser.add_argument('--motionbert_script_path', type=str, required=True, help='Absolute path to MotionBERT infer_wild.py')
    parser.add_argument('--video_path', type=str, required=True, help='Absolute path to the video file')
    # AlphaPose 批次參數為 per-node 固定配置：與 GPU VRAM 預算一起校準，不可隨影片調整。
    parser.add_argument('--detbatch', type=int, default=1, help='AlphaPose detection batch size')
    parser.add_argument('--posebatch', type=int, default=16, help='AlphaPose pose estimation batch size')
    parser.add_argument('--qsize', type=int, default=64, help='AlphaPose frame queue size')
    args = parser.parse_args()
    # print("AlphaPose script path:", args.alphapose_script_path)
    # print("MotionBERT script path:", args.motionbert_script_path)
    get_npy(
        alphapose_script_path=args.alphapose_script_path,
        motionbert_script_path=args.motionbert_script_path,
        video_path=args.video_path,
        detbatch=args.detbatch,
        posebatch=args.posebatch,
        qsize=args.qsize
    )
