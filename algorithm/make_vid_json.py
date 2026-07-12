import cv2
import json
###############################################################
# 使用方法:
# 1. 將影片檔案放置於 mp4 資料夾中
# 2. 執行 make_vid_json.py
# 3. 按下 's' 鍵標註當前 frame，按下 'a' 鍵回到前一個 frame，按下任何其他鍵則移動到下一幀
# 4. 按下 'q' 鍵退出標註
# 5. 標註完成後，結果的json檔會被儲存到 json 資料夾中
###############################################################


def select_frames(video_path, window_name='Video Frame', window_width=800, window_height=600):
    # 開啟影片檔案
    cap = cv2.VideoCapture(video_path)
    
    frame_count = 0
    selected_frames = []

    # 創建並調整視窗大小
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, window_width, window_height)

    while True:
        # 設置影片的當前位置為 frame_count 幀
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count)
        ret, frame = cap.read()
        
        if not ret:
            frame_count = max(0, frame_count - 1)
            continue
            #break

        # 顯示當前 frame
        cv2.imshow(window_name, frame)
        
        # 等待用戶按鍵操作
        key = cv2.waitKey()
        
        if key == ord('s'):  # 如果按下 's' 鍵，則標註當前 frame
            selected_frames.append({"frameCount": str(frame_count), "videoId": video_path})
            print(f"Frame {frame_count} selected.")
            frame_count += 1  # 移動到下一幀

        elif key == ord('a'):  # 如果按下 'a' 鍵，則回到前一個 frame
            frame_count = max(0, frame_count - 1)

        elif key == ord('q'):  # 按下 'q' 鍵則退出標註
            break

        else:  # 其他按鍵則移動到下一幀
            frame_count += 1

    cap.release()
    cv2.destroyAllWindows()

    return selected_frames

def save_to_json(data, output_path):
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=4)

def main():
    video_path = 'mp4/DPPatientLeft.mp4'
    output_json = 'json/DPPatientLeft.json'
    
    # 設定視窗大小
    window_width = 800
    window_height = 600
    
    selected_frames = select_frames(video_path, window_width=window_width, window_height=window_height)
    save_to_json(selected_frames, output_json)
    print(f"Data saved to {output_json}")

if __name__ == "__main__":
    main()
