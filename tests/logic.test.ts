import test from 'node:test';
import assert from 'node:assert/strict';

import { validateName, validateVersion, normalizeVersion } from '../src/lib/validate';
import { parseSpdx, categoryOf } from '../src/lib/spdx';
import { evaluateLicense } from '../src/lib/risk';
import { parseImport, importSummary } from '../src/lib/importer';
import { buildMarkdown, type EvaluatedDep } from '../src/lib/exporter';
import { saveState, loadState } from '../src/lib/storage';
import type { Dep, Settings } from '../src/lib/types';

const STD: Settings = { distribution: 'binary', strictness: 'standard' };

// ———— 名称校验 ————
test('名称：合法名称通过', () => {
  for (const n of ['react', 'lodash-es', '@scope/pkg', 'a', 'pkg_name', 'x.y', '@a-b/c-d_e.f']) {
    assert.equal(validateName(n), null, n);
  }
});
test('名称：非法输入被拒绝', () => {
  assert.ok(validateName(''));
  assert.ok(validateName('   '));
  assert.ok(validateName('my pkg'));
  assert.ok(validateName('.hidden'));
  assert.ok(validateName('-lead'));
  assert.ok(validateName('pkg!'));
  assert.ok(validateName('@scope'));
  assert.ok(validateName('x'.repeat(215)));
});

// ———— 版本校验 ————
test('版本：语义化版本通过', () => {
  for (const v of ['1.2.3', 'v1.2.3', '0.0.1', '2.0.0-rc.1', '1.0.0-alpha+build.5']) {
    assert.equal(validateVersion(v), null, v);
  }
});
test('版本：范围写法与非法输入被拒绝', () => {
  for (const v of ['', '^1.2.3', '~2.0.0', '>=1.0.0', '1.2', 'latest', '*', '1.2.x', 'v1']) {
    assert.ok(validateVersion(v), v);
  }
});
test('版本：导入时范围前缀可规范化', () => {
  assert.deepEqual(normalizeVersion('^1.2.3'), { version: '1.2.3', changed: true });
  assert.deepEqual(normalizeVersion('~2.0.0'), { version: '2.0.0', changed: true });
  assert.deepEqual(normalizeVersion('1.2'), { version: '1.2.0', changed: true });
  assert.deepEqual(normalizeVersion('3.1.4'), { version: '3.1.4', changed: false });
  assert.equal(normalizeVersion('*'), null);
  assert.equal(normalizeVersion('latest'), null);
});

// ———— SPDX 表达式 ————
test('SPDX：单许可证与大小写规范化', () => {
  const r = parseSpdx('mit');
  assert.ok(r.ok);
  assert.equal(r.normalized, 'MIT');
  assert.deepEqual(r.unknownIds, []);
});
test('SPDX：AND / OR / 括号 / WITH', () => {
  for (const e of [
    '(MIT OR Apache-2.0)',
    'MIT AND BSD-3-Clause',
    'GPL-3.0-only WITH Classpath-exception-2.0',
    '(MIT OR (Apache-2.0 AND BSD-2-Clause))',
  ]) {
    assert.ok(parseSpdx(e).ok, e);
  }
});
test('SPDX：格式错误被逐条指出', () => {
  for (const e of ['', 'MIT AND', '(MIT', 'MIT)', 'AND MIT', 'MIT OR', 'MIT WITH Foo-1.0', 'MIT Apache-2.0']) {
    const r = parseSpdx(e);
    assert.ok(!r.ok, e);
    assert.ok(r.error && r.error.length > 0);
  }
});
test('SPDX：未收录标识可解析但标记为未知', () => {
  const r = parseSpdx('Some-Weird-License');
  assert.ok(r.ok);
  assert.deepEqual(r.unknownIds, ['Some-Weird-License']);
});
test('SPDX：OR 取最轻类别，AND 取最重类别', () => {
  const or = parseSpdx('MIT OR GPL-3.0-only');
  const and = parseSpdx('MIT AND GPL-3.0-only');
  assert.ok(or.ok && or.ast);
  assert.ok(and.ok && and.ast);
  assert.equal(categoryOf(or.ast!), 'permissive');
  assert.equal(categoryOf(and.ast!), 'strong');
});

// ———— 风险引擎 ————
test('风险：宽松许可证在任何分发方式下低风险', () => {
  for (const d of ['internal', 'saas', 'binary', 'source'] as const) {
    assert.equal(evaluateLicense('MIT', { distribution: d, strictness: 'standard' }).level, 'low', d);
  }
});
test('风险：强著佐权随分发方式变化', () => {
  assert.equal(evaluateLicense('GPL-3.0-only', STD).level, 'high');
  assert.equal(evaluateLicense('GPL-3.0-only', { distribution: 'internal', strictness: 'lenient' }).level, 'low');
  assert.equal(evaluateLicense('GPL-3.0-only', { distribution: 'internal', strictness: 'standard' }).level, 'medium');
});
test('风险：网络著佐权在 SaaS 下高风险', () => {
  assert.equal(evaluateLicense('AGPL-3.0-only', { distribution: 'saas', strictness: 'standard' }).level, 'high');
  assert.equal(evaluateLicense('SSPL-1.0', { distribution: 'internal', strictness: 'lenient' }).level, 'low');
});
test('风险：弱著佐权二进制分发需复核', () => {
  assert.equal(evaluateLicense('LGPL-2.1-only', STD).level, 'medium');
  assert.equal(evaluateLicense('MPL-2.0', { distribution: 'saas', strictness: 'lenient' }).level, 'low');
});
test('风险：严格度改变阈值', () => {
  const unknown = { distribution: 'binary' as const };
  assert.equal(evaluateLicense('No-Such-License', { ...unknown, strictness: 'lenient' }).level, 'medium');
  assert.equal(evaluateLicense('No-Such-License', { ...unknown, strictness: 'strict' }).level, 'high');
});
test('风险：专有与未知许可证', () => {
  assert.equal(evaluateLicense('UNLICENSED', { distribution: 'internal', strictness: 'lenient' }).level, 'high');
  assert.equal(evaluateLicense('LicenseRef-Proprietary', STD).category, 'proprietary');
});
test('风险：无效表达式按高风险处理并给出错误', () => {
  const r = evaluateLicense('MIT AND', STD);
  assert.equal(r.ok, false);
  assert.equal(r.level, 'high');
  assert.ok(r.error);
});

// ———— 批量导入 ————
test('导入：JSON 数组', () => {
  const r = parseImport('[{"name":"react","version":"18.3.1","license":"MIT"}]', new Set());
  assert.equal(r.fatal, undefined);
  assert.equal(r.rows.length, 1);
  assert.deepEqual(importSummary(r.rows), { valid: 1, skipped: 0, failed: 0 });
});
test('导入：package.json dependencies 剥离范围前缀', () => {
  const r = parseImport('{"dependencies":{"react":"^18.3.1","lodash":"~4.17.21"}}', new Set());
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].version, '18.3.1');
  assert.ok(r.rows[0].warnings.some((w) => w.includes('18.3.1')));
  assert.ok(r.rows[0].warnings.some((w) => w.includes('缺少许可证')));
});
test('导入：CSV 表头与无表头', () => {
  const withHeader = parseImport('name,version,license\nreact,18.3.1,MIT', new Set());
  assert.equal(withHeader.rows[0].name, 'react');
  const noHeader = parseImport('react,18.3.1,MIT', new Set());
  assert.equal(noHeader.rows[0].license, 'MIT');
});
test('导入：name@version 许可证 自由格式', () => {
  const r = parseImport('react@18.3.1 MIT\n@scope/pkg@1.0.0 Apache-2.0', new Set());
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].name, '@scope/pkg');
  assert.deepEqual(importSummary(r.rows), { valid: 2, skipped: 0, failed: 0 });
});
test('导入：空内容与坏 JSON 给出致命错误', () => {
  assert.ok(parseImport('', new Set()).fatal);
  assert.ok(parseImport('   ', new Set()).fatal);
  assert.ok(parseImport('[{bad json]', new Set()).fatal);
  assert.ok(parseImport('{"foo":1}', new Set()).fatal);
  assert.ok(parseImport('[]', new Set()).fatal);
});
test('导入：逐行校验错误（名称/版本/许可证）', () => {
  const r = parseImport('bad name!,abc,MIT AND\ngood-pkg,1.0.0,MIT', new Set());
  assert.equal(r.rows[0].errors.length, 3);
  assert.deepEqual(importSummary(r.rows), { valid: 1, skipped: 0, failed: 1 });
});
test('导入：范围版本规范化为确定版本并给出警告', () => {
  const r = parseImport('pkg,^1.2,MIT', new Set());
  assert.equal(r.rows[0].errors.length, 0);
  assert.equal(r.rows[0].version, '1.2.0');
  assert.ok(r.rows[0].warnings.some((w) => w.includes('1.2.0')));
});
test('导入：与现有重名及文件内重复被跳过', () => {
  const r = parseImport('react,18.3.1,MIT\nreact,17.0.2,MIT\nlodash,4.17.21,MIT', new Set(['lodash']));
  assert.equal(r.rows[1].duplicate, true, '文件内重复');
  assert.equal(r.rows[2].duplicate, true, '与现有重名');
  assert.deepEqual(importSummary(r.rows), { valid: 1, skipped: 2, failed: 0 });
});
test('导入：未知许可证降级为警告而非错误', () => {
  const r = parseImport('pkg,1.0.0,Weird-License-9', new Set());
  assert.equal(r.rows[0].errors.length, 0);
  assert.ok(r.rows[0].warnings.some((w) => w.includes('未识别')));
});

// ———— 导出摘要 ————
function mkDep(name: string, license: string, review: Dep['review'], owner = '', alternative = ''): Dep {
  return { id: name, name, version: '1.0.0', license, source: '测试', review, owner, alternative, note: '', addedAt: 0 };
}
test('导出：摘要包含统计、待处理与明细', () => {
  const items: EvaluatedDep[] = [
    { dep: mkDep('legacy-parser', 'GPL-3.0-only', 'pending', '', 'nearley'), eval: evaluateLicense('GPL-3.0-only', STD) },
    { dep: mkDep('react', 'MIT', 'approved', '李泽'), eval: evaluateLicense('MIT', STD) },
  ];
  const md = buildMarkdown(items, STD, new Date(2026, 8, 12, 10, 30));
  assert.ok(md.includes('许可证风险审查交接摘要'));
  assert.ok(md.includes('2026-09-12 10:30'));
  assert.ok(md.includes('高风险 1'));
  assert.ok(md.includes('待处理 1'));
  assert.ok(md.includes('legacy-parser'));
  assert.ok(md.includes('nearley'));
  assert.ok(md.includes('二进制分发'));
});
test('导出：空数据与全部处理完毕时不报错', () => {
  const empty = buildMarkdown([], STD, new Date());
  assert.ok(empty.includes('（无依赖记录）'));
  const done = buildMarkdown(
    [{ dep: mkDep('react', 'MIT', 'approved'), eval: evaluateLicense('MIT', STD) }],
    STD,
    new Date(),
  );
  assert.ok(done.includes('所有依赖均已处理完毕'));
});
test('导出：表格单元格转义管道符', () => {
  const items: EvaluatedDep[] = [
    { dep: mkDep('weird|pkg', 'MIT', 'pending'), eval: evaluateLicense('MIT', STD) },
  ];
  const md = buildMarkdown(items, STD, new Date());
  assert.ok(md.includes('weird\\|pkg'));
});

// ———— 持久化 ————
test('持久化：保存后可完整读回，损坏数据回退 null', () => {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  assert.equal(loadState(), null, '首次为空');
  const ws = { deps: [mkDep('react', 'MIT', 'approved', '李泽')], settings: STD };
  saveState(ws);
  const back = loadState();
  assert.ok(back);
  assert.equal(back!.deps.length, 1);
  assert.equal(back!.deps[0].owner, '李泽');
  assert.equal(back!.settings.distribution, 'binary');

  store.set('license-lens-workbench-v1', '{broken');
  assert.equal(loadState(), null, 'JSON 损坏');
  store.set('license-lens-workbench-v1', '{"deps":[{"id":1}],"settings":{}}');
  assert.equal(loadState(), null, '结构非法');
  store.set(
    'license-lens-workbench-v1',
    JSON.stringify({ deps: [mkDep('a', 'MIT', 'pending')], settings: { distribution: 'nope', strictness: 'strict' } }),
  );
  const fixed = loadState();
  assert.equal(fixed!.settings.distribution, 'binary', '非法设置回退默认');
  assert.equal(fixed!.settings.strictness, 'strict');
});
