# FlowSprite

BPM 業務活動泳道圖設計工具。在瀏覽器建立 L3 活動 → L4 任務泳道圖，支援 Excel 匯入/匯出、PNG / Draw.io 下載。

**正式服務**：https://cjo4m3c.github.io/FlowSprite/

## 特色

- **純前端 SPA**，無後端、無帳號系統，資料存在瀏覽器 `localStorage`
- **Excel 雙向**：匯入解析多個 L3 + 閘道 / 合併 / 迴圈返回標記；匯出 10 欄標準 L4 任務清單
- **四種 BPMN 元件**：任務、閘道（XOR / AND / OR）、開始 / 結束事件、L3 活動（雙框）
- **智慧連線路由**：依相對位置自動挑選閘道端點（top / right / bottom / left），避免線條重疊
- **多泳道支援**：內部 / 外部角色分流，自動計算泳道高度
- **批量操作**：首頁多選 → 批量下載 PNG / Draw.io / Excel / 批量刪除
- **置頂 / 排序**：星星 icon 釘選常用 L3；支援編號、更新日期排序
- **鏈完整性警告**：匯入 Excel 時檢查 `X → X_g` 閘道鏈連線完整性

## 技術堆疊

React 18 · Vite 5 · Tailwind CSS 3 · xlsx · html-to-image · Node 22

## 本地開發

```bash
git clone https://github.com/cjo4m3c/FlowSprite.git
cd FlowSprite
npm install
npm run dev       # http://localhost:5173/FlowSprite/
npm run build     # 輸出 dist/
```

## 部署

Push `main` 分支自動觸發 `.github/workflows/deploy.yml` → 發佈到 GitHub Pages（1–2 分鐘完成）。

## 資料儲存提醒

- 所有 L3 活動資料存在**使用者瀏覽器**的 `localStorage`
- 清除瀏覽器資料 / 換裝置 / 換瀏覽器 = **資料全無**
- 唯一備份管道：下載 Excel，之後可重新上傳

## 專案文件

- [**CLAUDE.md**](./CLAUDE.md)：長期規則、編號格式、工作流程 SOP（最重要）
- [**HANDOVER.md**](./HANDOVER.md)：環境盤點、交接手冊
- `src/components/ChangelogPanel.jsx` 的 `CHANGELOG` 陣列：版本更新紀錄（使用者視角）

## 核心編號規則（摘要）

| 元件 | 格式範例 |
|---|---|
| L3 活動 | `1-1-1`（三段，僅 `-` 分隔）|
| L4 任務 | `1-1-1-1`（四段）|
| 開始事件 | `1-1-1-0`（尾碼 `0`）|
| 結束事件 | `1-1-1-99`（尾碼 `99`）|
| 閘道 | `1-1-1-4_g`（前置任務 + `_g`；連續多個用 `_g1`、`_g2`、`_g3`）|

完整規則、regex 常數、哪些算閘道哪些不算 → `CLAUDE.md` 規則 3 + `src/utils/taskDefs.js`。
