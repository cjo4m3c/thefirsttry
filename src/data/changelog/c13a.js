/**
 * Changelog archive chunk c13a (frozen — do not edit).
 * Split from c13.js (17.7KB → c13a 9KB + c13b 9KB, 2026-05-11) so neither
 * half exceeds the 15KB soft cap. Contains the newer half (entries dated
 * 2026-04-28); c13b holds the older half (2026-04-27).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-28',
    title: 'L3 活動操作優化（R + S）：tooltip 可新增 / 編輯 L3，連線下拉可選 L3，L3 連線缺失改顯示專屬 warning',
    items: [
      '**R.4 + S 修連線下拉漏選 L3**（使用者：「現在 tooltip 新增連線無法選到圖上的 L3」+「在流程圖上 tooltip 新增連線時，可以選到 L3 活動元件」）：root cause = `ConnectionSection.jsx:14` filter `t.type === "gateway" || t.roleId`，L3 activity 沒設 roleId 時被擋掉。修法：filter 同時放行 `t.type === "l3activity"`',
      '**R.5 L3 沒前後連線顯示專屬 warning**（使用者：「遇到 L3 活動元件沒有符合前後連線規則時，跳出針對 L3 的提醒訊息，但是仍然可以存檔」）：`FlowEditor.validateFlow` 的「未設定下一步」/「沒有任何任務連接到此節點」warnings 對 `t.type === "l3activity"` 改成「L3 活動 5-3-2 未設定下一步：若該 L3 流向另一張流程圖可忽略此提醒，否則請補上連線」。仍是 warning level（不擋儲存）',
      '**R.3 ContextMenu 內可改 L3 編號**（使用者：「不管在哪裡編輯 L3 元件時，都可以自行編輯 L3 編號、L3 活動名稱等資訊」）：ContextMenu inline edit fields 在 `task.type === "l3activity"` 時多顯示一個「L3 編號（被調用的子流程）」input，直接改 `task.subprocessName`。原本 RightDrawer 的 ConnectionSection 也能改，現在 tooltip 也能改',
      '**R.2 tooltip 加「新增 L3 活動」**（使用者：「在流程圖上 tooltip 新增任務的時候，可以選到 L3 活動元件」）：ContextMenu 新加按鈕「📚 新增 L3 活動（子流程調用）」+ sub-form（L3 編號 + L3 名稱）。`FlowEditor.addL3ActivityAfter(anchorId, l3Number, l3Name)` 建立 `type: "l3activity"` + `connectionType: "subprocess"` task，name = 活動名、subprocessName = L3 編號；anchor → newL3 → anchor 原本的下一步（保留序列）',
      '**R.6 移除「在前面新增任務」**（使用者：「移除往前加任務的選項，統一使用行爲是加元件會加在後面」）：ContextMenu 拿掉 `onAddBefore` 按鈕；FlowEditor 端同步移除 `onAddBefore={addTaskBefore}` 連線（`addTaskBefore` 函式保留以免影響其他呼叫）',
      '**Q3 連線端點換到 L3 上 — 驗證已可用**（使用者：「目前應該要可以做到點擊連線後…我希望 L3 活動元件也適用」）：audit `DiagramRenderer.findTaskAtPoint:580` + `changeConnectionTarget:513` 都只排除 `type === "start"`，L3 activity 已是合法 drop target。不需改 code，待手動驗證',
      '**七視圖檢核**：本次改動涉及 task.type === "l3activity"、task.subprocessName 兩欄位，七視圖共用 source — ① Dashboard ② DiagramRenderer ③ FlowEditor/Wizard/RightDrawer ④ FlowTable ⑤ excelExport ⑥ drawioExport ⑦ PNG 自動同步',
      '**驗證**：`npm run build` pass',
    ],
  },
  {
    date: '2026-04-28',
    title: '閘道前綴補齊（Q：編輯器路徑也補）+ tooltip 新增閘道時可同步編輯條件標籤（T）',
    items: [
      '**Q. 編輯器路徑閘道前綴補齊**（使用者：「不管是從圖上還是從編輯器中新增，L4 任務名稱欄位自動補上前綴 [排他閘道]」）：圖上路徑（ContextMenu「新增閘道」）原本就有，但編輯器路徑（TaskCard 改 connectionType dropdown）漏了。`taskDefs.js:applyConnectionType` return 加 `name: applyGatewayPrefix(task.name, newGwType)`；換成 gateway 自動加前綴、換回 sequence 自動 strip 前綴',
      '**applyGatewayPrefix 擴充**：第二個參數可傳 null/undefined 表示「只 strip 不加」，給「閘道→sequence」用',
      '**T. tooltip 新增閘道時可同步編輯條件標籤**（使用者：「現在 Tooltip 上只能選擇閘道的流向，但無法同步編輯閘道流向的條件說明」）：`ContextMenu` 新增閘道 sub-form 兩個分支各加一個條件標籤 input（XOR/OR placeholder「條件標籤（如「已核准」）」、AND placeholder「條件標籤（選填）」）；`submitGateway` 多傳 label1/label2；`FlowEditor.insertGatewayAfter(anchorId, gatewayType, targetId1, targetId2, label1, label2)` 把 label 填入 `conditions[].label`',
      '**驗證**：`npm run build` pass；`/tmp/trace-gateway-q.mjs` 6 個情境驗 Q（sequence→xor 加前綴、空名加前綴、xor→sequence 去前綴、xor→or 換前綴、idempotent、null strips）',
      '**七視圖檢核**：Q 改的是 task.name（七視圖共用 source），T 改的是 task.conditions[].label（七視圖共用 source），改完 ① Dashboard ② DiagramRenderer ③ FlowEditor/Wizard/RightDrawer ④ FlowTable ⑤ excelExport ⑥ drawioExport ⑦ PNG 自動同步顯示新前綴 / 新 label',
      '**新工作流規則（2026-04-28 立）**（使用者：「累積 3-5 個修改後，一起重新抽換內容…由我決定要現在更新還是再做一些修正後再更新」）：每完成 N 個小修改（小改 5 / 大改 3）後，主動提醒使用者要不要停下來更新 changelog / 文件 / 清 redundant 程式碼。減少 manual paste-bundle 次數。已寫進 `CLAUDE.md` §6',
    ],
  },
  {
    date: '2026-04-28',
    title: '流程圖字級 +40% 放大（會議室遠看）+ 編輯頁 +1 級 + 標題 em-dash 對稱 + 七視圖檢核升格',
    items: [
      '**情境**（使用者：「我的目的是確保從會議室比較遠的位置也可以看清楚流程圖上的內容」）：流程圖上所有字（編號、元件內字、元件下方說明）整體放大；同步把編輯頁字級放大一級；元件等比放大避免擠字',
      '**K. 標題 em-dash 對稱**：`DiagramRenderer.jsx:751` 標題 `1-1-1 活動名稱　— 業務活動泳道圖` em-dash 左側全形空格、右側半形空格 → 改成兩側都全形空格 `　—　`（CJK 慣例）',
      '**L. 流程圖元件 / 字級 +40%**（`src/diagram/constants.js`）：`NODE_W` 128→180、`NODE_H` 52→72、`COL_W` 168→224、`LANE_H` 140→196、`DIAMOND_SIZE` 38→54、`CIRCLE_R` 22→32、`LANE_HEADER_W` 130→180、`TITLE_H` 54→74、`PADDING_RIGHT/BOTTOM` 40→56。`drawioExport.js` 與 `layout.js` 都讀 LAYOUT，自動跟進',
      '**L. 流程圖字級 +40%**（`DiagramRenderer.jsx`）：標題 16→22、泳道角色 13→18（lineH 16→22，wrap 5→7 CJK）、任務名 11.5→16、L4 編號 9→13、閘道下標 10.5→15、連線標籤 10→14、Start/End 名稱 10→14、Start/End 描述 9→13、子流程標 10→14',
      '**L. 任務名截斷規則**（使用者：「最多 12-15 字，可接受超過 15 字者不顯示」→ 採總數 16 字 hard cap）：`wrapText` 加 `maxTotal` 參數，超過自動截斷加「…」；`SvgLabel` 預設 `maxTotal=16`、`maxChars=10`（NODE_W=180 / 16px CJK 字寬約 10 字一行，2 行最多 16 字）；閘道下標也用同 cap',
      '**L. 編輯頁字級 +1 Tailwind 級**（`FlowEditor.jsx` / `Wizard.jsx` / `FlowTable.jsx`）：text-xs → text-sm、text-sm → text-base、text-base → text-lg、text-lg → text-xl、text-xl → text-2xl，整體往上一階保持 `ui-rules` §8 字級表相對比例。Dashboard 不在本次範圍（保持原級，未來可再單獨 bump）',
      '**ui-rules §8 同步**：補上「+1 級」欄位（編輯/Wizard/Table 用）與「原級」欄位（Dashboard 仍用），新元件依 +1 級欄。註明 2026-04-28 起雙級並存',
      '**七視圖一致性檢核 升格為 PR 前第 1 步**（`CLAUDE.md` §8）：使用者明確要求「現在開始所有的更新都要再更新後，同步確認包含網頁中流程圖、網頁首頁、網頁表格欄位、編輯器、下載的三種資料，都有同步資訊」。原 4 視圖 invariant 升格為 7 視圖（首頁卡片 / 流程圖 / 編輯器 / 表格 / Excel 下載 / drawio 下載 / PNG 下載），列為硬性檢核 step 1，遞延既有 1-7 步為 2-8',
      '**Push SOP 強化**（`CLAUDE.md` §2 + `paste-bundle.md`）：使用者：「push 如果檔案太大會導致 timeout，試過一次失敗後就請改手動」+「commit message 請放在後面，不然要再滑上去不符合使用習慣」→ §2 改成「>15KB 直接走手動，不要試 MCP；MCP 失敗一次立即切手動，禁止重試」；`paste-bundle.md` 步驟 C 改成 commit message 放在貼上指引最尾端',
      '**驗證**：`npm run build` pass；`/tmp/trace-wraptext.mjs` 6 個情境驗 wrapText：短任務不截、14/16 CJK 不截、23 CJK 截到 16+「…」、Latin 26 字不截、空字串、CJK+Latin 混合都正確',
      '**七視圖檢核**：① 流程圖（DiagramRenderer 字級 +40% ✓）② 編輯器（FlowEditor / Wizard 字級 +1 ✓）③ 表格（FlowTable 字級 +1 ✓）④ Excel / drawio / PNG（drawioExport / excelExport 用 LAYOUT 常數，等比例放大 ✓）⑤ 首頁 Dashboard（本次未動，未來可再 bump）',
    ],
  },
];
