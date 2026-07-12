"""導師影片標註存檔：以 make_vid_json_api 的可插拔 key_reader 產生演算法標註 JSON。

護理師在網頁上選好重點動作幀後，這裡用「重播式」key_reader 驅動
select_frames——走訪到選定幀回 's'（記錄）、超過最後一幀回 'q'、其餘前進。
如此輸出格式與逐幀有效性都由原標註工具驗證，與演算法完全一致。
"""

import sys

from worker import config
from worker.pipeline import paths

sys.path.insert(0, str(config.ALGORITHM_DIR))

from make_vid_json_api import save_to_json, select_frames  # noqa: E402


class AnnotationError(RuntimeError):
    pass


def _replay_reader(targets: set[int], last: int):
    def reader(frame_count: int, *_args) -> str:
        if frame_count in targets:
            targets.discard(frame_count)  # 標註後游標 +1，避免重複標
            return "s"
        if frame_count > last or not targets:
            return "q"
        return "n"  # 其他鍵 → 下一幀

    return reader


def write_annotation(teacher_video_id: int, frames: list[int]) -> str:
    video = paths.canonical_video("teacher", teacher_video_id)
    if not video.is_file():
        raise AnnotationError(f"找不到導師影片: {video}")
    if not frames:
        raise AnnotationError("標註幀清單為空")

    targets = set(int(f) for f in frames)
    selected = select_frames(str(video), key_reader=_replay_reader(targets, max(targets)))

    if len(selected) != len(frames):
        raise AnnotationError(
            f"標註幀數不符（要求 {len(frames)}、實際 {len(selected)}），"
            "可能有幀號超出影片範圍"
        )

    output = paths.annotation_json(teacher_video_id)
    save_to_json(selected, str(output))
    return paths.rel_to_media(output)
