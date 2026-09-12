import { ChevronRight, FileQuestion, Inbox, Plus, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { EvaluatedDep } from '../lib/exporter';
import { LicenseBadge, ReviewBadge, RiskBadge } from './badges';

interface DepTableProps {
  rows: EvaluatedDep[];
  totalCount: number;
  selectedIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
  onClearFilters: () => void;
  onAdd: () => void;
  onImport: () => void;
}

export function DepTable({
  rows,
  totalCount,
  selectedIds,
  activeId,
  onToggle,
  onToggleAll,
  onOpen,
  onClearFilters,
  onAdd,
  onImport,
}: DepTableProps) {
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.has(r.dep.id));
  const someChecked = rows.some((r) => selectedIds.has(r.dep.id));
  const headRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = !allChecked && someChecked;
  }, [allChecked, someChecked]);

  if (totalCount === 0) {
    return (
      <div className="empty">
        <Inbox size={40} strokeWidth={1.4} />
        <h3>还没有依赖记录</h3>
        <p>录入单个依赖，或批量导入 JSON / CSV 依赖清单开始审查。</p>
        <div className="empty-actions">
          <button className="primary" onClick={onAdd}>
            <Plus size={15} />
            添加依赖
          </button>
          <button className="outline" onClick={onImport}>
            <Upload size={15} />
            批量导入
          </button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty">
        <FileQuestion size={40} strokeWidth={1.4} />
        <h3>没有匹配的依赖</h3>
        <p>当前筛选条件下没有结果，调整搜索词或清除筛选试试。</p>
        <div className="empty-actions">
          <button className="outline" onClick={onClearFilters}>
            清除全部筛选
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="table">
      <div className="tr th">
        <span className="col-check">
          <input
            ref={headRef}
            type="checkbox"
            checked={allChecked}
            onChange={onToggleAll}
            aria-label="全选当前列表"
          />
        </span>
        <span>依赖名称</span>
        <span>版本</span>
        <span>许可证</span>
        <span>风险</span>
        <span>审查状态</span>
        <span>负责人</span>
        <span />
      </div>
      {rows.map(({ dep, eval: ev }) => (
        <div
          key={dep.id}
          className={dep.id === activeId ? 'tr selected' : 'tr'}
          onClick={() => onOpen(dep.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen(dep.id);
            }
          }}
        >
          <span className="col-check" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedIds.has(dep.id)}
              onChange={() => onToggle(dep.id)}
              aria-label={`选择 ${dep.name}`}
            />
          </span>
          <span className="dep-name">{dep.name}</span>
          <span className="muted">{dep.version}</span>
          <span>
            <LicenseBadge license={ev.normalized} category={ev.category} />
          </span>
          <span>
            <RiskBadge level={ev.level} />
          </span>
          <span>
            <ReviewBadge status={dep.review} />
          </span>
          <span className="muted">{dep.owner || '—'}</span>
          <span className="col-arrow">
            <ChevronRight size={14} />
          </span>
        </div>
      ))}
    </div>
  );
}
