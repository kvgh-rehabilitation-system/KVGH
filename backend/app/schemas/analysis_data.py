"""審核頁儀表板資料（analysis-data 端點）的回應結構。

此 payload 由 results/{id}/scores.json、stair.json、angles.json 衍生，
所有「病患幀 → 各版本影片秒數」都在後端預先算好（前端不做映射數學）。
同時設計為未來 LLM 分析報告的輸入：頂層自帶四分數、summary_text 與關節偏差。
"""

from pydantic import BaseModel


class SegmentOut(BaseModel):
    """一個 TALMA 步驟段：導師/病患幀區間與其在輸出影片中的基準幀。"""

    index: int  # 1-based，對應動作編號
    patient_start: int
    patient_end: int
    mentor_start: int
    mentor_end: int
    plain_base: int  # 該段在 output_plain.mp4 的起始幀
    full_base: int  # 該段在 output.mp4 的起始幀（plain_base + 停留幀累計）


class ActionCardOut(BaseModel):
    """動作分解卡：一個關鍵動作的配對結果與各影片跳轉秒數。"""

    index: int
    similarity: float  # 0~1
    patient_frame: int
    mentor_frame: int
    t_patient: float  # 病患原片秒數
    t_mentor: float | None  # 導師原片秒數（無 fps 時為 None）
    t_plain: float  # 2×2 比對影片秒數（段完成凍結畫面）
    t_full: float  # 完整分析影片秒數（停留幀中段）
    segment: SegmentOut


class CurvePointOut(BaseModel):
    """相似度時間軸的取樣點。"""

    frame: int  # 病患幀
    similarity: float
    t_patient: float
    t_plain: float
    t_full: float


class JointSeriesOut(BaseModel):
    """單一關節的每幀角度偏差序列（與 curve 同一組取樣幀）。"""

    joint: str
    label: str
    values: list[float]  # 度


class JointDeviationSeriesOut(BaseModel):
    frames: list[int]  # 取樣的病患幀
    joints: list[JointSeriesOut]


class MentorInfoOut(BaseModel):
    teacher_video_id: int
    fps: float | None
    frame_count: int | None


class AnalysisDataOut(BaseModel):
    version: int
    submission_id: int
    overall_score: float
    joint_angle_score: float
    stability_score: float
    posture_score: float
    summary_text: str | None
    joint_deviations: list[dict]
    patient_fps: float
    output_fps: float
    mentor: MentorInfoOut | None
    actions: list[ActionCardOut]
    curve: list[CurvePointOut]
    joint_deviation_series: JointDeviationSeriesOut | None
