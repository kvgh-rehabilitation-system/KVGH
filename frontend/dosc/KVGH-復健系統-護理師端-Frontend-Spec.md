# KVGH 復健系統－護理師端 Frontend Spec

## 1. 問題分析

護理師端的主要責任不是診斷病患或修改醫生的醫療決策，而是依照醫生建立的復健計畫，完成實際執行、紀錄與異常回報。

護理師端第一版收斂為三個主導覽頁：

1. 首頁
2. 我的病患
3. 復健執行

「執行紀錄」不作為獨立主導覽頁。

每一筆執行紀錄都必須依附於：

- 指定病患
- 指定復健計畫
- 指定復健任務或執行日期

因此護理師必須先從今日任務、我的病患或復健計畫進入，才能新增本次執行紀錄。

「異常回報」也不作為獨立主導覽頁，而是整合在本次執行紀錄中，由護理師勾選是否需要醫生處理。

---

## 2. 角色責任與權限

### 2.1 護理師可以執行

- 查看分派給自己的病患
- 查看病患基本資料
- 查看醫生診斷摘要
- 查看目前有效的復健計畫
- 查看醫生安排的復健項目
- 開始本次復健
- 填寫本次執行紀錄
- 記錄疼痛分數與病患反應
- 記錄未完成原因
- 提交異常回報
- 查看自己過去建立的執行紀錄

### 2.2 護理師不可執行

- 修改醫生診斷
- 修改看診紀錄
- 自行建立醫療診斷
- 修改復健計畫目標
- 修改復健計畫版本
- 結束或取消復健計畫
- 刪除歷史執行紀錄

### 2.3 核心原則

> 醫生決定「要做什麼」。

> 護理師負責「實際做了什麼，以及病患反應如何」。

---

## 3. 資訊架構

```text
護理師端
│
├── 首頁
│   ├── 今日復健任務
│   ├── 待執行任務
│   ├── 已完成任務
│   └── 需要注意的病患
│
├── 我的病患
│   └── 病患詳細資料
│       ├── 基本資料
│       ├── 醫生診斷摘要
│       ├── 目前有效復健計畫
│       ├── 最近執行紀錄
│       └── 開始復健
│
└── 復健執行
    ├── 復健任務列表
    └── 復健執行詳細
        ├── 計畫內容
        ├── 本次執行項目
        ├── 疼痛與反應
        ├── 完成狀態
        └── 異常回報
```

---

# 4. 全域 Layout

## 4.1 Sidebar

### 導覽項目

```text
KVGH Rehabilitation

[首頁]
[我的病患]
[復健執行]

----------------

護理師資訊
護理師姓名
登出
```

### Route

| 導覽 | Route |
|---|---|
| 首頁 | `/nurse/dashboard` |
| 我的病患 | `/nurse/patients` |
| 復健執行 | `/nurse/rehabilitation-tasks` |

---

## 4.2 Header 共用資訊

```text
頁面名稱

目前登入：
林護理師
```

可選擇顯示：

- 今日日期
- 所屬單位
- 未完成任務數
- 通知數量

---

# 5. 首頁 Dashboard

## 5.1 頁面目的

首頁回答：

1. 今天需要協助哪些病患
2. 還有多少復健任務尚未執行
3. 哪些任務已完成
4. 哪些病患需要優先注意

首頁定位為：

> 護理師今日復健工作總覽

首頁不直接顯示全部病患，也不顯示其他護理師負責的任務。

---

## 5.2 Header

```text
早安，林護理師

2026 年 7 月 10 日
今日復健工作總覽
```

---

## 5.3 Summary Cards

```text
┌──────────────┐
│ 今日任務      │
│     16        │
└──────────────┘

┌──────────────┐
│ 待執行        │
│      7        │
└──────────────┘

┌──────────────┐
│ 執行中        │
│      1        │
└──────────────┘

┌──────────────┐
│ 已完成        │
│      8        │
└──────────────┘
```

### Card Data

```ts
interface NurseDashboardSummary {
  todayTaskCount: number;
  pendingTaskCount: number;
  inProgressTaskCount: number;
  completedTaskCount: number;
  attentionRequiredCount: number;
}
```

---

## 5.4 今日復健任務

### 預設排序

1. 已超過預定時間
2. 需要注意
3. 待執行
4. 執行中
5. 已完成

### Table Columns

| 欄位 | 說明 |
|---|---|
| 時間 | 預定執行時間 |
| 病患 | 姓名與病患編號 |
| 計畫 | 復健計畫名稱 |
| 本次項目 | 本次需要執行的項目摘要 |
| 狀態 | 待執行 / 執行中 / 已完成 / 未完成 |
| 注意事項 | 疼痛、禁忌或醫生備註 |
| 操作 | 查看 / 開始復健 |

### UI

```text
今日復健任務

[全部] [待執行] [執行中] [已完成]

---------------------------------------------------------

09:00

王小明
P000001

腰椎復健計畫
腰部伸展、核心訓練

狀態：待執行
注意：避免過度彎腰

[查看病患] [開始復健]
```

### Interaction

點擊「查看病患」：

```text
/nurse/patients/:patientId
```

點擊「開始復健」：

```text
/nurse/rehabilitation-tasks/:taskId/execute
```

系統必須由 `taskId` 自動帶入：

- 病患
- 復健計畫
- 本次復健項目
- 預定日期
- 負責護理師

不可建立沒有病患與復健計畫的空白執行紀錄。

---

## 5.5 需要注意

顯示當日執行前需要注意的資訊。

### 顯示條件

- 上次疼痛分數明顯增加
- 上次復健未完成
- 醫生新增注意事項
- 病患連續多次缺席
- 計畫已被醫生調整
- 計畫即將到評估日期

### UI

```text
需要注意

王小明
腰椎復健計畫

上次疼痛：6 / 10
上次狀況：核心訓練未完成
醫生備註：本次降低訓練強度

[查看病患]
```

---

# 6. 我的病患

## 6.1 頁面目的

顯示目前分派給登入護理師的病患。

不顯示系統內所有病患。

頁面核心功能：

> 找到目前由自己負責的病患

若病患已經沒有任何分派給此護理師的有效計畫，預設不顯示於「我的病患」。

歷史病患可透過篩選查看。

---

## 6.2 Header

```text
我的病患

查看目前由我負責的復健病患
```

---

## 6.3 Search

```text
[搜尋病患姓名、病患編號________________] [搜尋]
```

### Search Fields

- patientName
- patientNumber

---

## 6.4 Filters

```text
負責狀態
[目前負責]
[歷史病患]

復健狀態
[全部]
[進行中]
[待評估]
[暫停]
[已結案]

今日任務
[全部]
[今日有任務]
[今日已完成]
[今日未完成]
```

預設：

```text
目前負責 + 全部復健狀態
```

---

## 6.5 Patient Table

| 欄位 | 說明 |
|---|---|
| 病患 | 姓名與病患編號 |
| 目前計畫 | 最新有效復健計畫 |
| 計畫狀態 | 進行中 / 待評估 / 暫停 |
| 今日任務 | 無 / 待執行 / 已完成 |
| 最近執行 | 最近一次復健日期 |
| 最近疼痛 | 最近一次疼痛分數 |
| 操作 | 查看 |

### UI

```text
病患           目前計畫          今日任務     最近執行      操作

王小明         腰椎復健計畫      待執行       2026/07/08   [查看]

陳小華         肩部復健計畫      已完成       2026/07/10   [查看]

林大偉         膝部復健計畫      無           2026/07/07   [查看]
```

### Interaction

點擊病患：

```text
/nurse/patients/:patientId
```

---

# 7. 病患詳細資料

## 7.1 頁面目的

讓護理師在執行復健前，快速確認：

1. 目前服務的病患是誰
2. 醫生診斷與注意事項
3. 目前應執行哪一個復健計畫
4. 上次執行結果如何
5. 今天是否有待執行任務

護理師不需要查看醫生所有完整看診內容。

只顯示執行復健所需的診斷摘要與醫囑。

---

## 7.2 Patient Header

```text
王小明

病患編號：P000001
45 歲 / 男

目前狀態：復健中

[開始今日復健]
```

### Button Rule

只有存在今日待執行任務時，顯示：

```text
[開始今日復健]
```

沒有今日任務時：

```text
[查看目前計畫]
```

---

## 7.3 Patient Summary

```text
┌────────────────┐
│ 目前有效計畫    │
│ 1               │
└────────────────┘

┌────────────────┐
│ 今日待執行      │
│ 1               │
└────────────────┘

┌────────────────┐
│ 最近執行        │
│ 2026/07/08      │
└────────────────┘

┌────────────────┐
│ 最近疼痛        │
│ 4 / 10          │
└────────────────┘
```

---

## 7.4 Tabs

```text
[病患概覽]
[目前計畫]
[執行紀錄]
```

---

## 7.5 病患概覽 Tab

### 基本資料

- 姓名
- 病患編號
- 出生日期
- 年齡
- 性別
- 必要聯絡資訊

避免顯示與復健執行無關的敏感資訊。

### 醫生診斷摘要

```text
主要診斷：
腰部肌肉拉傷

復健原因：
腰部疼痛與活動度下降

醫生注意事項：
避免過度彎腰；疼痛超過 7 分時停止本次訓練。
```

### 今日任務

```text
今日任務：待執行

腰部伸展
核心訓練
熱敷

預定時間：09:00

[開始復健]
```

### 最近執行結果

```text
執行日期：2026/07/08

完成狀態：部分完成
疼痛分數：4 / 10

病患反應：
核心訓練時出現輕微疼痛。

[查看完整紀錄]
```

---

# 8. 目前計畫 Tab

## 8.1 頁面目的

顯示病患目前有效的復健計畫。

護理師只能查看，不可修改。

如果病患同時有多個有效計畫，分別顯示。

---

## 8.2 Plan Header

```text
腰椎復健計畫

狀態：進行中
目前版本：V2

建立醫生：王醫師
負責護理師：林護理師

開始日期：2026/07/01
預計評估：2026/07/15
```

---

## 8.3 復健目標

```text
1. 降低腰部疼痛
2. 改善腰部活動度
3. 提升核心穩定度
```

---

## 8.4 復健項目

| 項目 | 頻率 | 執行方式 | 注意事項 |
|---|---|---|---|
| 腰部伸展 | 每週 3 次 | 每次 15 分鐘 | 疼痛增加時停止 |
| 核心訓練 | 每週 2 次 | 依病患耐受程度 | 避免過度負重 |
| 熱敷 | 每週 3 次 | 每次 20 分鐘 | 注意皮膚狀況 |

### 權限

```text
護理師：唯讀
醫生：可建立、調整與結束
```

---

## 8.5 計畫版本提示

護理師預設只需要看到目前有效版本。

若醫生剛調整計畫，顯示：

```text
此計畫已於 2026/07/09 更新為 V2

變更摘要：
核心訓練由每週 3 次調整為每週 2 次。

[我已確認]
```

「我已確認」只代表護理師已閱讀，不代表修改計畫。

---

# 9. 執行紀錄 Tab

## 9.1 頁面目的

查看此病患過去的復健執行紀錄。

預設顯示目前有效計畫的執行紀錄。

可切換查看歷史計畫。

---

## 9.2 Filters

```text
計畫
[目前計畫]
[歷史計畫]

執行結果
[全部]
[已完成]
[部分完成]
[未完成]
[異常回報]
```

---

## 9.3 Execution Timeline

```text
2026/07/08
────────────────────────

執行人員：
林護理師

完成狀態：
部分完成

執行項目：
✓ 腰部伸展
△ 核心訓練
✓ 熱敷

執行前疼痛：
3 / 10

執行後疼痛：
4 / 10

病患反應：
核心訓練時出現輕微疼痛。

異常回報：
否

[查看詳細]
```

---

# 10. 復健執行列表

## 10.1 頁面目的

顯示分派給登入護理師的復健任務。

此頁面以：

> 本次需要完成的復健任務

為核心。

與「我的病患」的差異：

- 我的病患：以病患為主
- 復健執行：以每日任務為主

---

## 10.2 Header

```text
復健執行

查看與完成分派給我的復健任務
```

---

## 10.3 Summary

```text
┌──────────────┐
│ 今日任務      │
│     16        │
└──────────────┘

┌──────────────┐
│ 待執行        │
│      7        │
└──────────────┘

┌──────────────┐
│ 部分完成      │
│      2        │
└──────────────┘

┌──────────────┐
│ 未完成        │
│      1        │
└──────────────┘
```

---

## 10.4 Search and Filters

```text
搜尋
[病患姓名 / 病患編號 / 計畫名稱________]

日期
[今天] [本週] [自訂日期]

狀態
[全部]
[待執行]
[執行中]
[已完成]
[部分完成]
[未完成]

優先程度
[全部]
[一般]
[需要注意]
[逾時]
```

預設：

```text
今天 + 待執行與執行中
```

---

## 10.5 Task Table

| 欄位 | 說明 |
|---|---|
| 預定時間 | 任務預定開始時間 |
| 病患 | 姓名與病患編號 |
| 計畫 | 復健計畫名稱 |
| 本次項目 | 執行項目數量或摘要 |
| 狀態 | 任務狀態 |
| 優先程度 | 一般 / 注意 / 逾時 |
| 操作 | 查看 / 開始 / 繼續 |

### UI

```text
時間    病患       計畫              狀態       操作

09:00   王小明     腰椎復健計畫      待執行     [開始]

10:00   陳小華     肩部復健計畫      執行中     [繼續]

11:30   林大偉     膝部復健計畫      已完成     [查看]
```

---

# 11. 復健執行詳細

## 11.1 Entry

入口可以來自：

```text
首頁 → 今日復健任務 → 開始復健
```

```text
我的病患 → 病患詳細資料 → 開始今日復健
```

```text
復健執行 → 任務列表 → 開始
```

以上入口都必須導向同一個任務：

```text
/nurse/rehabilitation-tasks/:taskId/execute
```

---

## 11.2 執行頁 Header

```text
本次復健執行

病患：王小明
病患編號：P000001

計畫：腰椎復健計畫
版本：V2

預定時間：2026/07/10 09:00
```

### 顯示注意事項

```text
注意事項

醫生備註：
疼痛超過 7 分時停止訓練。

上次執行：
核心訓練時疼痛由 3 分增加至 4 分。
```

---

## 11.3 執行前評估

### Fields

- 執行前疼痛分數
- 病患當下狀況
- 是否適合開始
- 執行前備註

### UI

```text
執行前疼痛分數

0 ─────────────── 10
目前：3

病患當下狀況

○ 狀況正常
○ 輕微不適
○ 明顯不適
○ 不適合執行

執行前備註

[________________________________________]
```

### Rule

選擇「不適合執行」時：

- 不可勾選一般完成
- 必須填寫未執行原因
- 預設開啟異常回報選項

---

## 11.4 本次執行項目

每一個項目獨立記錄。

```text
腰部伸展

計畫要求：
15 分鐘

本次結果：
○ 完成
○ 部分完成
○ 未執行

實際執行：
[ 12 ] 分鐘

備註：
[________________________________________]
```

```text
核心訓練

計畫要求：
2 組，每組 10 次

本次結果：
○ 完成
○ 部分完成
○ 未執行

實際執行：
[ 1 ] 組
[ 8 ] 次

備註：
[________________________________________]
```

### Item Data

```ts
interface RehabilitationExecutionItem {
  planItemId: string;
  itemName: string;
  plannedDescription: string;
  result: "COMPLETED" | "PARTIALLY_COMPLETED" | "NOT_PERFORMED";
  actualValue?: number;
  actualUnit?: string;
  note?: string;
}
```

---

## 11.5 執行後評估

### Fields

- 執行後疼痛分數
- 病患整體反應
- 是否出現異常
- 護理師備註

### UI

```text
執行後疼痛分數

0 ─────────────── 10
目前：4

病患整體反應

○ 良好
○ 普通
○ 輕微不適
○ 明顯不適
○ 無法繼續

護理師備註

[________________________________________]
[________________________________________]
```

---

## 11.6 本次完成狀態

系統可依各項目結果自動建議狀態。

```text
本次完成狀態

○ 已完成
○ 部分完成
○ 未完成
```

### 建議判斷

- 所有項目完成：已完成
- 至少一項部分完成或未執行：部分完成
- 所有項目未執行：未完成

護理師可以調整系統建議，但必須填寫原因。

---

## 11.7 未完成原因

當狀態為「部分完成」或「未完成」時必填。

```text
未完成原因

□ 病患疼痛增加
□ 病患身體不適
□ 病患拒絕
□ 病患遲到
□ 設備不可用
□ 醫療因素
□ 其他

補充說明

[________________________________________]
```

---

# 12. 異常回報

## 12.1 頁面定位

異常回報整合在本次執行紀錄中，不設置獨立主導覽。

目的：

> 將需要醫生重新評估的狀況，附著在實際執行紀錄上。

---

## 12.2 是否回報醫生

```text
是否需要醫生處理？

○ 否
○ 是，建立異常回報
```

選擇「是」後顯示：

```text
異常類型

□ 疼痛明顯增加
□ 無法完成復健項目
□ 病患出現新症狀
□ 病患狀況持續無改善
□ 建議調整復健計畫
□ 其他

嚴重程度

○ 一般
○ 優先
○ 緊急

回報內容

[________________________________________]
[________________________________________]
```

---

## 12.3 自動建議回報條件

符合下列條件時，系統顯示提醒，但不自動代替護理師提交：

- 執行後疼痛比執行前增加 3 分以上
- 疼痛分數達 7 分以上
- 病患無法繼續
- 所有復健項目未執行
- 連續兩次以上部分完成
- 出現新的身體症狀

### UI

```text
系統提醒

本次疼痛分數增加較多，建議回報醫生重新評估。

[建立異常回報]
```

---

# 13. 儲存與提交

## 13.1 Action Buttons

```text
[暫存]
[取消]
[完成並提交]
```

### 暫存

- 任務狀態變更為「執行中」
- 可稍後繼續填寫
- 不建立正式完成紀錄

### 完成並提交

提交前驗證：

- 執行前疼痛分數已填寫
- 每一個復健項目都有結果
- 執行後疼痛分數已填寫
- 本次完成狀態已填寫
- 部分完成或未完成時已有原因
- 建立異常回報時已有異常類型與內容

提交後：

- 建立不可直接刪除的執行紀錄
- 任務狀態更新為已完成、部分完成或未完成
- 若有異常回報，建立醫生待處理項目

---

## 13.2 提交完成畫面

```text
本次復健紀錄已完成

病患：王小明
計畫：腰椎復健計畫
完成狀態：部分完成

異常回報：已送出

[返回今日任務]
[查看執行紀錄]
```

---

# 14. 任務與紀錄狀態

## 14.1 任務狀態

```ts
type RehabilitationTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";
```

| 狀態 | 中文 |
|---|---|
| PENDING | 待執行 |
| IN_PROGRESS | 執行中 |
| COMPLETED | 已完成 |
| PARTIALLY_COMPLETED | 部分完成 |
| NOT_COMPLETED | 未完成 |
| CANCELLED | 已取消 |

---

## 14.2 異常回報狀態

```ts
type IncidentReportStatus =
  | "NOT_REQUIRED"
  | "PENDING_DOCTOR_REVIEW"
  | "REVIEWED"
  | "CLOSED";
```

---

# 15. Frontend Data Types

## 15.1 Nurse Patient Summary

```ts
interface NursePatientSummary {
  patientId: string;
  patientNumber: string;
  patientName: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  activePlanCount: number;
  currentPlanName?: string;
  currentPlanStatus?: string;
  todayTaskStatus?: RehabilitationTaskStatus;
  latestExecutionDate?: string;
  latestPainScore?: number;
}
```

---

## 15.2 Rehabilitation Task

```ts
interface RehabilitationTask {
  taskId: string;
  patientId: string;
  patientName: string;
  patientNumber: string;

  planId: string;
  planName: string;
  planVersion: number;

  assignedNurseId: string;
  scheduledStartAt: string;

  status: RehabilitationTaskStatus;
  priority: "NORMAL" | "ATTENTION" | "OVERDUE";

  itemCount: number;
  itemSummary: string[];

  doctorNote?: string;
  previousExecutionNote?: string;
}
```

---

## 15.3 Execution Record

```ts
interface RehabilitationExecutionRecord {
  executionId: string;
  taskId: string;

  patientId: string;
  planId: string;
  planVersion: number;

  nurseId: string;
  executedAt: string;

  painScoreBefore: number;
  painScoreAfter: number;

  conditionBefore:
    | "NORMAL"
    | "MILD_DISCOMFORT"
    | "SIGNIFICANT_DISCOMFORT"
    | "NOT_SUITABLE";

  reactionAfter:
    | "GOOD"
    | "NORMAL"
    | "MILD_DISCOMFORT"
    | "SIGNIFICANT_DISCOMFORT"
    | "UNABLE_TO_CONTINUE";

  result:
    | "COMPLETED"
    | "PARTIALLY_COMPLETED"
    | "NOT_COMPLETED";

  items: RehabilitationExecutionItem[];

  incompleteReasons?: string[];
  nurseNote?: string;

  requiresDoctorReview: boolean;
  incidentReportId?: string;

  createdAt: string;
}
```

---

# 16. Frontend Route Spec

```ts
const nurseRoutes = [
  {
    path: "/nurse/dashboard",
    page: "NurseDashboardPage",
  },
  {
    path: "/nurse/patients",
    page: "NursePatientListPage",
  },
  {
    path: "/nurse/patients/:patientId",
    page: "NursePatientDetailPage",
  },
  {
    path: "/nurse/rehabilitation-tasks",
    page: "RehabilitationTaskListPage",
  },
  {
    path: "/nurse/rehabilitation-tasks/:taskId",
    page: "RehabilitationTaskDetailPage",
  },
  {
    path: "/nurse/rehabilitation-tasks/:taskId/execute",
    page: "RehabilitationExecutionPage",
  },
  {
    path: "/nurse/executions/:executionId",
    page: "RehabilitationExecutionDetailPage",
  },
];
```

---

# 17. 建議 Component Structure

```text
src/
├── pages/
│   └── nurse/
│       ├── dashboard/
│       │   └── NurseDashboardPage
│       │
│       ├── patients/
│       │   ├── NursePatientListPage
│       │   └── NursePatientDetailPage
│       │
│       ├── rehabilitation-tasks/
│       │   ├── RehabilitationTaskListPage
│       │   ├── RehabilitationTaskDetailPage
│       │   └── RehabilitationExecutionPage
│       │
│       └── executions/
│           └── RehabilitationExecutionDetailPage
│
├── components/
│   └── nurse/
│       ├── NurseSidebar
│       ├── NurseDashboardSummaryCard
│       ├── TodayTaskTable
│       ├── AttentionPatientCard
│       ├── NursePatientSearchBar
│       ├── NursePatientFilter
│       ├── NursePatientTable
│       ├── NursePatientHeader
│       ├── DoctorDiagnosisSummary
│       ├── ActiveRehabilitationPlanCard
│       ├── RehabilitationTaskTable
│       ├── RehabilitationTaskHeader
│       ├── PreExecutionAssessment
│       ├── ExecutionItemForm
│       ├── PostExecutionAssessment
│       ├── ExecutionResultSelector
│       ├── IncompleteReasonForm
│       ├── IncidentReportForm
│       └── ExecutionTimeline
```

---

# 18. 頁面操作流程

## 18.1 今日任務流程

```text
首頁
↓
查看今日復健任務
↓
選擇待執行任務
↓
確認病患與醫生注意事項
↓
填寫執行前評估
↓
依計畫執行各復健項目
↓
填寫執行後評估
↓
選擇完成狀態
↓
必要時建立異常回報
↓
完成並提交
```

---

## 18.2 從病患進入流程

```text
我的病患
↓
搜尋病患
↓
病患詳細資料
↓
查看目前計畫與最近紀錄
↓
開始今日復健
↓
進入指定任務
```

---

## 18.3 異常處理流程

```text
執行過程發現異常
↓
停止或調整本次實際執行
↓
記錄未完成項目與原因
↓
填寫疼痛與病患反應
↓
建立異常回報
↓
提交執行紀錄
↓
醫生端產生待處理提醒
```

---

# 19. 空狀態與錯誤狀態

## 19.1 今日沒有任務

```text
今天沒有待執行的復健任務。
```

---

## 19.2 沒有負責病患

```text
目前沒有分派給你的復健病患。
```

---

## 19.3 計畫已被調整

護理師開啟舊任務時，若計畫版本已更新：

```text
此復健計畫已更新。

請先確認最新版本後再開始執行。

[查看最新計畫]
```

不可繼續使用失效版本建立新的執行紀錄。

---

## 19.4 任務已被其他人完成

```text
此任務已由其他執行人員完成，無法重複提交。

[查看執行紀錄]
```

---

## 19.5 重複提交保護

提交按鈕送出後：

- 立即停用按鈕
- 顯示提交中狀態
- 使用 request id 或 idempotency key
- 避免建立兩筆相同執行紀錄

---

# 20. 結論

護理師端第一版主導覽固定為：

```text
首頁
我的病患
復健執行
```

核心工作流程：

```text
首頁
↓
查看今天需要完成的復健任務

我的病患
↓
找到目前負責的病患
↓
查看醫生診斷摘要與目前有效計畫

復健執行
↓
選擇指定任務
↓
確認計畫與注意事項
↓
完成本次復健
↓
記錄疼痛、病患反應與完成狀態
↓
必要時回報醫生
```

核心設計原則：

> 首頁負責「今天要做什麼」。

> 我的病患負責「目前要照顧哪些病患」。

> 復健執行負責「這次實際做了什麼」。

> 執行紀錄必須綁定病患、復健計畫與指定任務。

> 護理師只能執行與記錄，不可修改醫生建立的復健計畫。

> 異常回報附著於執行紀錄，不另外建立主導覽頁。
