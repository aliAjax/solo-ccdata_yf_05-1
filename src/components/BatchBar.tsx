import { Check, ShieldQuestion, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import type { ReviewStatus } from '../lib/types';

interface BatchBarProps {
  count: number;
  onSetReview: (status: ReviewStatus) => void;
  onAssignOwner: (owner: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BatchBar({ count, onSetReview, onAssignOwner, onDelete, onClear }: BatchBarProps) {
  const [owner, setOwner] = useState('');

  const assign = () => {
    const v = owner.trim();
    if (!v) return;
    onAssignOwner(v);
    setOwner('');
  };

  return (
    <div className="batch-bar">
      <span className="batch-count">
        已选 <b>{count}</b> 项
      </span>
      <button className="chip" onClick={() => onSetReview('approved')}>
        <Check size={13} />
        标记已批准
      </button>
      <button className="chip" onClick={() => onSetReview('exempted')}>
        <ShieldQuestion size={13} />
        标记已豁免
      </button>
      <button className="chip" onClick={() => onSetReview('pending')}>
        重置为待处理
      </button>
      <span className="batch-owner">
        <UserPlus size={13} />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="指派负责人"
          onKeyDown={(e) => {
            if (e.key === 'Enter') assign();
          }}
        />
        <button className="chip" onClick={assign} disabled={!owner.trim()}>
          指派
        </button>
      </span>
      <button className="chip danger-chip" onClick={onDelete}>
        <Trash2 size={13} />
        删除
      </button>
      <button className="batch-clear" onClick={onClear} aria-label="清除选择">
        <X size={14} />
      </button>
    </div>
  );
}
