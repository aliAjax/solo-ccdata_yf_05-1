import type { Category } from './types';

export interface LicenseInfo {
  id: string; // 规范化 SPDX 标识
  category: Category;
  note: string; // 一句话义务摘要
}

const L = (id: string, category: Category, note: string): LicenseInfo => ({ id, category, note });

/**
 * 常见 SPDX 许可证库。键为小写 id，便于大小写不敏感匹配。
 * 未收录的标识不会被拒绝，而是按 unknown 类别处理。
 */
export const LICENSE_DB: Record<string, LicenseInfo> = Object.fromEntries(
  [
    // —— 宽松型 ——
    L('MIT', 'permissive', '保留版权与许可声明即可自由使用、修改与再分发'),
    L('MIT-0', 'permissive', '无保留声明义务的宽松许可'),
    L('ISC', 'permissive', '保留版权与许可声明即可自由使用'),
    L('BSD-1-Clause', 'permissive', '保留版权声明'),
    L('BSD-2-Clause', 'permissive', '保留版权与免责声明'),
    L('BSD-3-Clause', 'permissive', '保留声明，且不得用作者名义背书衍生产品'),
    L('0BSD', 'permissive', '无任何义务的公共领域等价许可'),
    L('Apache-2.0', 'permissive', '保留声明与 NOTICE，附带专利授权与终止条款'),
    L('Apache-1.1', 'permissive', '保留声明，不得用 Apache 名义背书'),
    L('Zlib', 'permissive', '保留声明，不得歪曲来源'),
    L('Unlicense', 'permissive', '公共领域奉献，无义务'),
    L('CC0-1.0', 'permissive', '公共领域奉献，无义务'),
    L('BSL-1.0', 'permissive', '保留版权与许可声明'),
    L('WTFPL', 'permissive', '无任何限制'),
    L('PostgreSQL', 'permissive', '保留版权与免责声明'),
    L('Python-2.0', 'permissive', '保留声明，兼容闭源使用'),
    L('BlueOak-1.0.0', 'permissive', '宽松许可，附带专利授权'),
    L('X11', 'permissive', '保留版权与许可声明'),
    L('NCSA', 'permissive', '保留声明，允许闭源再分发'),
    L('curl', 'permissive', '保留版权与许可声明'),
    L('OpenSSL', 'permissive', '保留声明与广告条款'),
    L('PHP-3.01', 'permissive', '保留声明，限制 PHP 名称使用'),
    L('Ruby', 'permissive', '保留声明即可自由使用'),
    L('CC-BY-4.0', 'permissive', '需署名，常用于文档与素材'),
    // —— 弱著佐权 ——
    L('LGPL-2.0-only', 'weak', '链接使用可闭源，修改库本身需开源并提供替换机制'),
    L('LGPL-2.0-or-later', 'weak', '链接使用可闭源，修改库本身需开源并提供替换机制'),
    L('LGPL-2.1-only', 'weak', '动态链接可闭源，修改库需开源，允许用户重新链接'),
    L('LGPL-2.1-or-later', 'weak', '动态链接可闭源，修改库需开源，允许用户重新链接'),
    L('LGPL-3.0-only', 'weak', '链接可闭源，修改库需开源，不得限制用户替换（含安装信息）'),
    L('LGPL-3.0-or-later', 'weak', '链接可闭源，修改库需开源，不得限制用户替换（含安装信息）'),
    L('MPL-1.1', 'weak', '文件级著佐权：修改的源文件需以 MPL 开源'),
    L('MPL-2.0', 'weak', '文件级著佐权：修改的源文件需以 MPL 开源，兼容私有组合'),
    L('EPL-1.0', 'weak', '修改与衍生需以 EPL 发布，商业分发需处理专利责任'),
    L('EPL-2.0', 'weak', '修改与衍生需以 EPL 发布，可选择 GPL 兼容条款'),
    L('CDDL-1.0', 'weak', '文件级著佐权，与 GPL 不兼容'),
    L('CDDL-1.1', 'weak', '文件级著佐权，与 GPL 不兼容'),
    L('EUPL-1.1', 'weak', '欧盟公共许可，修改需开源，兼容列表内许可证'),
    L('Ms-PL', 'weak', '文件级著佐权，分发源码需以 Ms-PL 发布'),
    L('Ms-RL', 'weak', '文件级著佐权，分发文件需以 Ms-RL 发布'),
    L('Artistic-2.0', 'weak', '修改分发需说明变更并满足其一的再分发条件'),
    L('ZPL-2.1', 'weak', '保留声明，修改需显著标注'),
    // —— 强著佐权 ——
    L('GPL-2.0-only', 'strong', '衍生作品整体须以 GPL-2.0 开源并提供对应源码'),
    L('GPL-2.0-or-later', 'strong', '衍生作品整体须以 GPL-2.0+ 开源并提供对应源码'),
    L('GPL-3.0-only', 'strong', '衍生作品整体须以 GPL-3.0 开源，含专利与反锁定条款'),
    L('GPL-3.0-or-later', 'strong', '衍生作品整体须以 GPL-3.0+ 开源，含专利与反锁定条款'),
    L('CC-BY-SA-3.0', 'strong', '署名且衍生作品须以相同条款共享'),
    L('CC-BY-SA-4.0', 'strong', '署名且衍生作品须以相同条款共享'),
    L('CECILL-2.1', 'strong', '法式强著佐权，与 GPL 兼容'),
    L('Sleepycat', 'strong', '再分发须开放使用该软件的全部源码'),
    L('QPL-1.0', 'strong', '修改须以补丁形式发布，与 GPL 不兼容'),
    // —— 网络著佐权 ——
    L('AGPL-1.0-only', 'network', '网络交互使用即触发开源义务'),
    L('AGPL-1.0-or-later', 'network', '网络交互使用即触发开源义务'),
    L('AGPL-3.0-only', 'network', '通过网络提供服务也须向用户提供完整源码'),
    L('AGPL-3.0-or-later', 'network', '通过网络提供服务也须向用户提供完整源码'),
    L('SSPL-1.0', 'network', '以服务能力提供时须开放整个服务栈源码'),
    L('OSL-3.0', 'network', '网络部署即构成分发，衍生作品须开源'),
    L('EUPL-1.2', 'network', '含网络使用条款的著佐权许可，兼容 GPL'),
    L('RPL-1.5', 'network', '网络部署即触发开源义务'),
    // —— 专有/受限 ——
    L('BUSL-1.1', 'proprietary', '源码可见但限制生产使用，需确认转换日期与附加条款'),
    L('Elastic-2.0', 'proprietary', '限制以托管服务形式提供，商用需授权'),
    L('CC-BY-NC-4.0', 'proprietary', '禁止商业用途'),
    L('CC-BY-NC-SA-4.0', 'proprietary', '禁止商业用途且衍生须同条款共享'),
    L('UNLICENSED', 'proprietary', '未授予任何开源许可，默认保留全部权利'),
    // —— 未知 ——
    L('NONE', 'unknown', '未声明许可证'),
    L('NOASSERTION', 'unknown', '许可证信息无法确定'),
  ].map((l) => [l.id.toLowerCase(), l]),
);

/** 已知的 SPDX 许可证例外（WITH 右侧）。 */
export const KNOWN_EXCEPTIONS = new Set(
  [
    'Classpath-exception-2.0',
    'Bison-exception-2.2',
    'LLVM-exception',
    'Autoconf-exception-3.0',
    'Font-exception-2.0',
    'GPL-CC-1.0',
    'OpenJDK-assembly-exception-1.0',
    'Swift-exception',
    'WxWindows-exception-3.1',
    'LGPL-3.0-linking-exception',
  ].map((e) => e.toLowerCase()),
);

export function lookupLicense(id: string): LicenseInfo | null {
  const hit = LICENSE_DB[id.toLowerCase()];
  if (hit) return hit;
  // LicenseRef-* 为自定义许可证引用，按专有处理
  if (/^licenseref-/i.test(id)) {
    return { id, category: 'proprietary', note: '自定义许可证引用，需人工核对条款' };
  }
  return null;
}

export const CATEGORY_OBLIGATIONS: Record<Category, string[]> = {
  permissive: ['保留版权与许可证声明', '修改与再分发无需开源'],
  weak: [
    '以库形式链接使用时主程序可闭源',
    '对库本身的修改需以相同条款开源',
    '分发时保留声明并提供库源码获取方式',
  ],
  strong: [
    '衍生作品整体须采用相同许可证',
    '分发时须提供完整对应源码',
    '保留版权与许可声明',
  ],
  network: [
    '通过网络交互提供服务也须向用户提供源码',
    '衍生作品须采用相同许可证',
    '保留版权与许可声明',
  ],
  proprietary: ['无开源授权，需获得权利方书面许可', '确认使用范围、期限与分发限制'],
  unknown: ['无法确认许可证条款', '发布前需人工核查仓库 LICENSE 文件'],
};
