"""common.py 狀態判定的單元測試——用假物件，不碰 DB。

只驗穩定契約（優先序與門檻），不驗序列化細節。
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services.common import (
    ATTENTION_SCORE_THRESHOLD,
    submission_display_status,
    submission_needs_attention,
)


def make_sub(
    status="PENDING_REVIEW",
    analysis_status="DONE",
    score=None,
    plan_item_id=1,
    submitted_at=None,
):
    """最小可用的 VideoSubmission 假物件（欄位僅涵蓋被測函式讀到的）。"""
    return SimpleNamespace(
        status=status,
        analysis_status=analysis_status,
        plan_item_id=plan_item_id,
        submitted_at=submitted_at or datetime(2026, 1, 1, 12, 0),
        analysis=None if score is None else SimpleNamespace(overall_score=score),
    )


class TestDisplayStatus:
    def test_failed_wins_over_everything(self):
        # FAILED 優先序最高：不論業務狀態為何都顯示 FAILED
        for status in ("ANALYZING", "PENDING_REVIEW", "REVIEWED"):
            sub = make_sub(status=status, analysis_status="FAILED")
            assert submission_display_status(sub) == "FAILED"

    def test_analyzing_shows_pipeline_stage(self):
        for stage in ("PENDING", "TRANSCODING", "EXTRACTING", "COMPARING"):
            sub = make_sub(status="ANALYZING", analysis_status=stage)
            assert submission_display_status(sub) == stage

    def test_otherwise_shows_business_status(self):
        for status in ("PENDING_REVIEW", "REVIEWED"):
            sub = make_sub(status=status, analysis_status="DONE")
            assert submission_display_status(sub) == status


class TestNeedsAttention:
    def test_no_analysis_is_never_flagged(self):
        assert submission_needs_attention(make_sub(score=None)) is False

    def test_low_score_threshold_boundary(self):
        assert submission_needs_attention(make_sub(score=ATTENTION_SCORE_THRESHOLD - 0.1)) is True
        assert submission_needs_attention(make_sub(score=ATTENTION_SCORE_THRESHOLD)) is False

    def test_drop_over_8_from_previous_same_item(self):
        base = datetime(2026, 1, 1, 12, 0)
        prev = make_sub(score=80, submitted_at=base)
        dropped = make_sub(score=71.9, submitted_at=base + timedelta(days=1))
        held = make_sub(score=72, submitted_at=base + timedelta(days=1))
        assert submission_needs_attention(dropped, history=[prev, dropped]) is True
        assert submission_needs_attention(held, history=[prev, held]) is False

    def test_drop_compares_only_same_plan_item(self):
        base = datetime(2026, 1, 1, 12, 0)
        other_item = make_sub(score=95, plan_item_id=2, submitted_at=base)
        sub = make_sub(score=70, plan_item_id=1, submitted_at=base + timedelta(days=1))
        assert submission_needs_attention(sub, history=[other_item, sub]) is False
