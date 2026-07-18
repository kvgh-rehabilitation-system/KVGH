"""VRAM 守門：防止 OOM 拖垮系統的第二層保護（第一層是 autoscale 硬上限）。

GPU 可能被其他程式佔用——任務開跑前先確認剩餘 VRAM 足夠，
不足時丟 InsufficientVram 讓任務 retry（延後執行），絕不硬跑到 OOM。
"""


class InsufficientVram(Exception):
    def __init__(self, free_mb: int, required_mb: int):
        self.free_mb = free_mb
        self.required_mb = required_mb
        super().__init__(f"GPU 剩餘 VRAM {free_mb}MB < 需求 {required_mb}MB，延後執行")


def free_vram_mb() -> int:
    """回傳所有 GPU 中剩餘 VRAM 最大的值（MB）。查詢失敗時回 -1（放行，交給 OOM retry）。"""
    try:
        import pynvml

        pynvml.nvmlInit()
        try:
            best = 0
            for i in range(pynvml.nvmlDeviceGetCount()):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                best = max(best, info.free // (1024 * 1024))
            return best
        finally:
            pynvml.nvmlShutdown()
    except Exception as exc:  # NVML 不可用（如驅動異常）時不阻擋任務
        print(f"[gpu_guard] NVML 查詢失敗，跳過 VRAM 檢查: {exc}", flush=True)
        return -1


def ensure_vram(required_mb: int) -> None:
    free = free_vram_mb()
    if free >= 0 and free < required_mb:
        raise InsufficientVram(free, required_mb)


def is_cuda_oom(stderr: str) -> bool:
    """subprocess stderr 是否為 CUDA OOM（視為暫時性錯誤，重試而非失敗）。"""
    markers = ("CUDA out of memory", "cudaErrorMemoryAllocation", "CUDA error: out of memory")
    return any(m in stderr for m in markers)
