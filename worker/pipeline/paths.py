"""媒體目錄與 charactor 命名的單一定義。

正式檔名 = charactor 名：導師 t{teacher_video_id}、病患 s{submission_id}。
這個名字會貫穿 humanpose_api 的所有下游 artifact 檔名，必須短、唯一、無中文。
"""

from pathlib import Path

from worker import config


def teacher_name(teacher_video_id: int) -> str:
    return f"t{teacher_video_id}"


def submission_name(submission_id: int) -> str:
    return f"s{submission_id}"


def entity_dir(kind: str, entity_id: int) -> Path:
    if kind == "teacher":
        return config.MEDIA_ROOT / "teacher_videos" / str(entity_id)
    if kind == "submission":
        return config.MEDIA_ROOT / "submissions" / str(entity_id)
    raise ValueError(f"unknown kind: {kind}")


def entity_name(kind: str, entity_id: int) -> str:
    return teacher_name(entity_id) if kind == "teacher" else submission_name(entity_id)


def canonical_video(kind: str, entity_id: int) -> Path:
    """轉檔後的正式影片路徑（t{id}.mp4 / s{id}.mp4），下游所有處理只認這支。"""
    return entity_dir(kind, entity_id) / f"{entity_name(kind, entity_id)}.mp4"


def alphapose_dir(kind: str, entity_id: int) -> Path:
    return entity_dir(kind, entity_id) / "alphapose"


def motionbert_dir(kind: str, entity_id: int) -> Path:
    return entity_dir(kind, entity_id) / "motionbert"


def annotation_json(teacher_video_id: int) -> Path:
    return (
        entity_dir("teacher", teacher_video_id)
        / "annotation"
        / f"{teacher_name(teacher_video_id)}.json"
    )


def results_dir(submission_id: int) -> Path:
    return config.MEDIA_ROOT / "results" / str(submission_id)


def jobs_dir() -> Path:
    return config.MEDIA_ROOT / "jobs"


def rel_to_media(path: Path) -> str:
    """絕對路徑 → 相對 MEDIA_ROOT 字串（DB 只存相對路徑，換機器不用改資料）。"""
    return str(path.relative_to(config.MEDIA_ROOT))
