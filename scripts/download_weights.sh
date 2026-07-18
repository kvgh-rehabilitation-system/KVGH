#!/bin/sh
# KVGH 模型權重下載器（冪等）：檢查 weights_manifest.txt 列出的權重，
# 缺少或大小不符才下載（tmp + mv 原子落地，sha256 驗證）。
# 由 docker-compose 的 weights-init 服務於每次啟動執行；權重齊全時秒過。
# POSIX sh，可在 curlimages/curl（busybox）內執行。
#
# 權重有兩個來源（內容相同、互為備援）：
#   GitLab generic package registry（實驗室自架，主倉庫）
#   GitHub Release weights-v1（備份倉庫）
# 依 .git/config 的 origin 判斷這份 checkout 從哪邊 clone，就優先抓哪邊；
# 主來源失敗（連不上或 sha256 不符）自動換下一個來源。
#
# manifest 格式：每行「<release資產名> <sha256> <bytes> <相對ENGINE_ROOT路徑>」，
# 以 '#' 開頭為註解。注意：檔尾必須有換行，否則最後一行會被 read 迴圈略過。
set -eu

GITLAB_WEIGHTS_URL="https://ciot.imis.ncku.edu.tw:25388/api/v4/projects/50/packages/generic/weights/weights-v1"
GITHUB_WEIGHTS_URL="https://github.com/kvgh-rehabilitation-system/KVGH/releases/download/weights-v1"

ENGINE_ROOT="${ENGINE_ROOT:-/engine/2D_and_3D_project}"
MANIFEST="${MANIFEST:-$(dirname "$0")/weights_manifest.txt}"

# .git/config 位置：容器內由 compose 掛 /repo-git，主機上直跑則取 repo 根目錄
if [ -z "${REPO_GIT_CONFIG:-}" ]; then
    if [ -f /repo-git/config ]; then
        REPO_GIT_CONFIG=/repo-git/config
    else
        REPO_GIT_CONFIG="$(dirname "$0")/../.git/config"
    fi
fi

# 決定來源順序：WEIGHTS_BASE_URLS（空白分隔多來源）> WEIGHTS_BASE_URL（單來源）
# > 依 origin 自動判斷 > 預設 GitLab 優先（GitLab 是主倉庫）
if [ -n "${WEIGHTS_BASE_URLS:-}" ]; then
    BASE_URLS="$WEIGHTS_BASE_URLS"
elif [ -n "${WEIGHTS_BASE_URL:-}" ]; then
    BASE_URLS="$WEIGHTS_BASE_URL"
else
    # 抓 [remote "origin"] 區段內第一個 url =（zip 下載沒有 .git、
    # 開發機的 remotes 叫 github/gitlab 沒有 origin：都會取回空字串走預設）
    origin_url=""
    if [ -f "$REPO_GIT_CONFIG" ]; then
        origin_url="$(sed -n '/^\[remote "origin"\]/,/^\[/s/^[[:space:]]*url[[:space:]]*=[[:space:]]*//p' \
            "$REPO_GIT_CONFIG" | head -n 1)"
    fi
    case "$origin_url" in
        *github.com*)
            BASE_URLS="$GITHUB_WEIGHTS_URL $GITLAB_WEIGHTS_URL"
            echo "[weights] clone 自 GitHub，來源順序：GitHub → GitLab" ;;
        *ciot.imis.ncku.edu.tw*)
            BASE_URLS="$GITLAB_WEIGHTS_URL $GITHUB_WEIGHTS_URL"
            echo "[weights] clone 自 GitLab，來源順序：GitLab → GitHub" ;;
        *)
            BASE_URLS="$GITLAB_WEIGHTS_URL $GITHUB_WEIGHTS_URL"
            echo "[weights] 無法判斷 clone 來源，預設順序：GitLab → GitHub" ;;
    esac
fi

fail=0
while IFS=' ' read -r asset sha size target; do
    # 跳過空行與註解
    [ -n "$asset" ] || continue
    case "$asset" in '#'*) continue ;; esac

    dest="$ENGINE_ROOT/$target"
    # 既有檔只驗大小不驗 sha256：1.5GB 全部重算雜湊會拖慢每次 compose up，
    # sha256 只在新下載時驗（下方），足以擋掉下載截斷/損毀
    if [ -f "$dest" ] && [ "$(wc -c < "$dest")" -eq "$size" ]; then
        echo "[weights] OK        $target"
        continue
    fi

    mkdir -p "$(dirname "$dest")"
    # 先落 .part 再 mv：避免下載中斷留下「大小剛好但內容殘缺」的檔案
    # 被下次啟動的大小檢查誤判為完好
    tmp="$dest.part"
    ok=0
    for base in $BASE_URLS; do
        echo "[weights] download  $asset  <-  $base"
        if ! curl -fSL --retry 3 --retry-delay 5 -o "$tmp" "$base/$asset"; then
            echo "[weights] WARN: $asset 從此來源下載失敗，嘗試下一個來源" >&2
            rm -f "$tmp"
            continue
        fi
        # 新下載必驗 sha256：不符（來源檔壞掉/被改）同樣換下一個來源
        actual="$(sha256sum "$tmp" | cut -d' ' -f1)"
        if [ "$actual" != "$sha" ]; then
            echo "[weights] WARN: $asset sha256 不符（got $actual, want $sha），嘗試下一個來源" >&2
            rm -f "$tmp"
            continue
        fi
        # 驗證通過才原子改名到正式路徑
        mv "$tmp" "$dest"
        echo "[weights] done      $target"
        ok=1
        break
    done
    if [ "$ok" -ne 1 ]; then
        echo "[weights] ERROR: $asset 所有來源都失敗" >&2
        fail=1
    fi
done < "$MANIFEST"

# 非零 exit code 讓 weights-init 服務失敗 → workers 的 depends_on 條件不成立、不啟動
if [ "$fail" -ne 0 ]; then
    echo "[weights] 有權重下載失敗，workers 不會啟動；修復後重跑 docker compose up -d" >&2
fi
exit "$fail"
