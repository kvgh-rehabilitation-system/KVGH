"""golden 回歸測試：釘住跨模組契約，改動時強迫兩端同步。

一、幀映射常數（backend ↔ algorithm/humanpose_api.py 影片合成邏輯）
二、display_status 值域（backend ↔ frontend/src/utils/submissionStatus.ts）
    golden 檔：ci/contracts/submission_status.json（容器內掛載於 /contracts，
    本機直接跑時走 repo 相對路徑）
"""

import json
import os
from itertools import product
from pathlib import Path
from types import SimpleNamespace

from app.services import analysis_data_service
from app.services.common import submission_display_status

CONTRACTS_DIR = Path(os.environ.get("CONTRACTS_DIR", "/contracts"))
if not CONTRACTS_DIR.is_dir():
    # 本機直接跑：退回 repo 根目錄的 ci/contracts（容器內算不到這麼多層父目錄，惰性計算）
    CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "ci" / "contracts"

GOLDEN = json.loads((CONTRACTS_DIR / "submission_status.json").read_text(encoding="utf-8"))

# 兩欄位的完整值域（models/submission.py 的文件契約）
BUSINESS_STATUSES = ("ANALYZING", "PENDING_REVIEW", "REVIEWED")
PIPELINE_STATUSES = ("PENDING", "TRANSCODING", "EXTRACTING", "COMPARING", "DONE", "FAILED")


class TestFrameMappingConstants:
    """改 algorithm/humanpose_api.py 影片合成邏輯必須同步 analysis_data_service
    並將 VERSION +1（dashboard.json 快取才會失效重算）——見根目錄 CLAUDE.md。"""

    def test_version(self):
        assert analysis_data_service.VERSION == 2, (
            "VERSION 變了：確認 payload/映射邏輯真的改了，並同步更新本測試與"
            " humanpose_api.py 的對應合成邏輯"
        )

    def test_output_fps(self):
        assert analysis_data_service.OUTPUT_FPS == 30.0, (
            "OUTPUT_FPS 與 humanpose_api.py 輸出影片 fps 寫死值耦合，兩邊要一起改且 VERSION +1"
        )

    def test_hold_frames(self):
        assert analysis_data_service.HOLD_FRAMES == 60, (
            "HOLD_FRAMES 與 humanpose_api.py 完整版每步驟停留幀數耦合，兩邊要一起改且 VERSION +1"
        )

    def test_angle_to_joint_covers_8_joints(self):
        joints = {j for j, _ in analysis_data_service.ANGLE_TO_JOINT.values()}
        assert joints == {
            "left_shoulder",
            "left_elbow",
            "right_shoulder",
            "right_elbow",
            "left_hip",
            "left_knee",
            "right_hip",
            "right_knee",
        }


class TestDisplayStatusGolden:
    def test_value_domain_matches_golden(self):
        # 窮舉兩欄位組合，實際輸出值域必須與 golden 完全一致
        produced = set()
        for status, stage in product(BUSINESS_STATUSES, PIPELINE_STATUSES):
            sub = SimpleNamespace(status=status, analysis_status=stage)
            produced.add(submission_display_status(sub))
        assert produced == set(GOLDEN["display_status"]), (
            "display_status 值域變了：同步 ci/contracts/submission_status.json、"
            "前端 submissionStatus.ts 兩張 label 表與 types 的 DisplayStatus"
        )

    def test_pipeline_active_subset(self):
        active = set(GOLDEN["pipeline_active"])
        assert active < set(GOLDEN["display_status"])
        assert active == {"PENDING", "TRANSCODING", "EXTRACTING", "COMPARING"}
