import { AlertTriangle, Check, FileCode2, Info, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LICENSE_DB } from '../lib/licenses';
import { evaluateLicense } from '../lib/risk';
import { parseSpdx } from '../lib/spdx';
import { validateName, validateNameUnique, validateVersion } from '../lib/validate';
import type { Dep, ReviewStatus, Settings } from '../lib/types';
import { CATEGORY_LABEL, REVIEW_LABEL } from '../lib/types';
import type { EvaluatedDep } from '../lib/exporter';
import { LicenseBadge, RiskBadge } from './badges';

export interface DepPatch {
  name: string;
  version: string;
  license: string;
  review: ReviewStatus;
  owner: string;
  alternative: string;
  note: string;
}

interface DetailPanelProps {
  item: EvaluatedDep;
  settings: Settings;
  existingNames: Set<string>;
  onSave: (id: string, patch: DepPatch) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const REVIEW_ORDER: ReviewStatus[] = ['pending', 'approved', 'exempted', 'replaced'];

export function DetailPanel({ item, settings, existingNames, onSave, onDelete, onClose }: DetailPanelProps) {
  const dep = item.dep;
  const [name, setName] = useState(dep.name);
  const [version, setVersion] = useState(dep.version);
  const [license, setLicense] = useState(dep.license);
  const [review, setReview] = useState<ReviewStatus>(dep.review);
  const [owner, setOwner] = useState(dep.owner);
  const [alternative, setAlternative] = useState(dep.alternative);
  const [note, setNote] = useState(dep.note);

  const errors = useMemo(
    () => ({
      name: validateName(name) ?? validateNameUnique(name, existingNames, dep.name),
      version: validateVersion(version),
      license: parseSpdx(license).ok ? null : parseSpdx(license).error ?? '许可证表达式无效',
    }),
    [name, version, license, existingNames, dep.name],
  );
  const hasError = Boolean(errors.name || errors.version || errors.license);

  const dirty =
    name !== dep.name ||
    version !== dep.version ||
    license !== dep.license ||
    review !== dep.review ||
    owner !== dep.owner ||
    alternative !== dep.alternative ||
    note !== dep.note;

  // 许可证输入有效时，按当前评估规则实时预览；无效时回退到已保存的评估结果
  const preview = useMemo(
    () => (errors.license ? item.eval : evaluateLicense(license, settings)),
    [license, settings, errors.license, item.eval],
  );

  const save = () => {
    if (hasError || !dirty) return;
    onSave(dep.id, {
      name: name.trim(),
      version: version.trim(),
      license: preview.normalized,
      review,
      owner: owner.trim(),
      alternative: alternative.trim(),
      note: note.trim(),
    });
  };

  return (
    <div className="detail">
      <div className="detail-head">
        <div className={`detail-icon cat-${item.eval.category}`}>
          <FileCode2 size={20} />
        </div>
        <div>
          <span>依赖详情</span>
          <h2>{dep.name}</h2>
        </div>
        <button className="close" onClick={onClose} aria-label="关闭详情">
          <X size={16} />
        </button>
      </div>

      <div className="detail-section">
        <div className="section-title">基本信息</div>
        <div className="field-grid">
          <label className={errors.name ? 'field invalid' : 'field'}>
            名称
            <input value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <em>{errors.name}</em>}
          </label>
          <label className={errors.version ? 'field invalid' : 'field'}>
            版本
            <input value={version} onChange={(e) => setVersion(e.target.value)} />
            {errors.version && <em>{errors.version}</em>}
          </label>
          <label className={errors.license ? 'field invalid' : 'field'}>
            许可证（SPDX 表达式）
            <input value={license} onChange={(e) => setLicense(e.target.value)} list="spdx-edit" />
            <datalist id="spdx-edit">
              {Object.values(LICENSE_DB).map((l) => (
                <option key={l.id} value={l.id} />
              ))}
            </datalist>
            {errors.license ? (
              <em>{errors.license}</em>
            ) : (
              preview.unknownIds.length > 0 && <em className="warn-text">未识别的标识：{preview.unknownIds.join('、')}</em>
            )}
          </label>
        </div>
      </div>

      <div className="detail-section">
        <div className="section-title">
          风险评估
          <RiskBadge level={preview.level} />
        </div>
        <div className="eval-meta">
          <LicenseBadge license={preview.normalized} category={preview.category} />
          <span className="muted">类别：{CATEGORY_LABEL[preview.category]}</span>
        </div>
        <ul className="reason-list">
          {preview.reasons.map((r, i) => (
            <li key={i}>
              <AlertTriangle size={12} />
              {r}
            </li>
          ))}
        </ul>
        <div className="obligations">
          <div className="obligations-title">
            <Info size={13} />
            许可证义务
          </div>
          <ul>
            {preview.obligations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="detail-section">
        <div className="section-title">审查处理</div>
        <div className="review-picker">
          {REVIEW_ORDER.map((s) => (
            <button
              key={s}
              className={review === s ? `review-opt review-${s} on` : `review-opt review-${s}`}
              onClick={() => setReview(s)}
            >
              {review === s && <Check size={12} />}
              {REVIEW_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            负责人
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="指派处理人" />
          </label>
          <label className="field">
            替代方案
            <input
              value={alternative}
              onChange={(e) => setAlternative(e.target.value)}
              placeholder="如：nearley 3.0（MIT）"
            />
          </label>
        </div>
        <label className="field">
          备注
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="豁免理由、核查结论、待办事项…"
          />
        </label>
      </div>

      <div className="detail-actions">
        <button className="outline danger-outline" onClick={() => onDelete(dep.id)}>
          <Trash2 size={14} />
          删除
        </button>
        <button className="primary" onClick={save} disabled={!dirty || hasError}>
          保存更改
          {dirty && !hasError && <span className="dirty-dot" />}
        </button>
      </div>
    </div>
  );
}
