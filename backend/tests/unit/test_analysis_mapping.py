"""analysis_data_service 純函式數學的單元測試（不碰 DB、不讀檔）。

fixture 手算依據（與 humanpose_api.py 合成邏輯同步，見模組 docstring）：
    steps=[10, 30]、mentor_hlt=[20, 25]
    段 1：病患 0→10（Δ10）、導師 0→20（Δ20）→ 段長 20（以較長者為準）
    段 2：病患 10→30（Δ20）、導師 20→25（Δ5）→ 段長 20
    plain 影片：段 1 佔幀 0..19、段 2 佔幀 20..39
    full 影片：段 1 佔幀 0..19 + 停留 60 幀、段 2 從幀 80 起
"""

import pytest

from app.services.analysis_data_service import (
    HOLD_FRAMES,
    OUTPUT_FPS,
    _build_segments,
    _cos_to_deg,
    _frame_times,
    _locate_segment,
    _mentor_frame_for,
    _seg_len,
)

STEPS = [10, 30]
MENTOR_HLT = [20, 25]


@pytest.fixture
def segments():
    return _build_segments(STEPS, MENTOR_HLT)


class TestCosToDeg:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [(1.0, 0.0), (0.0, 90.0), (-1.0, 180.0)],
    )
    def test_exact_values(self, value, expected):
        assert _cos_to_deg(value) == pytest.approx(expected)

    def test_clamps_out_of_domain_floats(self):
        # 浮點誤差讓 cos 略超出 [-1,1] 時不得拋 math domain error
        assert _cos_to_deg(1.0000001) == pytest.approx(0.0)
        assert _cos_to_deg(-1.5) == pytest.approx(180.0)


class TestBuildSegments:
    def test_two_segments_layout(self, segments):
        assert [s["index"] for s in segments] == [1, 2]
        assert segments[0] == {
            "index": 1,
            "patient_start": 0,
            "patient_end": 10,
            "mentor_start": 0,
            "mentor_end": 20,
            "plain_base": 0,
            "full_base": 0,
        }
        # 段 2 的 plain_base 累加段 1 的 max(Δp, Δm)=20；full_base 再加一次停留
        assert segments[1]["plain_base"] == 20
        assert segments[1]["full_base"] == 20 + HOLD_FRAMES

    def test_empty_steps(self):
        assert _build_segments([], []) == []

    def test_seg_len_takes_longer_side(self, segments):
        assert _seg_len(segments[0]) == 20  # 導師較長
        assert _seg_len(segments[1]) == 20  # 病患較長


class TestLocateSegment:
    @pytest.mark.parametrize(
        ("frame", "index"),
        [(0, 1), (5, 1), (10, 1), (11, 2), (30, 2)],
    )
    def test_frame_to_segment(self, segments, frame, index):
        assert _locate_segment(segments, frame)["index"] == index

    def test_past_last_step_returns_none(self, segments):
        # 病患幀超過最後一步：輸出影片中不存在此幀
        assert _locate_segment(segments, 31) is None


class TestMentorFrameFor:
    def test_parallel_advance(self, segments):
        assert _mentor_frame_for(segments, 5) == 5

    def test_mentor_freezes_when_shorter(self, segments):
        # 段 2 導師只有 5 幀：病患走到第 15 幀時導師已凍結在段尾 25
        assert _mentor_frame_for(segments, 15) == 25
        assert _mentor_frame_for(segments, 30) == 25

    def test_past_last_step_clamps_to_mentor_end(self, segments):
        assert _mentor_frame_for(segments, 99) == 25


class TestFrameTimes:
    def test_within_first_segment(self, segments):
        t_plain, t_full = _frame_times(segments, 5)
        assert t_plain == pytest.approx(5 / OUTPUT_FPS)
        assert t_full == pytest.approx(5 / OUTPUT_FPS)

    def test_second_segment_includes_hold(self, segments):
        # 病患幀 25 = 段 2 offset 15：plain 從 20 起算、full 還要加段 1 的停留
        t_plain, t_full = _frame_times(segments, 25)
        assert t_plain == pytest.approx((20 + 15) / OUTPUT_FPS)
        assert t_full == pytest.approx((20 + HOLD_FRAMES + 15) / OUTPUT_FPS)

    def test_offset_clamped_to_segment_end(self, segments):
        # 段內 offset 上限 = 段長-1（合成的凍結畫面），病患幀 30 是段 2 結尾
        t_plain, _ = _frame_times(segments, 30)
        assert t_plain == pytest.approx((20 + 19) / OUTPUT_FPS)

    def test_past_last_step_clamps_to_video_end(self, segments):
        t_plain, t_full = _frame_times(segments, 31)
        assert t_plain == pytest.approx((20 + 20) / OUTPUT_FPS)
        assert t_full == pytest.approx((20 + HOLD_FRAMES + 20 + HOLD_FRAMES) / OUTPUT_FPS)
