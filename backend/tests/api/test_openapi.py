"""API 規格釘住（Contract）：關鍵路由必須存在於 /openapi.json。

只驗「路由存在」這一層穩定契約——改 handler 實作、加欄位、加新路由都不會紅；
紅燈 = 有人把前端/worker 依賴的端點改名或刪掉了。
"""

import pytest

# 前端 api/ 層與 worker 回寫實際打的端點（每角色挑主要頁面依賴的代表路由）
CRITICAL_PATHS = (
    "/api/health",
    "/api/auth/login",
    "/api/auth/me",
    # 媒體串流（<video> ?token= 認證）
    "/api/media/submissions/{submission_id}/video",
    "/api/media/submissions/{submission_id}/pose3d",
    "/api/media/teacher-videos/{teacher_video_id}/video",
    # 病患
    "/api/patient/dashboard",
    "/api/patient/rehabilitation-plans/{plan_id}/submissions",
    # 護理師（審核頁三路載入 + 導師影片庫）
    "/api/nurse/submissions",
    "/api/nurse/submissions/{submission_id}/analysis-data",
    "/api/nurse/submissions/{submission_id}/review",
    "/api/nurse/teacher-videos",
    # 醫師（計畫調整流程）
    "/api/doctor/patients",
    "/api/doctor/rehabilitation-plans/{plan_id}",
    "/api/doctor/rehabilitation-plans/{plan_id}/adjust",
    # 管理員
    "/api/admin/users",
    "/api/admin/tasks",
)


@pytest.fixture(scope="module")
def openapi_paths(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    return set(r.json()["paths"])


@pytest.mark.parametrize("path", CRITICAL_PATHS)
def test_critical_path_exists(openapi_paths, path):
    assert path in openapi_paths, f"關鍵路由 {path} 從 API 規格消失——確認是否改名/誤刪"
