import { Copy, Download, Plus, Redo2, Search, Undo2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddDepModal, type NewDepFields } from './components/AddDepModal';
import { BatchBar } from './components/BatchBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DepTable } from './components/DepTable';
import { DetailPanel, type DepPatch } from './components/DetailPanel';
import { ImportModal } from './components/ImportModal';
import { Sidebar, type View } from './components/Sidebar';
import { ToastHost, type ToastMsg } from './components/Toast';
import { buildMarkdown, downloadFile, type EvaluatedDep } from './lib/exporter';
import { evaluateLicense } from './lib/risk';
import { sampleDeps } from './lib/sample';
import { loadState, saveState } from './lib/storage';
import { validateNameUnique } from './lib/validate';
import type { Dep, ReviewStatus, RiskLevel, Settings, Workspace } from './lib/types';
import { DEFAULT_SETTINGS, newId, REVIEW_LABEL } from './lib/types';
import { useHistory } from './hooks/useHistory';

type SortMode = 'risk' | 'name' | 'recent';

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续尝试回退方案 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  // 启动：优先读取本地持久化数据，首次运行载入示例数据
  const [boot] = useState(() => {
    const stored = loadState();
    return stored
      ? { ws: stored, seeded: false }
      : { ws: { deps: sampleDeps(), settings: DEFAULT_SETTINGS }, seeded: true };
  });
  const { present, commit, undo, redo, canUndo, canRedo } = useHistory<Workspace>(boot.ws);

  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewStatus>('all');
  const [sort, setSort] = useState<SortMode>('risk');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; confirmLabel: string; action: () => void } | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const toastSeq = useRef(0);

  const pushToast = useCallback((text: string, kind: ToastMsg['kind'] = 'ok') => {
    const id = ++toastSeq.current;
    setToasts((ts) => [...ts, { id, text, kind }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2600);
  }, []);

  // 持久化：任何状态变化后自动保存
  useEffect(() => {
    saveState(present);
    setSavedAt(new Date());
  }, [present]);

  // 撤销/重做快捷键（输入框内不劫持浏览器默认行为）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // 依赖删除/撤销后，清理失效的选择与详情
  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = new Set(present.deps.map((d) => d.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
    if (activeId && !present.deps.some((d) => d.id === activeId)) setActiveId(null);
  }, [present.deps, activeId]);

  const evaluated: EvaluatedDep[] = useMemo(
    () => present.deps.map((dep) => ({ dep, eval: evaluateLicense(dep.license, present.settings) })),
    [present],
  );

  const stats = useMemo(
    () => ({
      total: evaluated.length,
      high: evaluated.filter((i) => i.eval.level === 'high').length,
      medium: evaluated.filter((i) => i.eval.level === 'medium').length,
      low: evaluated.filter((i) => i.eval.level === 'low').length,
      pending: evaluated.filter((i) => i.dep.review === 'pending').length,
    }),
    [evaluated],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = evaluated.filter(({ dep, eval: ev }) => {
      if (riskFilter !== 'all' && ev.level !== riskFilter) return false;
      if (reviewFilter !== 'all' && dep.review !== reviewFilter) return false;
      if (q && !`${dep.name} ${dep.license} ${dep.owner}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.dep.name.localeCompare(b.dep.name);
      if (sort === 'recent') return b.dep.addedAt - a.dep.addedAt;
      return RISK_ORDER[a.eval.level] - RISK_ORDER[b.eval.level] || a.dep.name.localeCompare(b.dep.name);
    });
  }, [evaluated, query, riskFilter, reviewFilter, sort]);

  const active = activeId ? (evaluated.find((i) => i.dep.id === activeId) ?? null) : null;
  const existingNames = useMemo(() => new Set(present.deps.map((d) => d.name.toLowerCase())), [present.deps]);

  const activeView: View | null =
    riskFilter === 'all' && reviewFilter === 'all'
      ? 'all'
      : riskFilter === 'high' && reviewFilter === 'all'
        ? 'high'
        : riskFilter === 'all' && reviewFilter === 'pending'
          ? 'pending'
          : null;

  const nav = (view: View) => {
    setRiskFilter(view === 'high' ? 'high' : 'all');
    setReviewFilter(view === 'pending' ? 'pending' : 'all');
  };
  const clearFilters = () => {
    setQuery('');
    setRiskFilter('all');
    setReviewFilter('all');
  };

  // —— 数据操作（全部进入撤销历史） ——
  const addDep = (f: NewDepFields) => {
    const dupError = validateNameUnique(f.name, existingNames);
    if (dupError) {
      pushToast(`${dupError}，未保存`, 'warn');
      return;
    }
    const dep: Dep = {
      id: newId(),
      ...f,
      source: '手动录入',
      review: 'pending',
      owner: '',
      alternative: '',
      note: '',
      addedAt: Date.now(),
    };
    commit((ws) => ({ ...ws, deps: [...ws.deps, dep] }));
    setShowAdd(false);
    setActiveId(dep.id);
    pushToast(`已添加 ${dep.name}，状态为待处理`);
  };

  const saveDep = (id: string, patch: DepPatch) => {
    const self = present.deps.find((d) => d.id === id);
    const dupError = validateNameUnique(patch.name, existingNames, self?.name);
    if (dupError) {
      pushToast(`${dupError}，未保存`, 'warn');
      return;
    }
    commit((ws) => ({ ...ws, deps: ws.deps.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
    pushToast('已保存更改');
  };

  const deleteDep = (id: string) => {
    const dep = present.deps.find((d) => d.id === id);
    setConfirm({
      title: '删除依赖',
      body: `确定删除 ${dep?.name ?? '该依赖'} 吗？删除后可通过撤销（Ctrl+Z）恢复。`,
      confirmLabel: '删除',
      action: () => {
        commit((ws) => ({ ...ws, deps: ws.deps.filter((d) => d.id !== id) }));
        pushToast(`已删除 ${dep?.name ?? '依赖'}`, 'info');
      },
    });
  };

  const importDeps = (rows: NewDepFields[]) => {
    const now = Date.now();
    const deps: Dep[] = rows.map((r, i) => ({
      id: newId(),
      ...r,
      source: '批量导入',
      review: 'pending',
      owner: '',
      alternative: '',
      note: '',
      addedAt: now + i,
    }));
    commit((ws) => ({ ...ws, deps: [...ws.deps, ...deps] }));
    setShowImport(false);
    pushToast(`已导入 ${deps.length} 条依赖，状态为待处理`);
  };

  const batchSetReview = (status: ReviewStatus) => {
    const ids = selectedIds;
    commit((ws) => ({ ...ws, deps: ws.deps.map((d) => (ids.has(d.id) ? { ...d, review: status } : d)) }));
    pushToast(`已将 ${ids.size} 项标记为「${REVIEW_LABEL[status]}」`);
  };

  const batchAssignOwner = (owner: string) => {
    const ids = selectedIds;
    commit((ws) => ({ ...ws, deps: ws.deps.map((d) => (ids.has(d.id) ? { ...d, owner } : d)) }));
    pushToast(`已为 ${ids.size} 项指派负责人 ${owner}`);
  };

  const batchDelete = () => {
    const ids = selectedIds;
    setConfirm({
      title: '批量删除',
      body: `确定删除选中的 ${ids.size} 条依赖吗？删除后可通过撤销（Ctrl+Z）恢复。`,
      confirmLabel: `删除 ${ids.size} 项`,
      action: () => {
        commit((ws) => ({ ...ws, deps: ws.deps.filter((d) => !ids.has(d.id)) }));
        setSelectedIds(new Set());
        pushToast(`已删除 ${ids.size} 条依赖`, 'info');
      },
    });
  };

  const clearAll = () => {
    setConfirm({
      title: '清空全部数据',
      body: `将删除全部 ${present.deps.length} 条依赖记录与审查进度（可通过撤销恢复）。`,
      confirmLabel: '全部清空',
      action: () => {
        commit((ws) => ({ ...ws, deps: [] }));
        setBannerDismissed(true);
        pushToast('已清空全部数据', 'info');
      },
    });
  };

  const changeSettings = (settings: Settings) => commit((ws) => ({ ...ws, settings }));

  // —— 导出 ——
  const doExport = () => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const md = buildMarkdown(evaluated, present.settings, now);
    downloadFile(`license-review-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.md`, md, 'text/markdown');
    pushToast('交接摘要已导出为 Markdown');
  };

  const doCopy = async () => {
    const ok = await copyText(buildMarkdown(evaluated, present.settings, new Date()));
    pushToast(ok ? '摘要已复制到剪贴板' : '复制失败，请使用导出按钮', ok ? 'ok' : 'warn');
  };

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    const visible = filtered.map((r) => r.dep.id);
    const allIn = visible.length > 0 && visible.every((id) => selectedIds.has(id));
    setSelectedIds(allIn ? new Set() : new Set(visible));
  };

  const showBanner = boot.seeded && !bannerDismissed && present.deps.length > 0;

  return (
    <div className="shell">
      <Sidebar
        activeView={activeView}
        counts={{ total: stats.total, pending: stats.pending, high: stats.high }}
        settings={present.settings}
        savedAt={savedAt}
        onNav={nav}
        onSettings={changeSettings}
        onClearAll={clearAll}
      />

      <main>
        <header>
          <div>
            <div className="crumb">
              LICENSE LENS / <b>发布前审查</b>
            </div>
            <h1>许可证风险审查</h1>
            <p>按分发方式与规则严格度评估依赖风险，处理待办项后导出交接摘要。</p>
          </div>
          <div className="head-actions">
            <div className="undo-group">
              <button className="outline icon" onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
                <Undo2 size={15} />
              </button>
              <button className="outline icon" onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)">
                <Redo2 size={15} />
              </button>
            </div>
            <button className="outline" onClick={() => setShowImport(true)}>
              <Upload size={15} />
              批量导入
            </button>
            <button className="outline" onClick={doExport}>
              <Download size={15} />
              导出摘要
            </button>
            <button className="outline icon" onClick={doCopy} title="复制摘要到剪贴板">
              <Copy size={15} />
            </button>
            <button className="primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              添加依赖
            </button>
          </div>
        </header>

        {showBanner && (
          <div className="banner">
            <span>当前为示例数据，可直接体验各项功能；清空后即可录入真实依赖。</span>
            <button className="link" onClick={clearAll}>
              清空示例数据
            </button>
            <button className="banner-x" onClick={() => setBannerDismissed(true)} aria-label="关闭提示">
              <X size={14} />
            </button>
          </div>
        )}

        <section className="summary">
          <button className={activeView === 'all' ? 'stat on' : 'stat'} onClick={() => nav('all')}>
            <span>全部依赖</span>
            <b>{stats.total}</b>
            <small>已评估 {stats.total} 条</small>
          </button>
          <button className={riskFilter === 'high' ? 'stat on' : 'stat'} onClick={() => nav('high')}>
            <span>高风险</span>
            <b className="red">{stats.high}</b>
            <small>需替换或豁免</small>
          </button>
          <button
            className={riskFilter === 'medium' ? 'stat on' : 'stat'}
            onClick={() => {
              setRiskFilter('medium');
              setReviewFilter('all');
            }}
          >
            <span>需复核</span>
            <b className="orange">{stats.medium}</b>
            <small>存在许可义务</small>
          </button>
          <button
            className={reviewFilter === 'pending' && riskFilter === 'all' ? 'stat on' : 'stat'}
            onClick={() => nav('pending')}
          >
            <span>待处理</span>
            <b className="teal">{stats.pending}</b>
            <small>等待审查结论</small>
          </button>
        </section>

        <section className={active ? 'workspace' : 'workspace solo'}>
          <div className="table-pane">
            <div className="pane-head">
              <div>
                <h2>依赖清单</h2>
                <p>
                  {filtered.length} / {stats.total} 条
                </p>
              </div>
              <div className="tools">
                <div className="search">
                  <Search size={14} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称 / 许可证 / 负责人" />
                </div>
                <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as 'all' | RiskLevel)} aria-label="按风险筛选">
                  <option value="all">全部风险</option>
                  <option value="high">高风险</option>
                  <option value="medium">需复核</option>
                  <option value="low">低风险</option>
                </select>
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value as 'all' | ReviewStatus)}
                  aria-label="按审查状态筛选"
                >
                  <option value="all">全部状态</option>
                  {Object.entries(REVIEW_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="排序方式">
                  <option value="risk">风险优先</option>
                  <option value="name">名称 A→Z</option>
                  <option value="recent">最近添加</option>
                </select>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <BatchBar
                count={selectedIds.size}
                onSetReview={batchSetReview}
                onAssignOwner={batchAssignOwner}
                onDelete={batchDelete}
                onClear={() => setSelectedIds(new Set())}
              />
            )}

            <DepTable
              rows={filtered}
              totalCount={stats.total}
              selectedIds={selectedIds}
              activeId={activeId}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              onOpen={(id) => setActiveId(id)}
              onClearFilters={clearFilters}
              onAdd={() => setShowAdd(true)}
              onImport={() => setShowImport(true)}
            />
          </div>

          {active && (
            <DetailPanel
              key={active.dep.id}
              item={active}
              settings={present.settings}
              existingNames={existingNames}
              onSave={saveDep}
              onDelete={deleteDep}
              onClose={() => setActiveId(null)}
            />
          )}
        </section>
      </main>

      {showAdd && (
        <AddDepModal settings={present.settings} existingNames={existingNames} onAdd={addDep} onClose={() => setShowAdd(false)} />
      )}
      {showImport && <ImportModal existingNames={existingNames} onImport={importDeps} onClose={() => setShowImport(false)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          onConfirm={() => {
            confirm.action();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <ToastHost toasts={toasts} />
    </div>
  );
}
