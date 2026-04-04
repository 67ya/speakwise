import { useState } from 'react';
import { analyzeCode } from '../api/code';
import { createEntry, getEntries } from '../api/entries';
import type { Category } from '../types';

interface CodeEntry {
  id: string;
  code: string;
  summary: string;
  analysis: string;
}

interface Props {
  categories: Category[];
  defaultCategoryId: number | null;
  onSaved: () => void;
  showToast: (msg: string) => void;
}

export default function CodeView({ categories, defaultCategoryId, onSaved, showToast }: Props) {
  const [code, setCode]               = useState('');
  const [entries, setEntries]         = useState<CodeEntry[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [categoryId, setCategoryId]   = useState('');
  const [mobileDetail, setMobileDetail] = useState(false);

  const selected = entries.find(e => e.id === selectedId) ?? null;

  const handleAnalyze = async () => {
    if (!code.trim()) { showToast('请先输入代码'); return; }
    setLoading(true);
    try {
      const r = await analyzeCode(code.trim());
      const entry: CodeEntry = {
        id: Date.now().toString(),
        code: code.trim(),
        summary: r.summary,
        analysis: r.analysis,
      };
      setEntries([entry]);
      setSelectedId(entry.id);
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : '');
      if (r.fromCache) showToast('⚡ 已从缓存加载');
    } catch (e: any) {
      showToast('分析失败：' + (e.response?.data?.error ?? e.message));
    } finally {
      setLoading(false);
    }
  };

  const selectEntry = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!categoryId) { showToast('请先选择分类'); return; }
    const existing = await getEntries();
    const inCat = existing.filter(e => e.categoryId === parseInt(categoryId));
    if (inCat.some(e => e.question === selected.code)) {
      showToast('该代码已存在于笔记本'); return;
    }
    await createEntry({
      question:    selected.code,
      original:    selected.summary,
      spoken:      selected.analysis,
      translation: '',
      analysis:    '',
      corrections: '—',
      categoryId:  parseInt(categoryId),
    });
    showToast('已保存到笔记本 ✓');
    onSaved();
  };

  const detailPanel = (
    <div className="daily-detail">
      {!selected ? (
        <div className="detail-ph">← 分析代码后查看详情</div>
      ) : (
        <div>
          <button className="btn-back" onClick={() => setMobileDetail(false)}>← 返回列表</button>

          <div className="detail-section">
            <div className="section-label">代码总结</div>
            <p style={{ fontWeight: 600 }}>{selected.summary}</p>
          </div>

          <div className="detail-section">
            <div className="section-label">源代码</div>
            <pre className="code-block"><code>{selected.code}</code></pre>
          </div>

          <div className="detail-section">
            <div className="section-label">代码解析</div>
            <pre className="code-block"><code>{selected.analysis}</code></pre>
          </div>

          <div className="detail-section">
            <div className="result-actions">
              <select
                className="category-select"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">— 请选择分类 —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn btn-success" onClick={handleSave}>保存到笔记本</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="daily-wrap">
      {/* 左侧面板 */}
      <div className={`daily-left${mobileDetail ? ' daily-left--hidden' : ''}`}>
        <div className="daily-input-area">
          <textarea
            className="input-textarea code-textarea"
            rows={10}
            placeholder="粘贴代码块，点击分析..."
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
          />
          <div className="daily-btn-row">
            <button
              className="btn btn-primary"
              disabled={loading}
              onClick={handleAnalyze}
            >
              {loading ? '分析中...' : '分析'}
            </button>
          </div>
          {loading && (
            <div className="loading" style={{ marginTop: 10 }}>
              <div className="spinner" />
              <span>AI 正在分析，请稍候...</span>
            </div>
          )}
        </div>

        <div className="daily-list-header">
          {entries.length === 0 ? '分析结果' : `共 ${entries.length} 条`}
        </div>

        <div className="daily-list">
          {entries.length === 0 && (
            <div className="empty-tip">粘贴代码并点击分析</div>
          )}
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`daily-line-item${entry.id === selectedId ? ' selected' : ''}`}
              onClick={() => selectEntry(entry.id)}
            >
              <div className="daily-line-top">
                <span className="entry-index">{i + 1}</span>
                <span className="daily-line-en">{entry.summary}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className={`daily-detail-wrap${mobileDetail ? ' daily-detail-wrap--visible' : ''}`}>
        {detailPanel}
      </div>
    </div>
  );
}
