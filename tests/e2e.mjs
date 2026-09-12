import { chromium } from 'playwright';
import fs from 'node:fs';

const base = 'http://localhost:5199';
let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => {
  failed++;
  console.error(`  ✗ 页面运行时错误: ${e.message}`);
});

// —— 1. 初始加载：示例数据、统计、banner ——
console.log('1. 初始加载');
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.table .tr:not(.th)');
const statValues = await page.$$eval('.summary .stat b', (els) => els.map((e) => e.textContent));
ok('统计卡片显示 7 条依赖', statValues[0] === '7');
ok('高风险统计为 3（GPL/SSPL/UNLICENSED）', statValues[1] === '3');
ok('待处理统计为 4', statValues[3] === '4');
ok('示例数据 banner 可见', (await page.$('.banner')) !== null);
const rowCount = await page.$$eval('.table .tr:not(.th)', (r) => r.length);
ok('表格渲染 7 行', rowCount === 7);
const firstRow = await page.$eval('.table .tr:not(.th) .dep-name', (e) => e.textContent);
ok('默认按风险排序，第一行是 legacy-parser', firstRow === 'legacy-parser');

// —— 2. 筛选与搜索 ——
console.log('2. 筛选与搜索');
await page.click('.summary .stat:nth-child(2)'); // 高风险卡片
await page.waitForTimeout(150);
ok('高风险筛选后剩 3 行', (await page.$$('.table .tr:not(.th)')).length === 3);
await page.click('.summary .stat:nth-child(1)'); // 全部
await page.waitForTimeout(150);
await page.fill('.search input', 'mongodb');
await page.waitForTimeout(150);
ok('搜索 mongodb 剩 1 行', (await page.$$('.table .tr:not(.th)')).length === 1);
await page.fill('.search input', '不存在的依赖xyz');
await page.waitForTimeout(150);
ok('无匹配时显示空态', (await page.textContent('.empty h3')) === '没有匹配的依赖');
await page.click('.empty-actions .outline'); // 清除筛选
await page.waitForTimeout(150);
ok('清除筛选后恢复 7 行', (await page.$$('.table .tr:not(.th)')).length === 7);

// —— 3. 添加依赖：错误输入 + 正常添加 ——
console.log('3. 添加依赖与表单校验');
await page.click('header .primary');
await page.click('.modal .primary.full'); // 空表单提交
ok('空表单显示名称错误', (await page.$('.field.invalid em')) !== null);
const inputs = await page.$$('.modal input');
await inputs[0].fill('bad name!');
await inputs[1].fill('^1.2.3');
await inputs[2].fill('MIT AND');
await page.click('.modal .primary.full');
const errTexts = await page.$$eval('.modal .field.invalid em', (els) => els.map((e) => e.textContent).join('|'));
ok('非法名称/范围版本/残缺表达式均被拦截', errTexts.includes('名称') && errTextssIncludes(errTexts, '范围') && errTexts.includes('表达式'));
function errTextsIncludes(s, sub) { return s.includes(sub); }
await inputs[0].fill('date-fns');
await inputs[1].fill('3.6.0');
await inputs[2].fill('MIT');
await page.waitForTimeout(150);
ok('合法输入出现风险预览', (await page.$('.risk-preview.low')) !== null);
await page.click('.modal .primary.full');
await page.waitForTimeout(200);
ok('添加后表格 8 行', (await page.$$('.table .tr:not(.th)')).length === 8);
ok('添加后出现 toast', (await page.$('.toast')) !== null);
ok('新依赖自动打开详情', (await page.$('.detail')) !== null);

// —— 4. 详情编辑：状态/负责人/替代方案 ——
console.log('4. 详情编辑与保存');
await page.click('.review-opt.review-approved');
await page.fill('.detail input[placeholder="指派处理人"]', '王芳');
await page.fill('.detail input[placeholder*="nearley"]', '无需替换');
await page.click('.detail-actions .primary');
await page.waitForTimeout(200);
const ownerCell = await page.$eval('.table .tr:not(.th):has-text("date-fns") .muted:last-of-type', (e) => e.textContent).catch(() => null);
ok('保存后负责人写入列表', ownerCell === '王芳');
const reviewBadge = await page.$eval('.table .tr:not(.th):has-text("date-fns") .badge.review-approved', (e) => e.textContent).catch(() => null);
ok('列表状态变为已批准', reviewBadge === '已批准');

// —— 5. 批量导入：错误行/重复行/有效行 ——
console.log('5. 批量导入');
await page.click('header >> text=批量导入');
await page.fill('.import-input', 'name,version,license\naxios,1.7.7,MIT\nbad name!,abc,MIT AND\nreact,18.3.1,MIT\nexpress,4.21.0,MIT');
await page.click('.import-modal .outline.full');
await page.waitForTimeout(200);
const summaryText = await page.textContent('.import-summary');
ok('解析摘要：有效2 重复1 错误1', summaryText.includes('有效 2') && summaryText.includes('重复跳过 1') && summaryText.includes('错误 1'));
await page.click('.import-modal .modal-actions .primary');
await page.waitForTimeout(200);
ok('导入后表格 10 行', (await page.$$('.table .tr:not(.th)')).length === 10);
await page.click('header >> text=批量导入');
await page.fill('.import-input', '[{broken json]');
await page.click('.import-modal .outline.full');
await page.waitForTimeout(150);
ok('坏 JSON 显示致命错误', (await page.$('.import-fatal')) !== null);
await page.keyboard.press('Escape');
await page.waitForTimeout(100);

// —— 6. 批量操作 ——
console.log('6. 批量处理');
const boxes = await page.$$('.table .tr:not(.th) .col-check input');
await boxes[0].click();
await boxes[1].click();
await page.waitForTimeout(150);
ok('批量栏出现并计数 2', (await page.textContent('.batch-count')).includes('2'));
await page.click('.batch-bar .chip:has-text("标记已批准")');
await page.waitForTimeout(200);
ok('批量批准后出现 toast', (await page.$('.toast')) !== null);
const approvedCount = await page.$$eval('.table .badge.review-approved', (els) => els.length);
ok('列表中已批准徽章增加', approvedCount >= 2);
await page.click('.batch-clear');

// —— 7. 撤销 / 重做 ——
console.log('7. 撤销重做');
const before = await page.$$eval('.table .badge.review-approved', (els) => els.length);
await page.click('.undo-group button:first-child'); // 撤销批量批准
await page.waitForTimeout(200);
const afterUndo = await page.$$eval('.table .badge.review-approved', (els) => els.length);
ok('撤销后已批准数减少', afterUndo === before - 2);
await page.click('.undo-group button:last-child'); // 重做
await page.waitForTimeout(200);
const afterRedo = await page.$$eval('.table .badge.review-approved', (els) => els.length);
ok('重做后恢复', afterRedo === before);

// —— 8. 评估规则影响风险 ——
console.log('8. 评估规则');
const gplRiskBefore = await page.$eval('.table .tr:not(.th):has-text("legacy-parser") .badge[class*="risk-"]', (e) => e.textContent);
await page.selectOption('#rule-distribution', 'internal');
await page.selectOption('#rule-strictness', 'lenient');
await page.waitForTimeout(200);
const gplRiskAfter = await page.$eval('.table .tr:not(.th):has-text("legacy-parser") .badge[class*="risk-"]', (e) => e.textContent);
ok(`切换为内部使用+宽松后 GPL 风险下降（${gplRiskBefore}→${gplRiskAfter}）`, gplRiskBefore === '高风险' && gplRiskAfter === '低风险');
await page.selectOption('#rule-distribution', 'binary');
await page.selectOption('#rule-strictness', 'standard');
await page.waitForTimeout(200);

// —— 9. 持久化 ——
console.log('9. 刷新后数据保留');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.table .tr:not(.th)');
ok('刷新后仍为 10 行', (await page.$$('.table .tr:not(.th)')).length === 10);
ok('刷新后负责人仍在', (await page.textContent('.table')) .includes('王芳'));
ok('刷新后 banner 不再显示', (await page.$('.banner')) === null);

// —— 10. 导出摘要 ——
console.log('10. 导出交接摘要');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('header >> text=导出摘要')]);
const md = fs.readFileSync(await download.path(), 'utf8');
ok('导出文件名是 .md', download.suggestedFilename().endsWith('.md'));
ok('摘要包含统计与待处理表', md.includes('许可证风险审查交接摘要') && md.includes('待处理事项'));
ok('摘要包含依赖明细与负责人', md.includes('date-fns') && md.includes('王芳'));

// —— 11. 空数据状态 ——
console.log('11. 空数据状态');
await page.click('.clear-all');
await page.click('.modal.confirm .danger');
await page.waitForTimeout(200);
ok('清空后显示空态', (await page.textContent('.empty h3')) === '还没有依赖记录');
ok('空态提供添加入口', (await page.$('.empty-actions .primary')) !== null);
ok('统计归零', (await page.$eval('.summary .stat b', (e) => e.textContent)) === '0');
await page.click('.undo-group button:first-child'); // 撤销清空
await page.waitForTimeout(200);
ok('撤销清空后数据恢复 10 行', (await page.$$('.table .tr:not(.th)')).length === 10);

await browser.close();
console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
