"""種子資料：預設只建帳號（3 醫、3 護、20 病患），加 --demo 才建假臨床資料。

執行：python -m app.seed          # 只建帳號
      python -m app.seed --demo   # 帳號 + 模擬看診/計畫/影片分數（motion_sequence 供 3D 重播）
"""

import random
import sys
from datetime import date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.ensure_schema import ensure_schema
from app.db.session import SessionLocal, engine
from app.models.patient import Patient
from app.models.rehab_plan import PlanItem, PlanVersion, RehabPlan
from app.models.submission import AnalysisResult, NurseReport, VideoSubmission
from app.models.user import User
from app.models.visit import Visit

TODAY = date.today()
PASSWORD_HASH = hash_password("1234")
RNG = random.Random(42)

# (name, frequency, times_per_week, description, precaution, example_video_url, example_video_note)
LUMBAR_ITEMS = [
    ("腰部伸展", "每週 3 次", 3, "坐姿與站姿腰部伸展，每次 15 分鐘", "動作放慢，避免快速扭轉",
     "/videos/examples/lumbar-stretch.mp4", "示範坐姿與站姿兩種伸展，注意骨盆保持中立"),
    ("核心橋式", "每週 3 次", 3, "仰臥橋式 2 組，每組 10 次", "避免腰部過度上拱",
     "/videos/examples/core-bridge.mp4", "臀部抬起時停留 3 秒，注意呼吸節奏"),
    ("貓牛式伸展", "每週 2 次", 2, "四足跪姿脊椎活動，每次 10 分鐘", "手腕不適時改用拳頭支撐",
     None, None),
]
SHOULDER_ITEMS = [
    ("肩關節鐘擺運動", "每週 3 次", 3, "身體前傾放鬆擺動患側手臂，每次 10 分鐘", "擺動幅度由小到大",
     "/videos/examples/shoulder-pendulum.mp4", "身體前傾約 90 度，手臂完全放鬆自然擺動"),
    ("彈力帶外旋訓練", "每週 3 次", 3, "手肘貼緊身體外旋 3 組，每組 12 次", "出現刺痛立即停止",
     "/videos/examples/band-external-rotation.mp4", "手肘夾緊毛巾，僅前臂旋轉"),
    ("爬牆運動", "每週 2 次", 2, "面牆手指向上爬行，每次 10 分鐘", "以不引發劇痛的高度為限",
     None, None),
]
KNEE_ITEMS = [
    ("股四頭肌訓練", "每週 3 次", 3, "坐姿膝伸直 3 組，每組 10 次", "膝蓋不過度彎曲",
     "/videos/examples/quad-setting.mp4", "膝窩下壓毛巾捲，大腿前側用力"),
    ("直腿抬高", "每週 3 次", 3, "仰臥直腿抬高 3 組，每組 10 次", "腰部貼平地面",
     "/videos/examples/straight-leg-raise.mp4", "腳尖朝上，抬至 45 度停留 3 秒"),
    ("靠牆半蹲", "每週 2 次", 2, "背靠牆緩慢下蹲至半蹲，每次 8 下", "膝蓋不超過腳尖",
     None, None),
]
NECK_ITEMS = [
    ("頸部伸展", "每週 3 次", 3, "左右側彎與前後伸展，每次 10 分鐘", "避免快速轉頭",
     "/videos/examples/neck-stretch.mp4", "每個方向停留 15 秒，肩膀保持放鬆"),
    ("肩胛收縮運動", "每週 3 次", 3, "雙肩向後夾緊 3 組，每組 12 次", "配合呼吸節奏",
     None, None),
]
BALANCE_ITEM = (
    "平衡訓練", "每週 2 次", 2, "單腳站立，每次 10 分鐘", "旁人陪同注意跌倒",
    None, None,
)

# 3D 重播用的關節（與未來姿勢估計輸出對齊）
MOTION_JOINTS = [
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
]
JOINT_LABELS = {
    "left_shoulder": "左肩", "right_shoulder": "右肩",
    "left_elbow": "左肘", "right_elbow": "右肘",
    "left_hip": "左髖", "right_hip": "右髖",
    "left_knee": "左膝", "right_knee": "右膝",
}


def user(db: Session, username: str, role: str, name: str, title: str | None = None) -> User:
    u = User(username=username, password_hash=PASSWORD_HASH, role=role, name=name, title=title)
    db.add(u)
    db.flush()
    return u


def patient(
    db: Session,
    username: str,
    number: str,
    name: str,
    birth: str,
    gender: str,
    phone: str,
) -> Patient:
    u = user(db, username, "patient", name)
    p = Patient(
        user_id=u.id,
        patient_number=number,
        name=name,
        birth_date=date.fromisoformat(birth),
        gender=gender,
        phone=phone,
    )
    db.add(p)
    db.flush()
    return p


def visit(
    db: Session,
    p: Patient,
    doctor: User,
    days_ago: int,
    visit_type: str,
    chief: str,
    diagnosis: str,
    assessment: str,
    decision: str,
    follow_up_days: int | None = None,
    status: str = "COMPLETED",
) -> Visit:
    d = TODAY - timedelta(days=days_ago)
    v = Visit(
        patient_id=p.id,
        doctor_id=doctor.id,
        visit_date=d,
        status=status,
        visit_type=visit_type,
        chief_complaint=chief if status == "COMPLETED" else None,
        diagnosis=diagnosis if status == "COMPLETED" else None,
        assessment=assessment if status == "COMPLETED" else None,
        rehab_decision=decision if status == "COMPLETED" else None,
        follow_up_date=d + timedelta(days=follow_up_days) if follow_up_days else None,
    )
    db.add(v)
    db.flush()
    return v


def _add_items(db: Session, version_id: int, items: list[tuple]) -> None:
    for n, f, tpw, desc, pre, url, note in items:
        db.add(
            PlanItem(
                version_id=version_id,
                name=n,
                frequency=f,
                times_per_week=tpw,
                description=desc,
                precaution=pre,
                example_video_url=url,
                example_video_note=note,
            )
        )


def plan(
    db: Session,
    p: Patient,
    doctor: User,
    nurse: User,
    name: str,
    status: str,
    start_days_ago: int,
    eval_in_days: int | None,
    goals: list[str],
    items: list[tuple],
    adjust: dict | None = None,
) -> RehabPlan:
    """adjust: {"days_ago": n, "summary": str, "items": [...], "goals": [...]}（建立 V2）"""
    start = TODAY - timedelta(days=start_days_ago)
    pl = RehabPlan(
        patient_id=p.id,
        doctor_id=doctor.id,
        nurse_id=nurse.id,
        name=name,
        status=status,
        start_date=start,
        evaluation_date=TODAY + timedelta(days=eval_in_days) if eval_in_days is not None else None,
    )
    db.add(pl)
    db.flush()

    v1_end = TODAY - timedelta(days=adjust["days_ago"]) if adjust else None
    v1 = PlanVersion(
        plan_id=pl.id,
        version=1,
        goals=goals,
        started_at=start,
        ended_at=v1_end,
        is_current=adjust is None,
    )
    db.add(v1)
    db.flush()
    _add_items(db, v1.id, items)

    if adjust:
        v2 = PlanVersion(
            plan_id=pl.id,
            version=2,
            goals=adjust.get("goals", goals),
            change_summary=adjust["summary"],
            started_at=TODAY - timedelta(days=adjust["days_ago"]),
            is_current=True,
        )
        db.add(v2)
        db.flush()
        _add_items(db, v2.id, adjust["items"])
    db.flush()
    return pl


def current_version(db: Session, pl: RehabPlan) -> PlanVersion:
    return (
        db.query(PlanVersion)
        .filter(PlanVersion.plan_id == pl.id, PlanVersion.is_current.is_(True))
        .one()
    )


# ---- 模擬演算法 ----

def _motion_sequence(score: float, seconds: int = 6, fps: int = 10) -> dict:
    """依分數產生關節角度時間序列：分數越低，抖動與偏差越大。"""
    frames = []
    noise = (100 - score) * 0.35  # 分數 90 → 抖動小；分數 55 → 明顯不穩
    total = seconds * fps
    import math

    for f in range(total):
        t = f / fps
        row = []
        for j, joint in enumerate(MOTION_JOINTS):
            base = 30 * math.sin(2 * math.pi * (t / 3.0) + j * 0.7)
            row.append(round(base + RNG.uniform(-noise, noise), 1))
        frames.append(row)
    return {"fps": fps, "joints": MOTION_JOINTS, "frames": frames}


def _joint_deviations(score: float) -> list[dict]:
    """挑 1-3 個關節給偏差值；分數越低偏差越大。"""
    n_bad = 0 if score >= 85 else (1 if score >= 72 else (2 if score >= 60 else 3))
    bad = RNG.sample(MOTION_JOINTS, n_bad) if n_bad else []
    rows = []
    for joint in MOTION_JOINTS:
        if joint in bad:
            dev = round(RNG.uniform(9, 22) * (1 + (75 - min(score, 75)) / 100), 1)
            status = "HIGH"
        else:
            dev = round(RNG.uniform(1, 6), 1)
            status = "OK"
        rows.append(
            {
                "joint": joint,
                "label": JOINT_LABELS[joint],
                "deviation_deg": dev,
                "status": status,
            }
        )
    return rows


def _summary_text(score: float, item_name: str) -> str:
    if score >= 85:
        return f"「{item_name}」動作標準度高，關節軌跡與範例影片高度一致，請保持目前品質。"
    if score >= 72:
        return f"「{item_name}」整體完成度良好，少數關節角度略有偏差，建議放慢動作節奏。"
    if score >= 60:
        return f"「{item_name}」動作穩定度不足，多個關節角度與範例落差明顯，建議對照範例影片修正姿勢。"
    return f"「{item_name}」動作偏差較大且不穩定，建議護理師確認影片並指導修正，必要時回報醫生。"


def add_submission(
    db: Session,
    pl: RehabPlan,
    nurse: User,
    days_ago: int,
    hour: int,
    score: float | None,
    item_index: int = 0,
    status: str = "REVIEWED",
    decision: str | None = None,
    feedback: str | None = None,
    reviewed_days_ago: int | None = None,
) -> VideoSubmission:
    """score=None 代表 ANALYZING（尚無分析結果）。"""
    version = current_version(db, pl)
    items = version.items
    item = items[item_index % len(items)]
    submitted = datetime.combine(TODAY - timedelta(days=days_ago), datetime.min.time()) + timedelta(
        hours=hour, minutes=RNG.randint(0, 50)
    )
    sub = VideoSubmission(
        plan_id=pl.id,
        plan_version_id=version.id,
        plan_item_id=item.id,
        patient_id=pl.patient_id,
        submitted_at=submitted,
        video_url=f"/videos/submissions/p{pl.patient_id:03d}-{item.id}-{days_ago}.mp4",
        duration_seconds=RNG.randint(45, 180),
        status=status,
        analysis_status="DONE" if score is not None else "PENDING",
    )
    db.add(sub)
    db.flush()

    if score is not None:
        jitter = lambda: RNG.uniform(-4, 4)  # noqa: E731
        clamp = lambda v: round(max(30, min(99, v)), 1)  # noqa: E731
        db.add(
            AnalysisResult(
                submission_id=sub.id,
                analyzed_at=submitted + timedelta(minutes=RNG.randint(3, 12)),
                overall_score=clamp(score),
                joint_angle_score=clamp(score + jitter()),
                stability_score=clamp(score + jitter()),
                posture_score=clamp(score + jitter()),
                metrics={
                    "joint_deviations": _joint_deviations(score),
                    "motion_sequence": _motion_sequence(score),
                },
                summary_text=_summary_text(score, item.name),
            )
        )

    if status == "REVIEWED":
        if decision is None:
            decision = "APPROVED" if (score or 0) >= 65 else "NEEDS_ATTENTION"
        sub.decision = decision
        sub.reviewed_by = nurse.id
        r_days = reviewed_days_ago if reviewed_days_ago is not None else max(days_ago - 1, 0)
        sub.reviewed_at = datetime.combine(
            TODAY - timedelta(days=r_days), datetime.min.time()
        ) + timedelta(hours=hour + 3)
        sub.feedback = feedback or (
            "動作標準，繼續保持！" if decision == "APPROVED"
            else "動作偏差較大，請對照範例影片放慢速度，下次上傳前先熱身。"
        )
    db.flush()
    return sub


def submission_series(
    db: Session,
    pl: RehabPlan,
    nurse: User,
    series: list[tuple],
    pending_last: int = 0,
):
    """series: [(days_ago, score)]，輪流指派動作項目。

    pending_last: 最後 N 筆維持 PENDING_REVIEW（進審核佇列）。
    """
    total = len(series)
    for idx, (days_ago, score) in enumerate(series):
        is_pending = idx >= total - pending_last
        add_submission(
            db,
            pl,
            nurse,
            days_ago=days_ago,
            hour=8 + (idx % 3) * 4,
            score=score,
            item_index=idx,
            status="PENDING_REVIEW" if is_pending else "REVIEWED",
        )


def report(
    db: Session,
    pl: RehabPlan,
    nurse: User,
    kind: str,
    severity: str,
    content: str,
    days_ago: int = 0,
    submission: VideoSubmission | None = None,
    status: str = "PENDING_DOCTOR_REVIEW",
    doctor_comment: str | None = None,
) -> NurseReport:
    r = NurseReport(
        plan_id=pl.id,
        submission_id=submission.id if submission else None,
        nurse_id=nurse.id,
        kind=kind,
        severity=severity,
        content=content,
        created_at=datetime.combine(TODAY - timedelta(days=days_ago), datetime.min.time())
        + timedelta(hours=16),
        status=status,
        doctor_comment=doctor_comment,
    )
    db.add(r)
    db.flush()
    return r


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)
    demo = "--demo" in sys.argv
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("資料庫已有資料，略過 seeding。")
            return
        staff, patients = seed_accounts(db)
        if demo:
            seed_demo(db, staff, patients)
        db.commit()
        print(
            "Seed 完成（{}）。帳號：admin01 / doctor01-03 / nurse01-03 / patient01-20，密碼 1234".format(
                "帳號 + demo 假資料" if demo else "僅帳號"
            )
        )
    finally:
        db.close()


def seed_accounts(db: Session) -> tuple[dict[str, User], dict[str, Patient]]:
    """只建帳號：1 位管理員 + 6 位醫護 + 20 位病患（User+Patient），不含任何臨床假資料。"""
    # ---- 系統管理員 ----
    user(db, "admin01", "admin", "系統管理員", "系統管理員")

    # ---- 醫護人員 ----
    d1 = user(db, "doctor01", "doctor", "王志遠", "復健科主治醫師")
    d2 = user(db, "doctor02", "doctor", "陳怡蓁", "復健科主治醫師")
    d3 = user(db, "doctor03", "doctor", "李承翰", "復健科住院醫師")
    n1 = user(db, "nurse01", "nurse", "林佳穎", "復健科護理師")
    n2 = user(db, "nurse02", "nurse", "張淑婷", "復健科護理師")
    n3 = user(db, "nurse03", "nurse", "黃詩涵", "復健科護理師")

    # ---- 病患 ----
    p01 = patient(db, "patient01", "P000001", "王小明", "1981-03-12", "MALE", "0912-345-678")
    p02 = patient(db, "patient02", "P000002", "陳美惠", "1990-07-22", "FEMALE", "0922-111-222")
    p03 = patient(db, "patient03", "P000003", "林大偉", "1965-01-30", "MALE", "0933-222-333")
    p04 = patient(db, "patient04", "P000004", "張秀英", "1958-11-05", "FEMALE", "0955-333-444")
    p05 = patient(db, "patient05", "P000005", "李志明", "1972-06-18", "MALE", "0966-444-555")
    p06 = patient(db, "patient06", "P000006", "吳淑芬", "1985-09-09", "FEMALE", "0977-555-666")
    p07 = patient(db, "patient07", "P000007", "劉建宏", "1969-04-25", "MALE", "0988-666-777")
    p08 = patient(db, "patient08", "P000008", "蔡雅婷", "1993-12-01", "FEMALE", "0910-777-888")
    p09 = patient(db, "patient09", "P000009", "鄭文雄", "1954-08-15", "MALE", "0921-888-999")
    p10 = patient(db, "patient10", "P000010", "許麗華", "1988-02-14", "FEMALE", "0931-999-000")
    p11 = patient(db, "patient11", "P000011", "楊承翰", "1996-05-06", "MALE", "0941-123-456")
    p12 = patient(db, "patient12", "P000012", "賴品妤", "1979-10-27", "FEMALE", "0951-234-567")
    p13 = patient(db, "patient13", "P000013", "郭俊廷", "1983-03-03", "MALE", "0961-345-678")
    p14 = patient(db, "patient14", "P000014", "周雅雯", "1998-06-30", "FEMALE", "0971-456-789")
    p15 = patient(db, "patient15", "P000015", "曾國豪", "1962-12-20", "MALE", "0981-567-890")
    p16 = patient(db, "patient16", "P000016", "邱怡君", "1987-04-11", "FEMALE", "0991-678-901")
    p17 = patient(db, "patient17", "P000017", "洪偉哲", "1975-07-07", "MALE", "0911-789-012")
    p18 = patient(db, "patient18", "P000018", "簡淑娟", "1968-09-18", "FEMALE", "0923-890-123")
    p19 = patient(db, "patient19", "P000019", "潘俊宇", "1992-01-23", "MALE", "0935-901-234")
    p20 = patient(db, "patient20", "P000020", "江美玲", "1980-08-08", "FEMALE", "0945-012-345")

    # media/ 磁碟保留了舊產物（submissions/74、results/74、teacher_videos/2），
    # 而 worker pipeline 有「產物已存在即短路重用」機制——讓新資料的 id 跳過舊目錄，
    # 避免新影片直接吃到舊分析結果
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("ALTER SEQUENCE video_submissions_id_seq RESTART WITH 1000"))
        db.execute(text("ALTER SEQUENCE teacher_videos_id_seq RESTART WITH 100"))

    staff = {"d1": d1, "d2": d2, "d3": d3, "n1": n1, "n2": n2, "n3": n3}
    patients = {
        "p01": p01, "p02": p02, "p03": p03, "p04": p04, "p05": p05,
        "p06": p06, "p07": p07, "p08": p08, "p09": p09, "p10": p10,
        "p11": p11, "p12": p12, "p13": p13, "p14": p14, "p15": p15,
        "p16": p16, "p17": p17, "p18": p18, "p19": p19, "p20": p20,
    }
    return staff, patients


def seed_demo(db: Session, staff: dict[str, User], patients: dict[str, Patient]) -> None:
    """模擬看診/計畫/影片分數等假臨床資料（submission 磁碟上無檔案，前端會降級）。"""
    d1, d2, d3 = staff["d1"], staff["d2"], staff["d3"]
    n1, n2, n3 = staff["n1"], staff["n2"], staff["n3"]
    (p01, p02, p03, p04, p05, p06, p07, p08, p09, p10,
     p11, p12, p13, p14, p15, p16, p17, p18, p19, p20) = (
        patients[f"p{i:02d}"] for i in range(1, 21)
    )

    # ================= p01 王小明（n1）：主線病患，分數穩定進步 =================
    visit(db, p01, d1, 42, "FIRST", "腰部輕微不適約一週。", "腰部肌肉緊繃。", "先觀察，避免久坐。", "NO_REHAB", 21)
    visit(db, p01, d1, 21, "FOLLOW_UP", "最近兩週腰部不適加劇，彎腰時明顯。", "腰部肌肉拉傷。", "建議居家復健，強化核心。", "CREATE_PLAN", 21)
    pl01 = plan(
        db, p01, d1, n1, "腰椎復健計畫", "ONGOING", 21, 5,
        ["改善腰部活動度", "提升核心肌群穩定度", "恢復日常活動能力"],
        LUMBAR_ITEMS,
        adjust={
            "days_ago": 7,
            "summary": "核心橋式姿勢偏差率高，調整為降階版本並加強範例說明。",
            "items": LUMBAR_ITEMS,
            "goals": ["改善腰部活動度", "提升核心肌群穩定度", "恢復日常活動能力"],
        },
    )
    visit(db, p01, d1, 7, "FOLLOW_UP", "居家復健執行順利，橋式動作較吃力。", "腰部肌肉拉傷，恢復中。", "調整復健動作強度。", "ADJUST_PLAN", 14)
    submission_series(db, pl01, n1, [
        (19, 62), (17, 66), (14, 70), (12, 73),
        (10, 75), (7, 78), (5, 82), (3, 85), (1, 88),
    ], pending_last=2)
    visit(db, p01, d1, 0, "FOLLOW_UP", "", "", "", "", status="WAITING")

    # ================= p02 陳美惠（今日初診候診） =================
    visit(db, p02, d1, 0, "FIRST", "", "", "", "", status="WAITING")

    # ================= p03 林大偉（n1）：待評估計畫（評估日=今日） =================
    visit(db, p03, d1, 35, "FIRST", "右膝不適，上下樓梯困難。", "退化性膝關節炎。", "建議居家復健延緩退化。", "CREATE_PLAN", 30)
    pl03 = plan(db, p03, d1, n1, "膝部復健計畫", "PENDING_EVALUATION", 30, 0,
                ["強化股四頭肌", "改善行走能力"], KNEE_ITEMS)
    submission_series(db, pl03, n1, [
        (25, 58), (21, 63), (17, 68), (13, 71), (9, 74), (5, 77), (2, 80),
    ], pending_last=1)

    # ================= p04 張秀英（n1）：穩定進步，今日剛審核 =================
    visit(db, p04, d1, 28, "FIRST", "左肩抬起困難，夜間不適。", "五十肩（沾黏性肩關節囊炎）。", "建議積極復健改善活動度。", "CREATE_PLAN", 28)
    pl04 = plan(db, p04, d1, n1, "肩部復健計畫", "ONGOING", 28, 10,
                ["改善肩關節活動度", "恢復日常上肢功能"], SHOULDER_ITEMS)
    submission_series(db, pl04, n1, [
        (21, 60), (18, 64), (14, 69), (11, 72), (7, 76), (4, 81),
    ])
    add_submission(db, pl04, n1, days_ago=0, hour=8, score=84, item_index=0,
                   status="REVIEWED", decision="APPROVED",
                   feedback="鐘擺運動幅度與節奏都很標準，繼續保持！", reviewed_days_ago=0)
    visit(db, p04, d1, 0, "FOLLOW_UP", "肩部活動改善許多，夜間已可入睡。", "五十肩，恢復良好。", "持續目前復健計畫。", "CONTINUE_PLAN", 14)

    # ================= p05 李志明（n1）：分數驟降 + 異常回報 =================
    visit(db, p05, d1, 25, "FIRST", "下背不適延伸至左腿。", "腰椎椎間盤突出（輕度）。", "建議保守復健治療。", "CREATE_PLAN", 30)
    pl05 = plan(db, p05, d1, n1, "腰椎減壓復健計畫", "ONGOING", 25, 7,
                ["減輕神經壓迫症狀", "重建核心支撐力"], LUMBAR_ITEMS)
    submission_series(db, pl05, n1, [
        (18, 72), (15, 74), (12, 76), (9, 70),
    ])
    sub05_drop = add_submission(
        db, pl05, n1, days_ago=2, hour=9, score=52, item_index=1,
        status="REVIEWED", decision="NEEDS_ATTENTION",
        feedback="這次橋式左髖明顯代償、軀幹不穩，請先暫停此動作，等醫生評估後再繼續。",
        reviewed_days_ago=1,
    )
    add_submission(db, pl05, n1, days_ago=1, hour=10, score=55, item_index=0,
                   status="PENDING_REVIEW")
    report(
        db, pl05, n1, "ABNORMALITY", "PRIORITY",
        "李志明近兩次動作分數由 76 分驟降至 52 分，左髖代償明顯、左腿麻感加重，建議重新評估訓練強度。",
        days_ago=1, submission=sub05_drop,
    )
    visit(db, p05, d1, 0, "FOLLOW_UP", "", "", "", "", status="WAITING")

    # ================= p06 吳淑芬（n2）：進行中，佇列有待審核 =================
    visit(db, p06, d2, 20, "FIRST", "頸部僵硬，長時間使用電腦後頭痛。", "頸因性頭痛、肌筋膜緊繃。", "建議姿勢調整與頸部復健。", "CREATE_PLAN", 28)
    pl06 = plan(db, p06, d2, n2, "頸部復健計畫", "ONGOING", 20, 12,
                ["改善頸部僵硬", "減少頭痛頻率"], NECK_ITEMS)
    submission_series(db, pl06, n2, [
        (15, 68), (12, 71), (9, 74), (6, 76), (3, 79), (0, 81),
    ], pending_last=2)

    # ================= p07 劉建宏（n2）：已結案計畫 =================
    visit(db, p07, d2, 90, "FIRST", "右腳踝扭傷後持續腫痛。", "右踝關節扭傷（二級）。", "建議復健恢復穩定度。", "CREATE_PLAN", 60)
    pl07 = plan(db, p07, d2, n2, "踝關節復健計畫", "CLOSED", 90, None,
                ["恢復踝關節穩定度", "回復正常行走"], KNEE_ITEMS[:2])
    submission_series(db, pl07, n2, [
        (80, 62), (73, 68), (66, 75), (59, 82), (52, 88),
    ])
    visit(db, p07, d2, 45, "FOLLOW_UP", "腳踝已不影響日常活動。", "踝關節扭傷痊癒。", "復健目標達成，結束計畫。", "END_PLAN")

    # ================= p08 蔡雅婷：逾期未回診 =================
    visit(db, p08, d2, 40, "FIRST", "跑步後膝蓋外側不適。", "髂脛束症候群。", "建議調整運動習慣，觀察兩週回診。", "NO_REHAB", 14)

    # ================= p09 鄭文雄：多次看診、無計畫 =================
    visit(db, p09, d3, 120, "FIRST", "雙膝痠痛多年，天冷加劇。", "退化性關節炎（初期）。", "先以藥物與生活調整為主。", "NO_REHAB", 60)
    visit(db, p09, d3, 60, "FOLLOW_UP", "膝蓋狀況穩定。", "退化性關節炎（初期）。", "維持現狀，持續觀察。", "NO_REHAB", 60)
    visit(db, p09, d3, 15, "FOLLOW_UP", "近日蹲下起身較吃力。", "退化性關節炎。", "視後續狀況評估是否安排復健。", "NO_REHAB", 30)

    # ================= p10 許麗華：全新病患（未看診） =================

    # ================= p11 楊承翰（n2）：今日已完成看診 + 進行中計畫 =================
    visit(db, p11, d2, 14, "FIRST", "重訓後右肩無力。", "旋轉肌袖肌腱炎。", "建議復健並暫停上肢重訓。", "CREATE_PLAN", 14)
    pl11 = plan(db, p11, d2, n2, "肩部肌腱復健計畫", "ONGOING", 14, 14,
                ["修復旋轉肌袖", "恢復肩部肌力"], SHOULDER_ITEMS)
    submission_series(db, pl11, n2, [
        (10, 66), (7, 71), (5, 75), (3, 78), (1, 82),
    ], pending_last=1)
    visit(db, p11, d2, 0, "FOLLOW_UP", "肩部狀況改善，力量恢復中。", "旋轉肌袖肌腱炎，恢復良好。", "持續目前復健計畫。", "CONTINUE_PLAN", 14)

    # ================= p12 賴品妤（n2）：分數連續下滑（待評估）+ 調整建議 =================
    visit(db, p12, d2, 30, "FIRST", "產後腰痠背痛，抱小孩時加劇。", "腰部肌肉勞損。", "建議核心強化復健。", "CREATE_PLAN", 30)
    pl12 = plan(db, p12, d2, n2, "產後腰背復健計畫", "PENDING_EVALUATION", 30, 1,
                ["強化核心肌群", "改善腰背痠痛"], LUMBAR_ITEMS)
    submission_series(db, pl12, n2, [
        (20, 75), (16, 73), (12, 69), (8, 64),
    ])
    sub12_low = add_submission(
        db, pl12, n2, days_ago=4, hour=9, score=58, item_index=1,
        status="REVIEWED", decision="NEEDS_ATTENTION",
        feedback="連續幾次分數下滑，橋式的骨盆位置越來越不穩，建議先回到降階動作。",
        reviewed_days_ago=3,
    )
    add_submission(db, pl12, n2, days_ago=1, hour=14, score=56, item_index=2,
                   status="PENDING_REVIEW")
    report(
        db, pl12, n2, "ADJUSTMENT_SUGGESTION", "NORMAL",
        "賴品妤分數連續四次下滑（75→56），核心動作代償明顯，建議評估將核心橋式改為降階版本並降低每週次數。",
        days_ago=3, submission=sub12_low,
    )
    visit(db, p12, d2, 0, "FOLLOW_UP", "", "", "", "", status="WAITING")

    # ================= p13 郭俊廷（n2）：計畫剛調整（V1→V2 三天前） =================
    visit(db, p13, d3, 24, "FIRST", "打籃球扭傷左膝。", "內側副韌帶拉傷（一級）。", "建議復健恢復穩定度。", "CREATE_PLAN", 21)
    pl13 = plan(
        db, p13, d3, n2, "膝韌帶復健計畫", "ONGOING", 24, 10,
        ["恢復膝關節穩定度", "重建下肢肌力"], KNEE_ITEMS,
        adjust={
            "days_ago": 3,
            "summary": "加入平衡訓練，股四頭肌訓練由每週 3 次增加至每週 4 次。",
            "items": KNEE_ITEMS + [BALANCE_ITEM],
        },
    )
    submission_series(db, pl13, n2, [
        (2, 72), (1, 76),
    ], pending_last=1)
    visit(db, p13, d3, 3, "FOLLOW_UP", "膝蓋穩定度改善。", "韌帶拉傷恢復中。", "調整計畫，加入平衡訓練。", "ADJUST_PLAN", 14)

    # ================= p14 周雅雯：僅一次看診、無計畫 =================
    visit(db, p14, d3, 10, "FIRST", "久坐後尾椎不適。", "尾椎挫傷。", "建議坐墊減壓，暫不需復健。", "NO_REHAB", 30)

    # ================= p15 曾國豪（n3）：已結案 + 逾期未回診 =================
    visit(db, p15, d3, 100, "FIRST", "中風後左側肢體無力。", "腦中風後遺症（左側輕癱）。", "安排神經復健。", "CREATE_PLAN", 60)
    pl15 = plan(db, p15, d3, n3, "神經復健計畫", "CLOSED", 100, None,
                ["改善左側肢體肌力", "提升日常生活自理能力"], KNEE_ITEMS[:2] + NECK_ITEMS[:1])
    submission_series(db, pl15, n3, [
        (90, 48), (83, 55), (76, 62), (69, 68), (62, 74),
    ])
    visit(db, p15, d3, 55, "FOLLOW_UP", "肢體功能明顯進步。", "中風後遺症，恢復良好。", "結束本階段計畫，一個月後回診評估。", "END_PLAN", 30)

    # ================= p16 邱怡君（n3）：今日候診 + 進行中計畫 =================
    visit(db, p16, d2, 16, "FIRST", "媽媽手，抱嬰兒時手腕劇痛。", "狹窄性肌腱滑膜炎。", "建議復健與護具。", "CREATE_PLAN", 16)
    pl16 = plan(db, p16, d2, n3, "手腕肌腱復健計畫", "ONGOING", 16, 12,
                ["恢復抓握功能", "重建腕部肌腱耐受度"], SHOULDER_ITEMS[:2])
    submission_series(db, pl16, n3, [
        (12, 63), (9, 67), (6, 71), (3, 74), (1, 77),
    ], pending_last=2)
    visit(db, p16, d2, 0, "FOLLOW_UP", "", "", "", "", status="WAITING")

    # ================= p17 洪偉哲（n3）：穩定進步 + 演算法分析中 =================
    visit(db, p17, d3, 18, "FIRST", "搬重物閃到腰。", "急性腰扭傷。", "建議短期復健。", "CREATE_PLAN", 21)
    pl17 = plan(db, p17, d3, n3, "急性腰扭傷復健計畫", "ONGOING", 18, 5,
                ["恢復日常活動", "預防再次拉傷"], LUMBAR_ITEMS)
    submission_series(db, pl17, n3, [
        (14, 58), (11, 65), (7, 72), (4, 79), (2, 84),
    ], pending_last=1)
    add_submission(db, pl17, n3, days_ago=0, hour=9, score=None, item_index=1,
                   status="ANALYZING")

    # ================= p18 簡淑娟：今日候診（回診，尚無計畫） =================
    visit(db, p18, d3, 21, "FIRST", "更年期後全身痠痛，右髖不適。", "髖關節滑囊炎疑似。", "先行藥物治療，兩週後評估。", "NO_REHAB", 21)
    visit(db, p18, d3, 0, "FOLLOW_UP", "", "", "", "", status="WAITING")

    # ================= p19 潘俊宇（n3）：進行中 + 分析中 =================
    visit(db, p19, d1, 12, "FIRST", "馬拉松訓練後足底不適。", "足底筋膜炎。", "建議復健與伸展。", "CREATE_PLAN", 28)
    pl19 = plan(db, p19, d1, n3, "足底筋膜復健計畫", "ONGOING", 12, 16,
                ["改善足部柔軟度", "恢復跑步訓練"], KNEE_ITEMS[:2])
    submission_series(db, pl19, n3, [
        (9, 70), (5, 74), (2, 78),
    ], pending_last=1)
    add_submission(db, pl19, n3, days_ago=0, hour=7, score=None, item_index=0,
                   status="ANALYZING")

    # ================= p20 江美玲（n3）：新計畫，尚無上傳紀錄 =================
    visit(db, p20, d1, 2, "FIRST", "肩頸痠痛，睡醒時最明顯。", "頸椎退化初期。", "建議開始頸部復健。", "CREATE_PLAN", 30)
    plan(db, p20, d1, n3, "頸椎保健復健計畫", "ONGOING", 2, 19,
         ["延緩頸椎退化", "改善睡眠品質"], NECK_ITEMS)

    # 歷史回報（已處理，讓醫生端有已處理範例）
    report(
        db, pl01, n1, "STATUS_REPORT", "NORMAL",
        "王小明居家復健執行穩定，分數由 62 分進步至 85 分，動作品質持續提升。",
        days_ago=5, status="REVIEWED",
        doctor_comment="收到，維持目前計畫，評估日再整體檢視。",
    )


if __name__ == "__main__":
    main()
