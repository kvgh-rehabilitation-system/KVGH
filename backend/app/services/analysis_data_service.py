"""審核頁儀表板資料：由 results/{id} 的演算法產物 JSON 衍生。

幀↔秒數映射依據 humanpose_api.py 的影片合成邏輯（詳見 worker/CLAUDE.md）：
- 兩支輸出影片皆為 30fps；每個 TALMA 步驟寫 max(Δmentor, Δpatient) 幀，先到者凍結
- output.mp4（完整版）每步驟後額外停留 HOLD_FRAMES 幀，output_plain.mp4 沒有
- 影片合成包含**全部** TALMA 步驟（歷史上曾寫死只做前 11 步，VERSION 2 起已移除；
  舊影片需重新分析才涵蓋 12+ 步）
- 病患幀超過最後一步後不再出現於輸出影片 → 夾到影片結尾

首次計算後快取到 results/{id}/dashboard.json；scores.json 更新（重新分析）
或 VERSION 提升時自動重算。VERSION 需在 payload 結構或映射邏輯變動時 +1。
"""

import json
import math
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.submission import VideoSubmission
from app.models.teacher_video import TeacherVideo
from app.services import media_service

VERSION = 2
OUTPUT_FPS = 30.0  # humanpose_api.py 寫死的輸出影片 fps
HOLD_FRAMES = 60  # 完整版每步驟後的停留幀數
MAX_CURVE_POINTS = 600

# ALPS 角度 id ↔ 儀表板 8 關節（與 humanpose_api.py A_TO_JOINT 一致）
ANGLE_TO_JOINT = {
    "a3": ("left_shoulder", "左肩"),
    "a4": ("left_elbow", "左肘"),
    "a6": ("right_shoulder", "右肩"),
    "a7": ("right_elbow", "右肘"),
    "a12": ("left_hip", "左髖"),
    "a13": ("left_knee", "左膝"),
    "a15": ("right_hip", "右髖"),
    "a16": ("right_knee", "右膝"),
}


def _load_json(path: Path):
    """讀取 UTF-8 JSON 檔（演算法產物一律此編碼）。"""
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _cos_to_deg(value: float) -> float:
    """cos 值 → 角度（度）。先夾到 [-1,1] 防浮點誤差讓 acos 拋 domain error。"""
    return math.degrees(math.acos(max(-1.0, min(1.0, value))))


def _build_segments(steps: list[int], mentor_hlt: list[int]) -> list[dict]:
    """由 stair.json 的步驟切點建段表——所有幀映射的共同基礎。

    Args:
        steps: 病患影片各 TALMA 步驟的結束幀（遞增）
        mentor_hlt: 導師影片對應的結束幀（與 steps 等長、一一配對）
    Returns:
        每段含病患/導師幀區間與該段在兩支輸出影片的起始幀：
        plain_base 累加各段 max(Δp, Δm)（合成時先到者凍結、以較長者為準），
        full_base 再加上前面每段結尾的 HOLD_FRAMES 停留。
    """
    segments = []
    p_prev, m_prev, plain_base = 0, 0, 0
    for k, (p_k, m_k) in enumerate(zip(steps, mentor_hlt), start=1):
        segments.append(
            {
                "index": k,
                "patient_start": p_prev,
                "patient_end": p_k,
                "mentor_start": m_prev,
                "mentor_end": m_k,
                "plain_base": plain_base,
                "full_base": plain_base + HOLD_FRAMES * (k - 1),
            }
        )
        plain_base += max(p_k - p_prev, m_k - m_prev)
        p_prev, m_prev = p_k, m_k
    return segments


def _locate_segment(segments: list[dict], patient_frame: int) -> dict | None:
    """病患幀所屬的段；超過最後一步回 None（輸出影片中不存在）。"""
    for seg in segments:
        if patient_frame <= seg["patient_end"]:
            return seg
    return None


def _seg_len(seg: dict) -> int:
    return max(
        seg["patient_end"] - seg["patient_start"],
        seg["mentor_end"] - seg["mentor_start"],
    )


def _mentor_frame_for(segments: list[dict], patient_frame: int) -> int:
    """病患幀 → 時間對齊的導師幀（與影片合成同邏輯：平行推進、先到者凍結）。"""
    seg = _locate_segment(segments, patient_frame)
    if seg is None:
        return segments[-1]["mentor_end"]
    return seg["mentor_start"] + min(
        patient_frame - seg["patient_start"], seg["mentor_end"] - seg["mentor_start"]
    )


def _frame_times(segments: list[dict], patient_frame: int) -> tuple[float, float]:
    """病患幀 → (t_plain, t_full)。超過最後一步夾到影片結尾。"""
    seg = _locate_segment(segments, patient_frame)
    if seg is None:
        last = segments[-1]
        plain_end = last["plain_base"] + _seg_len(last)
        return plain_end / OUTPUT_FPS, (last["full_base"] + _seg_len(last) + HOLD_FRAMES) / OUTPUT_FPS
    offset = min(patient_frame - seg["patient_start"], _seg_len(seg) - 1)
    return (
        (seg["plain_base"] + offset) / OUTPUT_FPS,
        (seg["full_base"] + offset) / OUTPUT_FPS,
    )


def _build_payload(db: Session, sub: VideoSubmission) -> dict:
    """從 results/{id} 的演算法產物組出審核頁儀表板 payload（無快取，由呼叫端包）。"""
    # scores.json（相似度/配對）與 stair.json（步驟切點）缺一不可；
    # seed 假資料磁碟無檔案，走到這裡就是 404（前端會降級顯示）
    results = media_service.results_dir(sub.id)
    scores_path = results / "scores.json"
    stair_path = results / "stair.json"
    if not scores_path.is_file() or not stair_path.is_file():
        raise HTTPException(status_code=404, detail="演算法比對明細不存在")

    scores = _load_json(scores_path)
    stair = _load_json(stair_path)
    analysis = sub.analysis
    metrics = (analysis.metrics or {}) if analysis else {}

    # 建段表：所有「病患幀 → 各影片秒數」映射的基礎
    steps: list[int] = stair["steps"]
    mentor_hlt: list[int] = stair["mentor_hlt"]
    similarity_seq: list[float] = scores["similarity_seq"]
    segments = _build_segments(steps, mentor_hlt)

    # 病患原片 fps 取自 metrics（轉檔時記錄）；缺值時退回輸出 fps 免除以零
    patient_fps = float(
        (metrics.get("motion_sequence") or {}).get("fps") or OUTPUT_FPS
    )
    # 導師影片資訊（可能已被刪，全部容錯為 None）
    mentor_info = None
    mentor_fps = None
    if sub.teacher_video_id:
        tv = db.get(TeacherVideo, sub.teacher_video_id)
        if tv:
            mentor_fps = tv.fps
            mentor_info = {
                "teacher_video_id": tv.id,
                "fps": tv.fps,
                "frame_count": tv.frame_count,
            }

    # 動作分解卡：跳到「段完成的凍結畫面」（完整版停在停留幀中段，可看到相似度標註）
    actions = []
    for match, seg in zip(scores["matches"], segments):
        seg_len = _seg_len(seg)
        actions.append(
            {
                "index": seg["index"],
                "similarity": match["similarity"],
                "patient_frame": match["patient_frame"],
                "mentor_frame": match["mentor_frame"],
                "t_patient": match["patient_frame"] / patient_fps,
                "t_mentor": (match["mentor_frame"] / mentor_fps) if mentor_fps else None,
                "t_plain": (seg["plain_base"] + seg_len - 1) / OUTPUT_FPS,
                "t_full": (seg["full_base"] + seg_len + HOLD_FRAMES // 4) / OUTPUT_FPS,
                "segment": seg,
            }
        )

    # 相似度曲線降採樣到 MAX_CURVE_POINTS 點以內（60fps 長片可達數千幀，前端畫不動）
    stride = max(1, math.ceil(len(similarity_seq) / MAX_CURVE_POINTS))
    sample_frames = list(range(0, len(similarity_seq), stride))
    curve = []
    for frame in sample_frames:
        t_plain, t_full = _frame_times(segments, frame)
        curve.append(
            {
                "frame": frame,
                "similarity": round(similarity_seq[frame], 4),
                "t_patient": round(frame / patient_fps, 3),
                "t_plain": round(t_plain, 3),
                "t_full": round(t_full, 3),
            }
        )

    # 每幀關節偏差序列（angles.json 5MB+，缺檔容忍）。
    # all_frames[i] 的 mentor/patient 各是「自己影片」的第 i 幀（導師較短，超過即缺
    # mentor 鍵），因此需用段表把病患幀映射到時間對齊的導師幀後再相減。
    joint_series = None
    angles_path = results / "angles.json"
    if angles_path.is_file():
        all_frames = _load_json(angles_path).get("all_frames") or []
        if all_frames:
            mentor_deg: dict[str, list[float]] = {a: [] for a in ANGLE_TO_JOINT}
            patient_deg: dict[str, list[float]] = {a: [] for a in ANGLE_TO_JOINT}
            for fr in all_frames:
                for entry in fr["angles"]:
                    aid = entry["id"]
                    if aid not in ANGLE_TO_JOINT:
                        continue
                    if "mentor" in entry:
                        mentor_deg[aid].append(_cos_to_deg(entry["mentor"]))
                    patient_deg[aid].append(_cos_to_deg(entry["patient"]))

            frames_used = [f for f in sample_frames if f < len(all_frames)]
            joints = []
            for aid, (joint, label) in ANGLE_TO_JOINT.items():
                m_series, p_series = mentor_deg[aid], patient_deg[aid]
                values = []
                for frame in frames_used:
                    m_frame = min(
                        _mentor_frame_for(segments, frame), len(m_series) - 1
                    )
                    values.append(round(abs(m_series[m_frame] - p_series[frame]), 1))
                joints.append({"joint": joint, "label": label, "values": values})
            joint_series = {"frames": frames_used, "joints": joints}

    return {
        "version": VERSION,
        "submission_id": sub.id,
        "overall_score": analysis.overall_score if analysis else 0.0,
        "joint_angle_score": analysis.joint_angle_score if analysis else 0.0,
        "stability_score": analysis.stability_score if analysis else 0.0,
        "posture_score": analysis.posture_score if analysis else 0.0,
        "summary_text": analysis.summary_text if analysis else None,
        "joint_deviations": metrics.get("joint_deviations") or [],
        "patient_fps": patient_fps,
        "output_fps": OUTPUT_FPS,
        "mentor": mentor_info,
        "actions": actions,
        "curve": curve,
        "joint_deviation_series": joint_series,
    }


def get_analysis_data(db: Session, submission_id: int) -> dict:
    """審核頁儀表板資料（帶 dashboard.json 檔案快取）。

    快取有效條件：快取比 scores.json 新（重新分析會更新 scores 的 mtime）
    且 version 與當前程式一致（payload 結構改動時 VERSION +1 使其失效）。
    """
    sub = db.get(VideoSubmission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="上傳紀錄不存在")

    # 快取命中檢查：mtime 比對 + version 比對，兩關都過才直接回快取
    results = media_service.results_dir(submission_id)
    cache_path = results / "dashboard.json"
    scores_path = results / "scores.json"
    if (
        cache_path.is_file()
        and scores_path.is_file()
        and cache_path.stat().st_mtime >= scores_path.stat().st_mtime
    ):
        cached = _load_json(cache_path)
        if cached.get("version") == VERSION:
            return cached

    # 未命中：重算並寫回快取
    payload = _build_payload(db, sub)
    try:
        with cache_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
    except OSError:
        pass  # 快取寫入失敗不影響回應
    return payload
