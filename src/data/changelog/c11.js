/**
 * Changelog archive chunk c11 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-24',
    title: '精靈步驟指引加第 3 步「流程編輯」',
    items: [
      '**情境**：使用者：「現在只有兩步驟，我希望把 Flow editor 那頁也加入成第三步，這樣使用者才知道最後要去編輯流程」',
      'Wizard 上方的步驟指示器從 2 步改顯示 3 步（`L3 基本資訊` → `泳道角色` → `流程編輯`）；第 3 步只是視覺提示，實際點「進入編輯流程 →」後會跳到 FlowEditor',
      '程式碼用 `LAST_WIZARD_STEP = 1` 區隔：導航邏輯仍只在 step 0/1 運作，step 2 只在指示器上顯示',
    ],
  },
  {
    date: '2026-04-24',
    title: 'FlowEditor 加回儲存前檢核：blocking（擋儲存）+ warning（跳 modal 由使用者決定）',
    items: [
      '**情境**：使用者：「在 flow editor 介面還是有之前的流程圖檢核條件，但是改成：必要條件……跳出提醒由使用者決定是否儲存」',
      '**Blocking（4 條，擋儲存、紅色 modal）**：① 必須有開始事件、② 必須有結束事件、③ 開始事件必須連接到其他任務（有 outgoing）、④ 結束事件必須有其他任務連接到它（有 incoming）',
      '**Warning（5 條，跳黃色 modal 讓使用者點「仍然儲存」或「取消」）**：① 非結束節點必須設定下一步、② 並行合併 ≥2 來源、③ 條件合併 ≥2 來源、④ 每個節點必須被連接（除開始外）、⑤ 迴圈返回必須指定目標',
      '純檢核在儲存前做；置頂（pin）星星按鈕和 FlowTable 儲存走另一條不檢核的路徑（直接 `onSave`），避免影響「看完就置頂」的流暢體驗',
      'CLAUDE.md 規則 10.1 新增「規則 5：流程儲存檢核兩層」，定義未來擴充 blocking / warning 的分類原則',
    ],
  },
  {
    date: '2026-04-23',
    title: '冗餘程式碼清理:抽共用 drag 元件 + 移除死 prop / 未用 import / 未用 export',
    items: [
      '**抽出 `src/components/dragReorder.jsx`**：`useDragReorder` hook 與 `DragHandle` 元件原本在 `Wizard.jsx` 與 `FlowEditor.jsx` 各複製一份（≈46 行 × 2），現在抽到共用檔案，兩邊 import 使用',
      '**移除死 prop 鏈 `onView` / `handleView`**：`App.jsx` 傳 `onView` 給 `Dashboard` 但 `Dashboard` 內從未呼叫，整條鏈刪除',
      '**移除未用 import `generateId`**（FlowEditor.jsx）、**未用常數 `L3_INSET`**（DiagramRenderer.jsx）',
      '**`buildExcelRows` 由 `export` 降為 module-internal**：只被同檔的 `exportFlowToExcel` 使用',
      '淨減 39 行（扣除新增 `dragReorder.jsx` 55 行）；修改 6 檔、新增 1 檔',
    ],
  },
  {
    date: '2026-04-23',
    title: '精靈改為 2 步（L3 資訊 → 角色）後直接進 FlowEditor',
    items: [
      '**情境**：使用者：「手動新增工作流的頁面中，設定完流程任務後，可以直接顯示像上傳 excel 時一樣的編輯畫面」',
      '原本精靈 4 步（L3 資訊 → 角色 → L4 任務 → 預覽）；L4 任務編輯跟 FlowEditor 畫面功能重複，匯入 Excel 則是直接跳 FlowEditor，兩條路徑體驗不一致',
      '**精靈縮成 2 步**：`L3 基本資訊` → `泳道角色`；按「進入編輯流程」後直接打開 FlowEditor，由 FlowEditor 統一處理任務新增 / 連線設定 / 儲存',
      '新工作流自動 seed 最小 3 個任務（開始 → 一般任務 → 結束）並套用第一個已命名角色，讓 FlowEditor 一開啟就有可編輯的基礎',
      '移除 Wizard 內部的 `Step3`（L4 任務）、`Step4`（預覽）與所有相關 sub-component / 驗證邏輯（536 行 → 311 行）',
      '「新增 L3 活動」顯示字串也同步改為「新增 L3 工作流」，跟首頁按鈕一致',
    ],
  },
  {
    date: '2026-04-23',
    title: '首頁按鈕統一樣式 + FlowEditor 儲存旁加置頂星星',
    items: [
      '**首頁按鈕樣式統一**：使用者：「上傳 Excel、新增 L3 活動按鈕大小及字體都改成一樣，且上傳 Excel 按鈕使用網頁主色」。兩顆按鈕改為相同 `px-5 py-2` 尺寸與 `#2A5598` 主色',
      '**「新增 L3 活動」改名為「新增 L3 工作流」**',
      '**FlowEditor 儲存按鈕旁加置頂星星**：使用者：「我希望在儲存按鈕旁邊也可以有一個星星符號讓使用者可以看完就置頂這個工作流」。點擊立即切換 pinned 並即時儲存，不用回首頁才能置頂',
    ],
  },
  {
    date: '2026-04-23',
    title: '閘道 backward 條件在 sibling 搶走 top 時改共用 top + 收緊 corridor guard',
    items: [
      '**情境**：使用者：「從排他閘道其中一個條件「駁回」出發的線條，現在是走上方，會遇到後發生的線條……先發生的先決定位置，所以要改 5-7-2-4 的連線方式」（5-3-3 未核准 loop-back 被擠到 bottom，繞到底部被任務擋住）',
      '**根因 1**：Phase 3 sibling fallback 的 Pass 2 缺失。當 forward 條件（核准 top/left）先搶走 top exit，backward 條件（未核准）找不到乾淨選項就退回 `priorities[0]`（bottom），但 bottom 有 `dr<-1` 的長垂直問題，最後 `bottom/right` 繞到下方被任務擋住',
      '**修正 1**：加入 Pass 2 sibling-sharing priority walk — 若 Pass 1 找不到乾淨 exit，照 priority list 再走一次，這次允許共用 sibling 已佔用的 port（但仍擋 port-mix、橫向 obstacle、長垂直 corridor）',
      '驗證 5-3-3：未核准從 `bottom/right` 改成 `top/top`，兩條條件共用 GW 的 top exit（5-7-2-4 也是一樣原理，兩條 IN 共用目標 TOP）',
      '**根因 2**：`corridorBlockedByFuturePhase3dVertical` 太嚴格 — 只要內側欄位的任務有 cross-row forward next 就當成 corridor 被擋，但 Phase 3d 可能走 Option A（垂直在 tc，不會切 corridor）或預設（垂直在 midX）',
      '**修正 2**：真實模擬 Phase 3d 的觸發條件 — 先檢查 `defaultBad`（Phase 3d 會不會觸發），再檢查 `optionABlocked`（是否會 fall through 到 Option B），兩者都為 true 才判定 corridor 被切',
      '驗證 5-2-6：駁回仍正確走 `bottom/bottom`（intermediate task 5-2-6-4 default 被 5-2-6-5 擋 + option A 也被 5-2-6-5 擋 → Option B 成立 → guard 正確觸發）',
    ],
  },
];
