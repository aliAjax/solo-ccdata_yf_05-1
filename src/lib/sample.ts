import type { Dep } from './types';

function mk(
  name: string,
  version: string,
  license: string,
  source: string,
  review: Dep['review'],
  owner: string,
  alternative: string,
  note: string,
  addedAt: number,
): Dep {
  return { id: `sample-${name}`, name, version, license, source, review, owner, alternative, note, addedAt };
}

/** 首次启动时的示例数据，覆盖各风险等级与审查状态，便于快速体验。 */
export function sampleDeps(): Dep[] {
  const now = Date.now();
  return [
    mk('legacy-parser', '2.1.0', 'GPL-3.0-only', '手动录入', 'pending', '', 'nearley 3.0（MIT）', '解析模块核心依赖，需评估替换成本', now - 7000),
    mk('mongodb', '6.8.0', 'SSPL-1.0', '批量导入', 'pending', '', '', '仅使用客户端驱动，待法务确认', now - 6000),
    mk('internal-utils', '0.9.2', 'UNLICENSED', '手动录入', 'pending', '', '', '自研包，需补充许可证声明', now - 5000),
    mk('highlight.js', '11.10.0', 'BSD-3-Clause', '批量导入', 'pending', '', '', '', now - 4000),
    mk('react', '18.3.1', 'MIT', '批量导入', 'approved', '李泽', '', '宽松许可，保留声明即可', now - 3000),
    mk('lodash', '4.17.21', 'MIT', '批量导入', 'approved', '李泽', '', '', now - 2000),
    mk('chart.js', '4.4.4', 'MIT', '批量导入', 'exempted', '陈雨', '', '设计团队确认保留声明', now - 1000),
  ];
}
