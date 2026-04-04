import { useState } from 'react';
import { analyzeDaily, randomConversation } from '../api/daily';
import { createEntry } from '../api/entries';
import type { Category, DailyLine } from '../types';

interface Props {
  categories: Category[];
  onSaved: () => void;
  showToast: (msg: string) => void;
}

export default function DailyView({ categories, onSaved, showToast }: Props) {
  const [chinese, setChinese]         = useState('');
  const [lines, setLines]             = useState<DailyLine[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [categoryId, setCategoryId]   = useState('');
  const [mobileDetail, setMobileDetail] = useState(false);

  const selected = lines.find(l => l.id === selectedId) ?? null;

  const handleAnalyze = async () => {
    if (!chinese.trim()) { showToast('请先输入中文句子'); return; }
    setLoading(true);
    try {
      const r = await analyzeDaily(chinese.trim());
      const line: DailyLine = {
        id: Date.now().toString(),
        chinese: chinese.trim(),
        spoken: r.spoken,
        vocabulary: r.vocabulary,
      };
      setLines([line]);
      setSelectedId(line.id);
      setCategoryId('');
      if (r.fromCache) showToast('⚡ 已从缓存加载');
    } catch (e: any) {
      showToast('分析失败：' + (e.response?.data?.error ?? e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRandom = async () => {
    setRandomLoading(true);
    try {
      const r = await randomConversation();
      const newLines: DailyLine[] = r.lines.map((l, i) => ({
        id: `${Date.now()}-${i}`,
        chinese: l.chinese,
        spoken: l.english,
        vocabulary: l.vocabulary,
        speaker: l.speaker,
      }));
      setLines(newLines);
      setSelectedId(newLines[0]?.id ?? null);
      setCategoryId('');
    } catch (e: any) {
      showToast('生成失败：' + (e.response?.data?.error ?? e.message));
    } finally {
      setRandomLoading(false);
    }
  };

  const selectLine = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!categoryId) { showToast('请先选择分类'); return; }
    await createEntry({
      question:    '',
      original:    selected.spoken,
      spoken:      '',
      translation: selected.chinese,
      analysis:    selected.vocabulary,
      corrections: '—',
      categoryId:  parseInt(categoryId),
    });
    showToast('已保存到笔记本 ✓');
    onSaved();
  };

  const renderBlock = (text: string) =>
    text.split('\n').filter(l => l.trim()).map((l, i) => <p key={i}>{l}</p>);

  const isLoading = loading || randomLoading;

  const detailPanel = (
    <div className="daily-detail">
      {!selected ? (
        <div className="detail-ph">← 从左侧选择一句话查看详情</div>
      ) : (
        <div>
          <button className="btn-back" onClick={() => setMobileDetail(false)}>← 返回列表</button>

          <div className="detail-section">
            <div className="section-label">英文口语</div>
            <p>{selected.spoken}</p>
          </div>

          <div className="detail-section">
            <div className="section-label">中文原句</div>
            <p style={{ color: '#555' }}>{selected.chinese}</p>
          </div>

          <div className="detail-section">
            <div className="section-label">词汇解析</div>
            <div className="analysis-block">{renderBlock(selected.vocabulary)}</div>
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
            className="input-textarea"
            rows={3}
            placeholder="输入中文句子，获取英语口语表达..."
            value={chinese}
            onChange={e => setChinese(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze(); } }}
          />
          <div className="daily-btn-row">
            <button
              className="btn btn-primary"
              disabled={isLoading}
              onClick={handleAnalyze}
            >
              {loading ? '分析中...' : '分析'}
            </button>
            <button
              className="btn btn-daily-random"
              disabled={isLoading}
              onClick={handleRandom}
            >
              {randomLoading ? '生成中...' : '随机生成对话'}
            </button>
          </div>
          {isLoading && (
            <div className="loading" style={{ marginTop: 10 }}>
              <div className="spinner" />
              <span>AI 正在生成，请稍候...</span>
            </div>
          )}
        </div>

        <div className="daily-list-header">
          {lines.length === 0 ? '对话列表' : `共 ${lines.length} 句`}
        </div>

        <div className="daily-list">
          {lines.length === 0 && (
            <div className="empty-tip">输入中文或随机生成对话</div>
          )}
          {lines.map((line, i) => (
            <div
              key={line.id}
              className={`daily-line-item${line.id === selectedId ? ' selected' : ''}`}
              onClick={() => selectLine(line.id)}
            >
              <div className="daily-line-top">
                {line.speaker && (
                  <span className={`daily-speaker-badge daily-speaker-${line.speaker.toLowerCase()}`}>
                    {line.speaker}
                  </span>
                )}
                {!line.speaker && (
                  <span className="entry-index">{i + 1}</span>
                )}
                <span className="daily-line-en">{line.spoken}</span>
              </div>
              <div className="daily-line-zh">{line.chinese}</div>
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
