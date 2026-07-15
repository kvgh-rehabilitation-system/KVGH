"""護理師端路由（/api/nurse/*，全端點掛 require_nurse）。

router 只做參數綁定與權限依賴，商業邏輯都在 nurse_service；
計畫詳細/上傳紀錄兩個唯讀端點直接複用 doctor_service（同一份資料兩種角色看）。
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_nurse
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import NurseDashboardOut
from app.schemas.rehab_plan import PlanDetailOut, PlanItemCreate, PlanItemUpdate
from app.schemas.submission import (
    NurseReportCreate,
    NurseReportOut,
    ReviewSubmit,
    SubmissionDetailOut,
)
from app.schemas.analysis_data import AnalysisDataOut
from app.schemas.teacher_video import (
    AnnotationOut,
    AnnotationSubmit,
    TeacherVideoFolderIn,
    TeacherVideoFolderOut,
    TeacherVideoOut,
    TeacherVideoUpdate,
)
from app.services import analysis_data_service, common, doctor_service, nurse_service

router = APIRouter(prefix="/api/nurse", tags=["nurse"])


@router.get("/dashboard", response_model=NurseDashboardOut)
def dashboard(user: User = Depends(require_nurse), db: Session = Depends(get_db)):
    """護理師首頁儀表板（摘要計數 + 待審佇列 + 需注意病患）。"""
    return nurse_service.get_dashboard(db, user)


@router.get("/patients")
def my_patients(
    scope: str = "mine",
    search: str | None = None,
    plan_status: str | None = None,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """scope=mine 只列我負責的病患；scope=all 列全部病患（標記 is_mine）。"""
    return nurse_service.list_my_patients(
        db, user, scope=scope, search=search, plan_status=plan_status
    )


@router.get("/patients/{patient_id}")
def patient_detail(
    patient_id: int, user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """護理師端病患詳細頁（含目前計畫的動作清單）。"""
    return nurse_service.get_patient_detail_for_nurse(db, user, patient_id)


@router.get("/plans/{plan_id}", response_model=PlanDetailOut)
def plan_detail(
    plan_id: int, user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """計畫詳細（唯讀，與醫生端共用同一 service）。"""
    return doctor_service.get_plan_detail(db, plan_id)


@router.get("/plans/{plan_id}/submissions")
def plan_submissions(
    plan_id: int, user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """計畫的上傳紀錄與趨勢（唯讀，與醫生端共用同一 service）。"""
    return doctor_service.get_plan_submissions(db, plan_id)




@router.get("/submissions")
def list_submissions(
    status: str | None = None,
    decision: str | None = None,
    search: str | None = None,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """審核佇列（我負責計畫的上傳；可依狀態/審核結果/關鍵字篩選）。"""
    return nurse_service.list_submissions(db, user, status, decision, search)


@router.get("/submissions/{submission_id}", response_model=SubmissionDetailOut)
def submission_detail(
    submission_id: int, user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """審核頁的完整資料（病患/計畫/動作/分析/審核狀態 + 歷次分數）。"""
    return nurse_service.get_submission_detail(db, submission_id)


@router.get(
    "/submissions/{submission_id}/analysis-data", response_model=AnalysisDataOut
)
def submission_analysis_data(
    submission_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """儀表板明細：動作分解卡、相似度曲線、關節偏差序列（含各影片跳轉秒數）。"""
    return analysis_data_service.get_analysis_data(db, submission_id)


@router.post("/submissions/{submission_id}/review", response_model=SubmissionDetailOut)
def review_submission(
    submission_id: int,
    data: ReviewSubmit,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """送出審核結果（APPROVED / NEEDS_ATTENTION + 回饋文字）。"""
    return nurse_service.review_submission(db, user, submission_id, data)


@router.get("/reports", response_model=list[NurseReportOut])
def list_reports(user: User = Depends(require_nurse), db: Session = Depends(get_db)):
    """我送出過的回報醫生紀錄（新到舊）。"""
    return [common.report_to_out(r) for r in nurse_service.list_reports(db, user)]


@router.post("/reports", response_model=NurseReportOut, status_code=201)
def create_report(
    data: NurseReportCreate,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """建立回報醫生（狀況回報/調整建議/異常）。"""
    report = nurse_service.create_report(db, user, data)
    return common.report_to_out(report)


# ---- 動作管理 ----

@router.get("/plans/{plan_id}/items")
def plan_items(
    plan_id: int, user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """動作管理頁資料（計畫摘要 + 目前版本的動作清單）。"""
    return nurse_service.get_plan_for_items(db, plan_id)


@router.post("/plans/{plan_id}/items", status_code=201)
def add_plan_item(
    plan_id: int,
    data: PlanItemCreate,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """在目前版本新增動作項目。"""
    return nurse_service.add_plan_item(db, plan_id, data)


@router.put("/plans/{plan_id}/items/{item_id}")
def update_plan_item(
    plan_id: int,
    item_id: int,
    data: PlanItemUpdate,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """部分更新動作項目（沒帶的欄位不動）。"""
    return nurse_service.update_plan_item(db, plan_id, item_id, data)


@router.delete("/plans/{plan_id}/items/{item_id}")
def delete_plan_item(
    plan_id: int,
    item_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """刪除動作項目（已有上傳紀錄者不可刪）。"""
    return nurse_service.delete_plan_item(db, plan_id, item_id)


# ---- 導師影片 ----

@router.get("/teacher-videos", response_model=list[TeacherVideoOut])
def list_teacher_videos(
    user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """導師影片庫清單（跨護理師共享，含名稱與上傳者）。"""
    return nurse_service.list_teacher_videos(db)


@router.post("/teacher-videos", response_model=TeacherVideoOut, status_code=202)
def create_teacher_video(
    name: str = Form(...),
    video: UploadFile = File(...),
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """獨立上傳導師影片到影片庫（不綁定動作），背景執行 轉檔 → 2D/3D 萃取。"""
    return nurse_service.create_teacher_video(db, user, video, name)


@router.post(
    "/plans/{plan_id}/items/{item_id}/teacher-video",
    response_model=TeacherVideoOut,
    status_code=202,
)
def upload_teacher_video(
    plan_id: int,
    item_id: int,
    name: str = Form(...),
    video: UploadFile = File(...),
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """上傳導師（範例）影片並綁定動作，背景執行 轉檔 → 2D/3D 萃取。"""
    return nurse_service.upload_teacher_video(db, user, plan_id, item_id, video, name)


@router.get("/teacher-videos/{teacher_video_id}", response_model=TeacherVideoOut)
def teacher_video_status(
    teacher_video_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """輪詢導師影片的轉檔/萃取/標註狀態。"""
    tv = nurse_service.get_teacher_video_or_404(db, teacher_video_id)
    return nurse_service.teacher_video_to_out(tv)


@router.patch("/teacher-videos/{teacher_video_id}", response_model=TeacherVideoOut)
def update_teacher_video(
    teacher_video_id: int,
    data: TeacherVideoUpdate,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """改名與/或移動資料夾（folder_id 傳 null 移回未分類）。"""
    return nurse_service.update_teacher_video(db, teacher_video_id, data)


@router.post(
    "/teacher-videos/{teacher_video_id}/re-extract",
    response_model=TeacherVideoOut,
    status_code=202,
)
def reextract_teacher_video(
    teacher_video_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """重新執行 2D/3D 萃取（刪除姿態產物重算；保留影片與標註）。"""
    return nurse_service.reextract_teacher_video(db, teacher_video_id)


@router.delete("/teacher-videos/{teacher_video_id}")
def delete_teacher_video(
    teacher_video_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """刪除導師影片（仍被計畫動作引用時不可刪）。"""
    return nurse_service.delete_teacher_video(db, teacher_video_id)


# ---- 導師影片資料夾 ----

@router.get("/teacher-video-folders", response_model=list[TeacherVideoFolderOut])
def list_teacher_video_folders(
    user: User = Depends(require_nurse), db: Session = Depends(get_db)
):
    """資料夾清單（依名稱排序，含影片數）。"""
    return nurse_service.list_teacher_video_folders(db)


@router.post(
    "/teacher-video-folders", response_model=TeacherVideoFolderOut, status_code=201
)
def create_teacher_video_folder(
    data: TeacherVideoFolderIn,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """建立影片庫資料夾（名稱不可重複）。"""
    return nurse_service.create_teacher_video_folder(db, data)


@router.patch(
    "/teacher-video-folders/{folder_id}", response_model=TeacherVideoFolderOut
)
def rename_teacher_video_folder(
    folder_id: int,
    data: TeacherVideoFolderIn,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """資料夾改名。"""
    return nurse_service.rename_teacher_video_folder(db, folder_id, data)


@router.delete("/teacher-video-folders/{folder_id}")
def delete_teacher_video_folder(
    folder_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """刪除資料夾；夾內影片移回未分類。"""
    return nurse_service.delete_teacher_video_folder(db, folder_id)


# ---- 導師影片標註 ----

@router.get(
    "/teacher-videos/{teacher_video_id}/annotation", response_model=AnnotationOut
)
def get_annotation(
    teacher_video_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """標註頁資料（影片參數 + 現有標註幀）。"""
    return nurse_service.get_annotation(db, teacher_video_id)


@router.put(
    "/teacher-videos/{teacher_video_id}/annotation", response_model=AnnotationOut
)
def submit_annotation(
    teacher_video_id: int,
    data: AnnotationSubmit,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """儲存重點動作幀標註，由 worker 產生演算法所需的標註 JSON。"""
    return nurse_service.submit_annotation(db, teacher_video_id, data)


# ---- 重新分析 ----

@router.post("/submissions/{submission_id}/reanalyze")
def reanalyze_submission(
    submission_id: int,
    user: User = Depends(require_nurse),
    db: Session = Depends(get_db),
):
    """重新排入分析 pipeline（已萃取的產物會重用，不會重跑 GPU）。"""
    return nurse_service.reanalyze_submission(db, submission_id)
