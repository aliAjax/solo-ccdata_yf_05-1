import type { Category, ReviewStatus, RiskLevel } from '../lib/types';
import { CATEGORY_LABEL, REVIEW_LABEL, RISK_LABEL } from '../lib/types';

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge risk-${level}`}>{RISK_LABEL[level]}</span>;
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <span className={`badge review-${status}`}>{REVIEW_LABEL[status]}</span>;
}

export function LicenseBadge({ license, category }: { license: string; category: Category }) {
  return (
    <span className={`badge lic cat-${category}`} title={`类别：${CATEGORY_LABEL[category]}`}>
      {license}
    </span>
  );
}
