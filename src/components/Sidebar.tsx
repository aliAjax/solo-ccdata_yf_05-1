import { AlertTriangle, Clock3, Layers3, ListChecks, ShieldCheck, Trash2 } from 'lucide-react';
import type { Settings } from '../lib/types';
import { DISTRIBUTION_LABEL, STRICTNESS_LABEL } from '../lib/types';

export type View = 'all' | 'pending' | 'high';

interface SidebarProps {
  activeView: View | null;
  counts: { total: number; pending: number; high: number };
  settings: Settings;
  savedAt: Date | null;
  onNav: (view: View) => void;
  onSettings: (settings: Settings) => void;
  onClearAll: () => void;
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function Sidebar({ activeView, counts, settings, savedAt, onNav, onSettings, onClearAll }: SidebarProps) {
  return (
    <aside>
      <div className="brand">
        <div className="brand-icon">
          <ShieldCheck size={18} />
        </div>
        <div>
          <b>License Lens</b>
          <small>许可证风险审查工作台</small>
        </div>
      </div>

      <div className="nav-title">审查视图</div>
      <button className={activeView === 'all' ? 'nav active' : 'nav'} onClick={() => onNav('all')}>
        <Layers3 size={16} />
        全部依赖
        <span>{counts.total}</span>
      </button>
      <button className={activeView === 'pending' ? 'nav active' : 'nav'} onClick={() => onNav('pending')}>
        <ListChecks size={16} />
        待处理
        <span>{counts.pending}</span>
      </button>
      <button className={activeView === 'high' ? 'nav active' : 'nav'} onClick={() => onNav('high')}>
        <AlertTriangle size={16} />
        高风险
        <span className="red">{counts.high}</span>
      </button>

      <div className="nav-title">评估规则</div>
      <div className="rule">
        <label htmlFor="rule-distribution">分发方式</label>
        <select
          id="rule-distribution"
          value={settings.distribution}
          onChange={(e) => onSettings({ ...settings, distribution: e.target.value as Settings['distribution'] })}
        >
          {Object.entries(DISTRIBUTION_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="rule">
        <label htmlFor="rule-strictness">规则严格度</label>
        <select
          id="rule-strictness"
          value={settings.strictness}
          onChange={(e) => onSettings({ ...settings, strictness: e.target.value as Settings['strictness'] })}
        >
          {Object.entries(STRICTNESS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p className="rule-hint">风险等级按「许可证类别 × 分发方式」计算，严格度决定判定阈值。</p>

      <div className="aside-bottom">
        <div className="save-state">
          <Clock3 size={14} />
          <span>{savedAt ? `已自动保存 · ${fmtTime(savedAt)}` : '更改将自动保存到本地'}</span>
        </div>
        <button className="clear-all" onClick={onClearAll}>
          <Trash2 size={14} />
          清空全部数据
        </button>
      </div>
    </aside>
  );
}
