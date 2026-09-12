/** 依赖名称与版本号校验。返回 null 表示通过，否则返回中文错误信息。 */

const NAME_RE = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;

export function validateName(name: string): string | null {
  const n = name.trim();
  if (!n) return '名称不能为空';
  if (n.length > 214) return '名称过长（最多 214 个字符）';
  if (/\s/.test(n)) return '名称不能包含空格';
  if (!NAME_RE.test(n)) {
    return '名称格式不正确：仅支持字母、数字及 . _ ~ -，作用域包形如 @scope/name';
  }
  return null;
}

/**
 * 名称唯一性规则（新增、编辑、导入共用，大小写不敏感）。
 * selfName 用于编辑场景：与自身原名相同（忽略大小写）时不视为冲突。
 */
export function validateNameUnique(name: string, existingNames: Set<string>, selfName?: string): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (selfName && key === selfName.trim().toLowerCase()) return null;
  if (existingNames.has(key)) return `已存在同名依赖「${name.trim()}」`;
  return null;
}

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function validateVersion(version: string): string | null {
  const v = version.trim();
  if (!v) return '版本号不能为空';
  if (/^[\^~<>=*\s]/.test(v) || /\|\|/.test(v)) {
    return '请填写实际解析出的版本号（如 1.4.2），不支持 ^ ~ >= 等范围写法';
  }
  if (!SEMVER_RE.test(v)) {
    return '版本号需为语义化版本，如 1.4.2、2.0.0-rc.1';
  }
  return null;
}

/**
 * 批量导入时宽松处理版本：剥离 ^ ~ >= 等范围前缀，返回可直接使用的版本。
 * 无法处理时返回 null。
 */
export function normalizeVersion(raw: string): { version: string; changed: boolean } | null {
  const v = raw.trim();
  if (!v || v === '*' || v.toLowerCase() === 'latest') return null;
  const stripped = v.replace(/^[\^~=\s]+/, '').replace(/^[<>]=?\s*/, '').trim();
  if (!validateVersion(stripped)) return { version: stripped, changed: stripped !== v };
  // 尝试从 "1.2" 这类两段版本补全
  const twoSeg = stripped.match(/^v?(\d+)\.(\d+)$/);
  if (twoSeg) return { version: `${twoSeg[1]}.${twoSeg[2]}.0`, changed: true };
  return null;
}
