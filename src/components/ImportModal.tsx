import { AlertTriangle, Check, Copy, Download, FileUp, Minus } from 'lucide-react';
import { useRef, useState } from 'react';
import { downloadFile } from '../lib/exporter';
import { importSummary, parseImport, type ImportResult } from '../lib/importer';
import { useEscape } from '../hooks/useEscape';

interface ImportModalProps {
  existingNames: Set<string>;
  onImport: (rows: { name: string; version: string; license: string }[]) => void;
  onClose: () => void;
}

const TEMPLATE = `name,version,license
react,18.3.1,MIT
lodash,4.17.21,MIT
legacy-parser,2.1.0,GPL-3.0-only
`;

const PLACEHOLDER = `支持三种格式：
1. JSON 数组：[{"name":"react","version":"18.3.1","license":"MIT"}]
2. package.json 片段：{"dependencies":{"react":"^18.3.1"}}
3. CSV / 每行一条：react,18.3.1,MIT 或 react@18.3.1 MIT`;

export function ImportModal({ existingNames, onImport, onClose }: ImportModalProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEscape(onClose);

  const parse = (value: string) => setResult(parseImport(value, existingNames));

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setText(content);
      parse(content);
    };
    reader.readAsText(file);
  };

  const summary = result && result.rows.length > 0 ? importSummary(result.rows) : null;
  const validRows = result ? result.rows.filter((r) => r.errors.length === 0 && !r.duplicate) : [];

  const doImport = () => {
    if (validRows.length === 0) return;
    onImport(validRows.map(({ name, version, license }) => ({ name, version, license })));
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>批量导入依赖</h2>
          <button onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="import-tools">
          <button className="outline" onClick={() => fileRef.current?.click()}>
            <FileUp size={14} />
            选择文件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,.txt,.tsv"
            hidden
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            className="link"
            onClick={() => downloadFile('license-import-template.csv', TEMPLATE, 'text/csv')}
          >
            <Download size={13} />
            下载 CSV 模板
          </button>
        </div>

        <textarea
          className="import-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={7}
          placeholder={PLACEHOLDER}
        />

        <button className="outline full" onClick={() => parse(text)} disabled={!text.trim()}>
          解析内容
        </button>

        {result?.fatal && (
          <div className="import-fatal">
            <AlertTriangle size={14} />
            {result.fatal}
          </div>
        )}

        {summary && (
          <>
            <div className="import-summary">
              共 {result!.rows.length} 条：有效 <b className="teal">{summary.valid}</b> · 重复跳过{' '}
              <b>{summary.skipped}</b> · 错误 <b className="red">{summary.failed}</b>
            </div>
            <div className="import-preview">
              {result!.rows.map((r, i) => {
                const state = r.errors.length > 0 ? 'error' : r.duplicate ? 'dup' : 'ok';
                return (
                  <div key={i} className={`import-row ${state}`}>
                    <span className="import-icon">
                      {state === 'ok' ? <Check size={13} /> : state === 'dup' ? <Minus size={13} /> : <AlertTriangle size={13} />}
                    </span>
                    <span className="import-name">
                      {r.name || <Copy size={12} />} {r.version && <em>{r.version}</em>} {r.license && <code>{r.license}</code>}
                    </span>
                    <span className="import-msgs">
                      {[...r.errors, ...r.warnings].map((m, j) => (
                        <em key={j} className={r.errors.includes(m) ? 'err-text' : 'warn-text'}>
                          {m}
                        </em>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="outline" onClick={onClose}>
            取消
          </button>
          <button className="primary" onClick={doImport} disabled={validRows.length === 0}>
            导入 {validRows.length > 0 ? `${validRows.length} 条有效记录` : '有效记录'}
          </button>
        </div>
      </div>
    </div>
  );
}
