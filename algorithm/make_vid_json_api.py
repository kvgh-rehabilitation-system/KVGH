import argparse
import json
import os
import sys
from typing import Any, Callable, Optional

import cv2

###############################################################
# 使用方法:
# 1. 將影片檔案放置於 mp4 資料夾中
# 2. 以 api 或 command line 呼叫 make_vid_json_api.py 並指定 video_path
# 3. 按下 's' 鍵標註當前 frame，按下 'a' 鍵回到前一個 frame，按下 'b' 鍵回到前 10 幀，
#    按下 'f' 鍵前進 10 幀，按下任何其他鍵則移動到下一幀
# 4. 按下 'q' 鍵退出標註
# 5. 標註完成後，結果的json檔會被儲存到 json 資料夾中 (檔名與影片相同)
###############################################################


def _read_single_key(prompt: str = "") -> str:
    """Read a single character from stdin without requiring Enter."""
    if prompt:
        print(prompt, end="", flush=True)
    try:
        import termios
        import tty

        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            char = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        print(char)
        return char
    except (ImportError, OSError, AttributeError):
        # Fallback to regular input
        char = input().strip()[:1]
        return char


def default_key_reader(frame_count: int, *_args) -> int:
    """Default headless key reader that keeps the original 's/a/q' semantics."""
    prompt = (
        f"[Frame {frame_count}] action "
        "(s=select, a=prev, b=prev10, f=next10, q=quit, other=next): "
    )
    key = _read_single_key(prompt)
    return ord(key.lower()) if key else -1


def select_frames(
    video_path: str,
    key_reader: Optional[Callable[[int, Optional[Any]], int]] = None,
) -> list:
    """
    Headless frame selection that reproduces the original key logic.

    key_reader 必須回傳單一按鍵 (int 或 str)，預設會使用 terminal input 以維持 's/a/q' 操作。
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video file: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    frame_count = 0
    selected_frames = []
    key_reader = key_reader or default_key_reader

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count)
        ret, frame = cap.read()

        if not ret:
            frame_count = max(0, frame_count - 1)
            continue

        key = key_reader(frame_count, frame)
        if isinstance(key, str) and key:
            key_code = ord(key.lower())
        elif isinstance(key, int):
            key_code = key
        else:
            key_code = -1

        if key_code == ord('s'):
            selected_frames.append({"frameCount": str(frame_count), "videoId": video_path})
            print(f"Frame {frame_count} selected.")
            frame_count += 1
        elif key_code == ord('a'):
            frame_count = max(0, frame_count - 1)
        elif key_code == ord('b'):
            frame_count = max(0, frame_count - 10)
        elif key_code == ord('f'):
            if total_frames > 0:
                frame_count = min(total_frames - 1, frame_count + 10)
            else:
                frame_count += 10
        elif key_code == ord('q'):
            break
        else:
            frame_count += 1

    cap.release()
    return selected_frames


def save_to_json(data, output_path):
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=4)


def derive_output_path(video_path: str, output_dir: str = "json") -> str:
    basename = os.path.splitext(os.path.basename(video_path))[0]
    return os.path.join(output_dir, f"{basename}.json")


def annotate_video(video_path: str, output_dir: str = "json", key_reader=None) -> str:
    selected_frames = select_frames(video_path, key_reader=key_reader)
    output_path = derive_output_path(video_path, output_dir)
    save_to_json(selected_frames, output_path)
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Headless frame selector for rehab videos.")
    parser.add_argument(
        "--video_path",
        default='mp4/DPPatientLeft.mp4',
        help="影片檔案路徑 (預設: mp4/DPPatientLeft.mp4)",
    )
    parser.add_argument(
        "--output_dir",
        default="json",
        help="輸出 json 的資料夾 (預設: json)",
    )
    args = parser.parse_args()

    output_path = annotate_video(args.video_path, args.output_dir)
    print(f"Data saved to {output_path}")


if __name__ == "__main__":
    main()
