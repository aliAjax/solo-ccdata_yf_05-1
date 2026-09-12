import type { Dep, Settings, Workspace } from './types';
import { DEFAULT_SETTINGS } from './types';

const KEY = 'license-lens-workbench-v1';

const REVIEW_VALUES = ['pending', 'approved', 'exempted', 'replaced'];
const DISTRIBUTION_VALUES = ['internal', 'saas', 'binary', 'source'];
const STRICTNESS_VALUES = ['lenient', 'standard', 'strict'];

function isValidDep(d: unknown): d is Dep {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.version === 'string' &&
    typeof o.license === 'string' &&
    typeof o.source === 'string' &&
    typeof o.owner === 'string' &&
    typeof o.alternative === 'string' &&
    typeof o.note === 'string' &&
    typeof o.addedAt === 'number' &&
    REVIEW_VALUES.includes(o.review as string)
  );
}

/** 读取持久化状态；数据缺失或损坏时返回 null（由调用方回退到示例数据）。 */
export function loadState(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Workspace>;
    if (!Array.isArray(data.deps) || !data.deps.every(isValidDep)) return null;
    const s = (data.settings ?? {}) as Partial<Settings>;
    return {
      deps: data.deps,
      settings: {
        distribution: DISTRIBUTION_VALUES.includes(s.distribution as string)
          ? (s.distribution as Settings['distribution'])
          : DEFAULT_SETTINGS.distribution,
        strictness: STRICTNESS_VALUES.includes(s.strictness as string)
          ? (s.strictness as Settings['strictness'])
          : DEFAULT_SETTINGS.strictness,
      },
    };
  } catch {
    return null;
  }
}

export function saveState(state: Workspace): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用（隐私模式/配额满）时静默失败，不影响使用
  }
}
