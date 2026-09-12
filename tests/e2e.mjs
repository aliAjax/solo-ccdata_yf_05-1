import { chromium } from 'playwright';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 5199;
const rootDir = fileURLToPath(new URL('..', import.meta.url));

// —— 测试服务器自管理：端口已有服务则复用，否则自动启动并在结束时关闭 ——
// 注意：vite 在本机可能只绑定 IPv6(::1)，因此复用探测同时尝试两个地址，
// 自行启动时则显式 --host 127.0.0.1 固定地址。
async function serverUp(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

let base = null;
for (const url of [`http://127.0.0.1:${PORT}`, `http://[::1]:${PORT}`]) {
  if (await serverUp(url)) {
    base = url;
    break;
  }
}

let serverProc = null;
if (!base) {
  base = `http://127.0.0.1:${PORT}`;
  const viteBin = `${rootDir}/node_modules/vite/bin/vite.js`;
  // 有构建产物则用 preview 验证产物，否则回退到 dev server
  const args = fs.existsSync(`${rootDir}/dist/index.html`)
    ? [viteBin, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1']
    : [viteBin, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'];
  serverProc = spawn(process.execPath, args, { cwd: rootDir, stdio: 'ignore' });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !(await serverUp(base))) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await serverUp(base))) {
    console.error(`无法启动本地测试服务器（端口 ${PORT}）`);
    serverProc.kill();
    process.exit(1);
  }
}
const stopServer = () => {
  if (serverProc && !serverProc.killed) serverProc.kill();
};
process.on('exit', stopServer);

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

// —— 运行时准备：缺少浏览器时自动安装 Playwright Chromium，再继续检查 ——
function launchArgs() {
  return { args: ['--no-sandbox'] };
}
async function launchBrowser() {
  try {
    return await chromium.launch(launchArgs());
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (!/Executable doesn't exist|browser has not been found|download new browsers/i.test(msg)) throw e;
    console.log('未检测到 Playwright 浏览器，自动安装 Chromium（仅首次需要）…');
    const cli = `${rootDir}/node_modules/playwright/cli.js`;
    const r = spawnSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error('浏览器自动安装失败，请手动执行：npx playwright install chromium');
      process.exit(1);
    }
    try {
      return await chromium.launch(launchArgs());
    } catch (e2) {
      console.error('浏览器已安装但启动失败；若是缺少系统依赖，请执行：npx playwright install --with-deps chromium');
      throw e2;
    }
  }
}

const browser = await launchBrowser();
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
ok('默认按风险排序，第一行是高风险依赖 internal-utils', firstRow === 'internal-utils');

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
ok('非法名称/范围版本/残缺表达式均被拦截', errTexts.includes('名称') && errTexts.includes('范围') && errTexts.includes('表达式'));
await inputs[0].fill('react');
await page.waitForTimeout(100);
const dupAddErr = await page.$eval('.modal .field.invalid em', (e) => e.textContent).catch(() => '');
ok('新增重名被唯一规则拦截', dupAddErr.includes('已存在同名依赖'));
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
const ownerCell = await page
  .$eval('.table .tr:not(.th):has-text("date-fns")', (row) => row.querySelectorAll('.muted')[1]?.textContent ?? null)
  .catch(() => null);
ok('保存后负责人写入列表', ownerCell === '王芳');
const reviewBadge = await page.$eval('.table .tr:not(.th):has-text("date-fns") .badge.review-approved', (e) => e.textContent).catch(() => null);
ok('列表状态变为已批准', reviewBadge === '已批准');

// —— 4b. 编辑重名拦截 ——
console.log('4b. 编辑重名拦截');
const nameInput = (await page.$$('.detail input'))[0];
await nameInput.fill('react');
await page.waitForTimeout(150);
const dupEditErr = await page.$eval('.detail .field.invalid em', (e) => e.textContent).catch(() => '');
ok('编辑为重名时提示唯一性错误', dupEditErr.includes('已存在同名依赖'));
ok('重名时保存按钮被禁用', (await page.$eval('.detail-actions .primary', (b) => b.disabled)) === true);
await nameInput.fill('date-fns');
await page.waitForTimeout(150);
ok('改回唯一名称后错误消失', (await page.$('.detail .field.invalid')) === null);

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
stopServer();
console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
