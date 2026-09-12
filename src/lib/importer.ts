import { parseSpdx } from './spdx';
import { normalizeVersion, validateName, validateNameUnique, validateVersion } from './validate';

export interface ImportRow {
  name: string;
  version: string;
  license: string;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  raw: string;
}

export interface ImportResult {
  rows: ImportRow[];
  fatal?: string;
}

interface RawRecord {
  name: string;
  version: string;
  license: string;
  raw: string;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function recordsFromJson(data: unknown): RawRecord[] | string {
  // 形式一：[{ name, version, license }, ...]
  if (Array.isArray(data)) {
    if (data.length === 0) return 'JSON 数组为空，没有可导入的记录';
    const out: RawRecord[] = [];
    for (const item of data) {
      if (typeof item !== 'object' || item === null) return 'JSON 数组中存在非对象记录';
      const o = item as Record<string, unknown>;
      let license = pickString(o, ['license', 'licenseExpression', 'spdx']);
      const licenses = o['licenses'];
      if (!license && Array.isArray(licenses)) {
        license = licenses.filter((x): x is string => typeof x === 'string').join(' AND ');
      }
      out.push({
        name: pickString(o, ['name', 'package', 'pkg', 'id']),
        version: pickString(o, ['version', 'ver', 'v']),
        license,
        raw: JSON.stringify(item),
      });
    }
    return out;
  }
  // 形式二：{ dependencies: { name: version }, devDependencies: {...} }
  if (typeof data === 'object' && data !== null) {
    const o = data as Record<string, unknown>;
    const sections = ['dependencies', 'devDependencies', 'peerDependencies'].filter(
      (k) => typeof o[k] === 'object' && o[k] !== null,
    );
    if (sections.length === 0) {
      return '无法识别的 JSON 结构：请使用依赖数组，或包含 dependencies 的对象';
    }
    const out: RawRecord[] = [];
    for (const s of sections) {
      for (const [name, ver] of Object.entries(o[s] as Record<string, unknown>)) {
        out.push({
          name,
          version: typeof ver === 'string' ? ver : '',
          license: '',
          raw: `${name}: ${String(ver)}`,
        });
      }
    }
    return out;
  }
  return '无法识别的 JSON 结构';
}

function recordsFromText(text: string): RawRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) return [];

  // CSV 表头检测：name,version,license（允许别名与制表符分隔）
  const delimOf = (l: string) => (l.includes('\t') ? '\t' : l.includes(',') ? ',' : null);
  const first = lines[0];
  const delim = delimOf(first);
  let header: string[] | null = null;
  let start = 0;
  if (delim) {
    const cells = first.split(delim).map((c) => c.trim().toLowerCase());
    if (cells.some((c) => ['name', '名称', 'package', '依赖'].includes(c))) {
      header = cells;
      start = 1;
    }
  }

  const idxOf = (aliases: string[], fallback: number) => {
    if (!header) return fallback;
    const i = header.findIndex((h) => aliases.includes(h));
    return i >= 0 ? i : -1;
  };
  const nameIdx = idxOf(['name', '名称', 'package', '依赖'], 0);
  const verIdx = idxOf(['version', '版本', 'ver'], 1);
  const licIdx = idxOf(['license', '许可证', 'licence', 'spdx'], 2);

  const out: RawRecord[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const d = delimOf(line) ?? delim;
    if (d) {
      const cells = line.split(d).map((c) => c.trim());
      out.push({
        name: nameIdx >= 0 ? (cells[nameIdx] ?? '') : '',
        version: verIdx >= 0 ? (cells[verIdx] ?? '') : '',
        license: licIdx >= 0 ? (cells[licIdx] ?? '') : '',
        raw: line,
      });
      continue;
    }
    // 自由格式：name@version LICENSE 或 name@version
    const m = line.match(/^(@?[^\s@]+)@([^\s]+)(?:\s+(.+))?$/);
    if (m) {
      out.push({ name: m[1], version: m[2], license: (m[3] ?? '').trim(), raw: line });
    } else {
      out.push({ name: line, version: '', license: '', raw: line });
    }
  }
  return out;
}

/** 解析批量导入文本（JSON / CSV / 每行一条），并对每行做完整校验。 */
export function parseImport(text: string, existingNames: Set<string>): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], fatal: '内容为空：请粘贴 JSON、CSV 或每行一条的依赖列表' };

  let records: RawRecord[] | string;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      records = recordsFromJson(JSON.parse(trimmed));
    } catch {
      return { rows: [], fatal: 'JSON 解析失败：请检查格式（括号、引号、逗号）' };
    }
  } else {
    records = recordsFromText(trimmed);
  }
  if (typeof records === 'string') return { rows: [], fatal: records };
  if (records.length === 0) return { rows: [], fatal: '没有解析到任何依赖记录' };

  const seen = new Set<string>();
  const rows: ImportRow[] = records.map((r) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let { name, version, license } = r;

    name = name.trim();
    const nameErr = validateName(name);
    if (nameErr) errors.push(nameErr);

    if (!version.trim()) {
      errors.push('缺少版本号');
    } else {
      const nv = normalizeVersion(version);
      if (!nv) {
        errors.push(`无法确定版本号：${version}`);
      } else {
        if (nv.changed) warnings.push(`版本已按 ${nv.version} 处理`);
        version = nv.version;
        const verErr = validateVersion(version);
        if (verErr) errors.push(verErr);
      }
    }

    if (!license.trim()) {
      license = 'NOASSERTION';
      warnings.push('缺少许可证，按未知类别处理');
    } else {
      const spdx = parseSpdx(license);
      if (!spdx.ok) {
        errors.push(`许可证：${spdx.error}`);
      } else {
        license = spdx.normalized;
        if (spdx.unknownIds.length > 0) {
          warnings.push(`未识别的许可证 ${spdx.unknownIds.join('、')}，按未知类别处理`);
        }
      }
    }

    const key = name.toLowerCase();
    let duplicate = false;
    if (name && !nameErr) {
      const uniqueErr = validateNameUnique(name, existingNames);
      if (uniqueErr) {
        duplicate = true;
        warnings.push(`${uniqueErr}，导入时将跳过`);
      } else if (seen.has(key)) {
        duplicate = true;
        warnings.push('文件内重复，导入时将跳过');
      }
      seen.add(key);
    }

    return { name, version, license, errors, warnings, duplicate, raw: r.raw };
  });

  return { rows };
}

export function importSummary(rows: ImportRow[]): { valid: number; skipped: number; failed: number } {
  let valid = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.errors.length > 0) failed++;
    else if (r.duplicate) skipped++;
    else valid++;
  }
  return { valid, skipped, failed };
}
