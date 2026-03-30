export const DEFAULT_INPUT = `title: 建立商機報價

lanes:
  - name: 客戶
  - name: BG/BU業務
  - name: BG/BU PM
  - name: BG/BU Head

steps:
  - id: s1
    lane: 客戶
    type: start
    label: 客戶提出報價請求

  - id: s2
    lane: BG/BU業務
    type: task
    label: 確認商機需求

  - id: s3
    lane: BG/BU PM
    type: task
    label: 收集成本資料

  - id: s4
    lane: BG/BU業務
    type: task
    label: 建立報價單

  - id: s5
    lane: BG/BU Head
    type: task
    label: 執行報價單簽核

  - id: s6
    lane: BG/BU Head
    type: gateway
    label: 是否核准

  - id: s7
    lane: BG/BU業務
    type: task
    label: 寄送報價單

  - id: s8
    lane: 客戶
    type: gateway
    label: 是否接受報價單

  - id: s9
    lane: 客戶
    type: end
    label: 結束

  - id: s10
    lane: 客戶
    type: gateway
    label: 是否繼續報價

  - id: s11
    lane: 客戶
    type: end
    label: 結束

connections:
  - from: s1
    to: s2
  - from: s1
    to: s3
  - from: s2
    to: s4
  - from: s3
    to: s4
  - from: s4
    to: s5
  - from: s5
    to: s6
  - from: s6
    to: s7
    label: "是"
  - from: s6
    to: s4
    label: "否"
  - from: s7
    to: s8
  - from: s8
    to: s9
    label: "是"
  - from: s8
    to: s10
    label: "否"
  - from: s10
    to: s4
    label: "是"
  - from: s10
    to: s11
    label: "否"
`;
