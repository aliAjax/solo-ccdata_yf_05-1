import { useMemo, useState } from 'react';
import { LICENSE_DB } from '../lib/licenses';
import { evaluateLicense } from '../lib/risk';
import { parseSpdx } from '../lib/spdx';
import { validateName, validateNameUnique, validateVersion } from '../lib/validate';
import type { Settings } from '../lib/types';
import { CATEGORY_LABEL } from '../lib/types';
import { useEscape } from '../hooks/useEscape';
import { RiskBadge } from './badges';

export interface NewDepFields {
  name: string;
  version: string;
  license: string;
}

interface AddDepModalProps {
  settings: Settings;
  existingNames: Set<string>;
  onAdd: (fields: NewDepFields) => void;
  onClose: () => void;
}

export function AddDepModal({ settings, existingNames, onAdd, onClose }: AddDepModalProps) {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [license, setLicense] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEscape(onClose);

  const errors = useMemo(() => {
    const nameErr = validateName(name) ?? validateNameUnique(name, existingNames);
    return {
      name: nameErr,
      version: validateVersion(version),
      license: license.trim() ? (parseSpdx(license).ok ? null : (parseSpdx(license).error ?? '许可证表达式无效')) : '许可证不能为空',
    };
  }, [name, version, license, existingNames]);

  const hasError = Boolean(errors.name || errors.version || errors.license);
  const preview = useMemo(
    () => (errors.license ? null : evaluateLicense(license, settings)),
    [license, settings, errors.license],
  );

  const showErr = (err: string | null, value: string) => (submitted || value ? err : null);

  const submit = () => {
    setSubmitted(true);
    if (hasError) return;
    onAdd({ name: name.trim(), version: version.trim(), license: preview?.normalized ?? license.trim() });
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>添加依赖</h2>
          <button onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <label className={showErr(errors.name, name) ? 'field invalid' : 'field'}>
          依赖名称
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 date-fns 或 @scope/pkg" />
          {showErr(errors.name, name) && <em>{errors.name}</em>}
        </label>

        <label className={showErr(errors.version, version) ? 'field invalid' : 'field'}>
          版本
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="例如 3.6.0（实际解析版本）" />
          {showErr(errors.version, version) && <em>{errors.version}</em>}
        </label>

        <label className={showErr(errors.license, license) ? 'field invalid' : 'field'}>
          许可证（SPDX 表达式）
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="例如 MIT、(MIT OR Apache-2.0)"
            list="spdx-add"
          />
          <datalist id="spdx-add">
            {Object.values(LICENSE_DB).map((l) => (
              <option key={l.id} value={l.id}>
                {CATEGORY_LABEL[l.category]}
              </option>
            ))}
          </datalist>
          {showErr(errors.license, license) && <em>{errors.license}</em>}
        </label>

        {preview && (
          <div className={`risk-preview ${preview.level}`}>
            <div className="risk-preview-head">
              <span>按当前规则评估</span>
              <RiskBadge level={preview.level} />
            </div>
            <p>{preview.reasons[0]}</p>
            {preview.unknownIds.length > 0 && <p className="warn-text">未识别的标识：{preview.unknownIds.join('、')}</p>}
          </div>
        )}

        <button className="primary full" onClick={submit}>
          加入审查
        </button>
      </div>
    </div>
  );
}
