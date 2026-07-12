# GPU worker image：CUDA runtime 由 pip 的 cu126 wheels（nvidia-*-cu12）提供，
# 版本必須對齊主機 venv（torch 2.7.1+cu126）——引擎內主機編譯的
# AlphaPose CUDA 擴充 .so 連結 libcudart.so.12，cu11 會 ImportError。
# 只需 nvidia container runtime 暴露驅動即可，不必用肥大的 nvidia/cuda base image。
# 用 ubuntu:24.04 對齊主機 glibc——演算法引擎（bind mount 進來）內含
# 主機上編譯好的 cpython-312 .so（AlphaPose nms 等），必須能直接載入。
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.12 python3.12-venv python3.12-dev python3-pip \
        build-essential \
        ffmpeg \
        libgl1 libglib2.0-0 \
        fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

RUN python3.12 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# 演算法依賴（cu126 torch 等）與 worker 自身依賴。
# cython-bbox 只有 sdist 且 setup.py 需要 numpy/cython，先裝好再以
# --no-build-isolation 編譯，避免 PEP 517 隔離環境缺依賴而失敗。
COPY algorithm/requirements.txt /tmp/algorithm-requirements.txt
COPY worker/requirements.txt /tmp/worker-requirements.txt
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir numpy==2.2.6 cython==3.2.3 \
    && pip install --no-cache-dir --no-build-isolation -r /tmp/algorithm-requirements.txt \
    && pip install --no-cache-dir -r /tmp/worker-requirements.txt

# AlphaPose 的 coco_wholebody dataset import tkinter（獨立 layer，避免重裝 pip 依賴）
RUN apt-get update && apt-get install -y --no-install-recommends python3.12-tk \
    && rm -rf /var/lib/apt/lists/*

# 共用 backend 的 SQLAlchemy models（worker 直連 PostgreSQL 寫狀態與結果）
COPY backend/app /app/app
COPY worker /app/worker

ENV PYTHONPATH=/app

# 供 nvidia container runtime 辨識需要 GPU
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

CMD ["celery", "-A", "worker.celery_app", "worker", "--loglevel=INFO"]
