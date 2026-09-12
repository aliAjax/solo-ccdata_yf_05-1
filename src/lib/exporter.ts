import type { Dep, Evaluation, ReviewStatus, Settings } from './types';
import { CATEGORY_LABEL, DISTRIBUTION_LABEL, REVIEW_LABEL, RISK_LABEL, STRICTNESS_LABEL } from './types';

export interface EvaluatedDep {
  dep: Dep;
  eval: Evaluation;
}

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function cell(text: string): string {
  return (text || '—').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(cell).join(' | ')} |`);
  return [head, sep, ...body].join('\n');
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 生成交接摘要 Markdown。 */
export function buildMarkdown(items: EvaluatedDep[], settings: Settings, now: Date): string {
  const count = (level: string) => items.filter((i) => i.eval.level === level).length;
  const byReview = (s: ReviewStatus) => items.filter((i) => i.dep.review === s);
  const pending = byReview('pending').sort(
    (a, b) => RISK_ORDER[a.eval.level] - RISK_ORDER[b.eval.level] || a.dep.name.localeCompare(b.dep.name),
  );

  const lines: string[] = [
    '# 许可证风险审查交接摘要',
    '',
    `- 生成时间：${fmtTime(now)}`,
    `- 分发方式：${DISTRIBUTION_LABEL[settings.distribution]}　·　规则严格度：${STRICTNESS_LABEL[settings.strictness]}`,
    `- 依赖总数：${items.length}　·　高风险 ${count('high')}　·　需复核 ${count('medium')}　·　低风险 ${count('low')}`,
    `- 审查进度：待处理 ${byReview('pending').length}　·　已批准 ${byReview('approved').length}　·　已豁免 ${byReview('exempted').length}　·　已替换 ${byReview('replaced').length}`,
    '',
  ];

  lines.push('## 待处理事项');
  lines.push('');
  if (pending.length === 0) {
    lines.push('所有依赖均已处理完毕。');
  } else {
    lines.push(
      table(
        ['依赖', '版本', '许可证', '风险', '负责人', '替代方案', '备注'],
        pending.map(({ dep, eval: ev }) => [
          dep.name,
          dep.version,
          ev.normalized,
          RISK_LABEL[ev.level],
          dep.owner,
          dep.alternative,
          dep.note,
        ]),
      ),
    );
  }
  lines.push('');

  lines.push('## 全部依赖明细');
  lines.push('');
  if (items.length === 0) {
    lines.push('（无依赖记录）');
  } else {
    lines.push(
      table(
        ['依赖', '版本', '许可证', '类别', '风险', '审查状态', '负责人', '替代方案'],
        [...items]
          .sort((a, b) => RISK_ORDER[a.eval.level] - RISK_ORDER[b.eval.level] || a.dep.name.localeCompare(b.dep.name))
          .map(({ dep, eval: ev }) => [
            dep.name,
            dep.version,
            ev.normalized,
            CATEGORY_LABEL[ev.category],
            RISK_LABEL[ev.level],
            REVIEW_LABEL[dep.review],
            dep.owner,
            dep.alternative,
          ]),
      ),
    );
  }
  lines.push('');

  lines.push('## 评估规则说明');
  lines.push('');
  lines.push(
    `- 风险等级由许可证类别（宽松型/弱著佐权/强著佐权/网络著佐权/专有/未知）结合分发方式（${DISTRIBUTION_LABEL[settings.distribution]}）计算，阈值为「${STRICTNESS_LABEL[settings.strictness]}」档。`,
  );
  lines.push('- 待处理项需在发布前完成批准、豁免（记录理由）或替换（记录替代方案）。');
  lines.push('- 本摘要由 License Lens 自动生成，许可证义务以各项目 LICENSE 原文为准。');
  lines.push('');

  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
