export type RiskLevel = 'low' | 'medium' | 'high';
export type ReviewStatus = 'pending' | 'approved' | 'exempted' | 'replaced';
export type Distribution = 'internal' | 'saas' | 'binary' | 'source';
export type Strictness = 'lenient' | 'standard' | 'strict';
export type Category = 'permissive' | 'weak' | 'strong' | 'network' | 'proprietary' | 'unknown';

export interface Dep {
  id: string;
  name: string;
  version: string;
  license: string;
  source: string;
  review: ReviewStatus;
  owner: string;
  alternative: string;
  note: string;
  addedAt: number;
}

export interface Settings {
  distribution: Distribution;
  strictness: Strictness;
}

export interface Workspace {
  deps: Dep[];
  settings: Settings;
}

export interface Evaluation {
  ok: boolean;
  error?: string;
  level: RiskLevel;
  score: number;
  category: Category;
  reasons: string[];
  obligations: string[];
  unknownIds: string[];
  normalized: string;
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: '待处理',
  approved: '已批准',
  exempted: '已豁免',
  replaced: '已替换',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '需复核',
  high: '高风险',
};

export const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  internal: '内部使用',
  saas: 'SaaS 网络服务',
  binary: '二进制分发',
  source: '源码分发',
};

export const STRICTNESS_LABEL: Record<Strictness, string> = {
  lenient: '宽松',
  standard: '标准',
  strict: '严格',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  permissive: '宽松型',
  weak: '弱著佐权',
  strong: '强著佐权',
  network: '网络著佐权',
  proprietary: '专有/受限',
  unknown: '未知',
};

export const DEFAULT_SETTINGS: Settings = { distribution: 'binary', strictness: 'standard' };

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
