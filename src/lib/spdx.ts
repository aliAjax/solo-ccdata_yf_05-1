import { KNOWN_EXCEPTIONS, lookupLicense } from './licenses';
import type { Category } from './types';

export type SpdxNode =
  | { kind: 'license'; id: string; exception?: string }
  | { kind: 'or' | 'and'; left: SpdxNode; right: SpdxNode };

export interface SpdxResult {
  ok: boolean;
  error?: string;
  ast?: SpdxNode;
  /** 表达式中出现的全部许可证标识（规范化后） */
  ids: string[];
  /** 未收录进许可证库的标识 */
  unknownIds: string[];
  /** 规范化后的表达式字符串 */
  normalized: string;
}

type Token = '(' | ')' | 'AND' | 'OR' | 'WITH' | { id: string };

function tokenize(input: string): Token[] | string {
  const raw = input.replace(/([()])/g, ' $1 ').split(/\s+/).filter(Boolean);
  if (raw.length === 0) return '许可证不能为空';
  return raw.map((t): Token => {
    if (t === '(' || t === ')') return t;
    const upper = t.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'WITH') return upper;
    return { id: t };
  });
}

/**
 * 解析 SPDX 许可证表达式，如 `MIT`、`(MIT OR Apache-2.0)`、
 * `GPL-3.0-only WITH Classpath-exception-2.0 AND BSD-3-Clause`。
 * 返回结构化错误信息，供表单与批量导入使用。
 */
export function parseSpdx(input: string): SpdxResult {
  const fail = (error: string): SpdxResult => ({ ok: false, error, ids: [], unknownIds: [], normalized: '' });
  const trimmed = input.trim();
  const tokens = tokenize(trimmed);
  if (typeof tokens === 'string') return fail(tokens);

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parsePrimary(): SpdxNode | string {
    const t = next();
    if (t === undefined) return '表达式不完整：缺少许可证标识';
    if (t === '(') {
      const inner = parseOr();
      if (typeof inner === 'string') return inner;
      if (next() !== ')') return '括号不匹配：缺少右括号 )';
      return inner;
    }
    if (typeof t === 'object') {
      let exception: string | undefined;
      if (peek() === 'WITH') {
        next();
        const exc = next();
        if (typeof exc !== 'object') return 'WITH 后需要许可证例外标识';
        exception = exc.id;
      }
      return { kind: 'license', id: t.id, exception };
    }
    return `表达式不完整：不应以 ${t} 开头`;
  }

  function parseAnd(): SpdxNode | string {
    let left = parsePrimary();
    if (typeof left === 'string') return left;
    while (peek() === 'AND') {
      next();
      const right = parsePrimary();
      if (typeof right === 'string') return right;
      left = { kind: 'and', left, right };
    }
    return left;
  }

  function parseOr(): SpdxNode | string {
    let left = parseAnd();
    if (typeof left === 'string') return left;
    while (peek() === 'OR') {
      next();
      const right = parseAnd();
      if (typeof right === 'string') return right;
      left = { kind: 'or', left, right };
    }
    return left;
  }

  const ast = parseOr();
  if (typeof ast === 'string') return fail(ast);
  if (pos < tokens.length) {
    const extra = tokens[pos];
    return fail(`表达式存在多余内容：${typeof extra === 'object' ? extra.id : extra}`);
  }

  // 校验标识并规范化
  const ids: string[] = [];
  const unknownIds: string[] = [];
  let err: string | null = null;

  function render(node: SpdxNode): string {
    if (node.kind === 'license') {
      const info = lookupLicense(node.id);
      const canonical = info ? info.id : node.id;
      ids.push(canonical);
      if (!info && !unknownIds.includes(canonical)) unknownIds.push(canonical);
      if (node.exception) {
        if (!KNOWN_EXCEPTIONS.has(node.exception.toLowerCase())) {
          err = `未知的许可证例外：${node.exception}`;
        }
        return `${canonical} WITH ${node.exception}`;
      }
      return canonical;
    }
    const op = node.kind === 'or' ? ' OR ' : ' AND ';
    return `(${render(node.left)}${op}${render(node.right)})`;
  }

  const normalized = render(ast);
  if (err) return fail(err);
  return { ok: true, ast, ids, unknownIds, normalized };
}

/** 类别风险排序：数值越大越严格。OR 取最小、AND 取最大。 */
const CATEGORY_RANK: Record<Category, number> = {
  permissive: 0,
  weak: 1,
  strong: 2,
  network: 3,
  unknown: 4,
  proprietary: 5,
};

export function categoryOf(node: SpdxNode): Category {
  if (node.kind === 'license') {
    return lookupLicense(node.id)?.category ?? 'unknown';
  }
  const l = categoryOf(node.left);
  const r = categoryOf(node.right);
  // OR：可选其一，取义务最轻的；AND：需同时满足，取义务最重的
  if (node.kind === 'or') return CATEGORY_RANK[l] <= CATEGORY_RANK[r] ? l : r;
  return CATEGORY_RANK[l] >= CATEGORY_RANK[r] ? l : r;
}
