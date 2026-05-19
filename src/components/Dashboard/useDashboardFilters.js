/**
 * useDashboardFilters — Dashboard 篩選 / 排序 / 分頁 state 管理。
 *
 * 抽自 Dashboard/index.jsx（PR #242、§6 軟超 15KB 拆 hook）。
 * 集中 13 個 state 中的 5 個（sortKey / view / keyword / l2 / filterRoles / page）
 * + 持久化邏輯（sortKey localStorage、view localStorage、search sessionStorage）
 * + filter 改變自動 reset page 的 useEffect + clearAllFilters helper。
 *
 * Caller (Dashboard) 從 hook return 取 state + setter + clearAllFilters、其餘
 * pipeline（filter → sort → paginate）仍在 Dashboard 內（依賴 flows props）。
 */
import { useState, useEffect } from 'react';
import { SORT_OPTIONS } from './sortFlows.js';

const VIEW_PREF_KEY = 'bpm_dashboard_view';
const SORT_PREF_KEY = 'flowsprite.dashboardSortKey';
const SEARCH_STATE_KEY = 'flowsprite.dashboardSearch';
const VALID_SORT_KEYS = new Set(SORT_OPTIONS.map(o => o.value));

function loadSearchState() {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return {
      keyword: typeof v.keyword === 'string' ? v.keyword : '',
      l2: typeof v.l2 === 'string' ? v.l2 : '',
      roles: Array.isArray(v.roles) ? v.roles.filter(x => typeof x === 'string') : [],
    };
  } catch { return null; }
}

export function useDashboardFilters() {
  // sortKey localStorage 持久化（PR #234）— 跨 session 記住
  const [sortKey, setSortKey] = useState(() => {
    try {
      const v = localStorage.getItem(SORT_PREF_KEY);
      return v && VALID_SORT_KEYS.has(v) ? v : 'number-asc';
    } catch { return 'number-asc'; }
  });
  useEffect(() => {
    try { localStorage.setItem(SORT_PREF_KEY, sortKey); } catch { /* quota / disabled */ }
  }, [sortKey]);

  // view localStorage 持久化（2026-05-18）— 卡片 / 表格 二選一
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_PREF_KEY);
      return v === 'table' ? 'table' : 'cards';
    } catch { return 'cards'; }
  });
  useEffect(() => {
    try { localStorage.setItem(VIEW_PREF_KEY, view); } catch { /* quota / disabled */ }
  }, [view]);

  // 搜尋 / 篩選 state（PR #235）— sessionStorage 持久化、跨 page navigate
  // 保留、不跨瀏覽器 session（搜尋是臨時行為、不該長期記）
  const initialSearch = loadSearchState();
  const [keyword, setKeyword] = useState(initialSearch?.keyword ?? '');
  const [l2, setL2] = useState(initialSearch?.l2 ?? '');
  const [filterRoles, setFilterRoles] = useState(initialSearch?.roles ?? []);
  useEffect(() => {
    try {
      sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ keyword, l2, roles: filterRoles }));
    } catch { /* quota / disabled */ }
  }, [keyword, l2, filterRoles]);

  const [page, setPage] = useState(1);
  // 篩選改變 → page 自動 reset 到 1（避免「第 3 頁但 filter 後只剩 2 頁」）
  useEffect(() => { setPage(1); }, [keyword, l2, filterRoles]);

  function clearAllFilters() {
    setKeyword('');
    setL2('');
    setFilterRoles([]);
  }

  return {
    sortKey, setSortKey,
    view, setView,
    keyword, setKeyword,
    l2, setL2,
    filterRoles, setFilterRoles,
    page, setPage,
    clearAllFilters,
  };
}
