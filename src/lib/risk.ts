import { CATEGORY_OBLIGATIONS } from './licenses';
import { categoryOf, parseSpdx } from './spdx';
import type { Category, Distribution, Evaluation, RiskLevel, Settings, Strictness } from './types';

/**
 * 风险基分：许可证类别 × 分发方式。
 * 0 无义务负担，1 轻微，2 需要流程配合，3 与当前分发方式冲突。
 */
const MATRIX: Record<Category, Record<Distribution, number>> = {
  permissive: { internal: 0, saas: 0, binary: 0, source: 0 },
  weak: { internal: 0, saas: 1, binary: 2, source: 2 },
  strong: { internal: 1, saas: 1, binary: 3, source: 3 },
  network: { internal: 1, saas: 3, binary: 3, source: 3 },
  proprietary: { internal: 3, saas: 3, binary: 3, source: 3 },
  unknown: { internal: 2, saas: 2, binary: 2, source: 2 },
};

/** 规则严格度：分数 → 风险等级的阈值。 */
const THRESHOLDS: Record<Strictness, { high: number; medium: number }> = {
  lenient: { high: 3, medium: 2 },
  standard: { high: 3, medium: 1 },
  strict: { high: 2, medium: 1 },
};

const REASONS: Record<Category, Partial<Record<Distribution, string>> & { any: string }> = {
  permissive: { any: '宽松型许可证，保留版权与许可声明即可自由分发' },
  weak: {
    any: '弱著佐权许可证，需注意链接与修改开源义务',
    binary: '弱著佐权：随二进制分发时需提供库源码并允许用户替换/重新链接',
    source: '弱著佐权：以源码形式分发时，对库的修改需以相同条款开源',
  },
  strong: {
    any: '强著佐权许可证，衍生作品须整体开源',
    binary: '强著佐权：随二进制分发时，衍生作品整体须以相同许可证开源并提供源码',
    source: '强著佐权：以源码分发时，衍生作品整体须以相同许可证开源',
    internal: '强著佐权：仅内部使用不触发开源义务，但需避免进入对外分发产物',
    saas: '强著佐权：纯服务端使用通常不触发开源义务，注意勿随客户端产物分发',
  },
  network: {
    any: '网络著佐权许可证，网络使用即可能触发开源义务',
    saas: '网络著佐权：通过网络提供服务即须向用户开放源码，与 SaaS 模式冲突',
    binary: '网络著佐权：分发时衍生作品须整体开源',
    source: '网络著佐权：分发时衍生作品须整体开源',
  },
  proprietary: { any: '非开源/受限条款，需确认商业授权或使用范围限制' },
  unknown: { any: '许可证无法识别，发布前需人工核查 LICENSE 文件' },
};

export function evaluateLicense(licenseExpr: string, settings: Settings): Evaluation {
  const parsed = parseSpdx(licenseExpr);
  if (!parsed.ok || !parsed.ast) {
    return {
      ok: false,
      error: parsed.error ?? '许可证表达式无效',
      level: 'high',
      score: 3,
      category: 'unknown',
      reasons: [`许可证表达式无效：${parsed.error}`],
      obligations: CATEGORY_OBLIGATIONS.unknown,
      unknownIds: [],
      normalized: licenseExpr,
    };
  }

  const category = categoryOf(parsed.ast);
  const score = MATRIX[category][settings.distribution];
  const t = THRESHOLDS[settings.strictness];
  const level: RiskLevel = score >= t.high ? 'high' : score >= t.medium ? 'medium' : 'low';

  const reasons: string[] = [REASONS[category][settings.distribution] ?? REASONS[category].any];
  if (parsed.unknownIds.length > 0) {
    reasons.push(`未识别的许可证标识：${parsed.unknownIds.join('、')}，按未知类别处理`);
  }
  if (settings.strictness === 'strict' && (category === 'unknown' || category === 'proprietary')) {
    reasons.push('严格规则下，未知或受限许可证直接按高风险处理');
  }
  if (settings.strictness === 'lenient' && level === 'low' && score > 0) {
    reasons.push('宽松规则下该义务等级可接受，保留声明即可');
  }

  return {
    ok: true,
    level,
    score,
    category,
    reasons,
    obligations: CATEGORY_OBLIGATIONS[category],
    unknownIds: parsed.unknownIds,
    normalized: parsed.normalized,
  };
}
