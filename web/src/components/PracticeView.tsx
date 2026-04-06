import { useState, useRef, useCallback } from 'react';
import { analyze } from '../api/analyze';
import { createEntry, getEntries } from '../api/entries';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { Category, PendingEntry, PracticeType } from '../types';

interface BatchItem { question?: string; sentence: string; }

const PRACTICE_TYPES: { value: PracticeType; label: string }[] = [
  { value: 'general',   label: '日常英语优化' },
  { value: 'interview', label: '专业面试答案' },
];

function getSections(practiceType: PracticeType) {
  return [
    { key: 'spoken',      label: practiceType === 'interview' ? '面试优化答案' : '口语版本' },
    { key: 'translation', label: '中文翻译' },
    { key: 'analysis',    label: '词汇解析' },
    { key: 'corrections', label: practiceType === 'interview' ? '内容优化说明' : '修改建议' },
  ] as const;
}

interface Props {
  categories: Category[];
  onSaved: () => void;
  showToast: (msg: string) => void;
}

function MicButton({ voiceState, onToggle }: { voiceState: string; onToggle: () => void }) {
  if (voiceState === 'unsupported') return null;
  return (
    <button
      type="button"
      className={`mic-btn${voiceState === 'listening' ? ' mic-btn--active' : ''}`}
      onClick={onToggle}
      title={voiceState === 'listening' ? '点击停止' : '语音输入'}
    >
      {voiceState === 'listening' ? '⏹' : '🎤'}
    </button>
  );
}

export default function PracticeView({ categories, onSaved, showToast }: Props) {
  const [question, setQuestion]         = useState('');
  const [sentence, setSentence]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<PendingEntry | null>(null);
  const [categoryId, setCategoryId]     = useState('');
  const [sentenceErr, setSentenceErr]   = useState(false);
  const [practiceType, setPracticeType] = useState<PracticeType>('general');
  const sentenceRef = useRef<HTMLTextAreaElement>(null);

  // 批量导入
  const [batchOpen, setBatchOpen]         = useState(false);
  const [batchItems, setBatchItems]       = useState<BatchItem[]>([]);
  const [batchCatId, setBatchCatId]       = useState('');
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; err: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onQuestionVoice = useCallback((text: string) => {
    setQuestion(prev => prev ? prev + ' ' + text : text);
  }, []);
  const onSentenceVoice = useCallback((text: string) => {
    setSentence(prev => prev ? prev + ' ' + text : text);
    setSentenceErr(false);
  }, []);

  const { voiceState: qVoice, toggle: qToggle } = useVoiceInput(onQuestionVoice);
  const { voiceState: sVoice, toggle: sToggle } = useVoiceInput(onSentenceVoice);

  const handleSubmit = async (includeSpoken: boolean) => {
    if (!sentence.trim()) {
      setSentenceErr(true);
      sentenceRef.current?.focus();
      setTimeout(() => setSentenceErr(false), 2000);
      showToast('请先输入一个英语句子');
      return;
    }
    // 面试模式强制包含优化版答案
    const actualIncludeSpoken = practiceType === 'interview' ? true : includeSpoken;
    setLoading(true);
    setResult(null);
    try {
      const r = await analyze(sentence.trim(), actualIncludeSpoken, practiceType);
      setResult({ ...r, question: question.trim(), original: sentence.trim(), includeSpoken: actualIncludeSpoken, practiceType });
      setCategoryId('');
      if (r.fromCache) showToast('⚡ 已从缓存加载');
    } catch (e: any) {
      showToast('分析失败：' + (e.response?.data?.error ?? e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    if (!categoryId) { showToast('请先选择分类'); return; }
    const existing = await getEntries();
    const inCat = existing.filter(e => e.categoryId === parseInt(categoryId));
    if (inCat.some(e => e.original === result.original)) {
      showToast('该句子已存在于笔记本'); return;
    }
    await createEntry({
      question:    result.question,
      original:    result.original,
      spoken:      result.spoken,
      translation: result.translation,
      analysis:    result.analysis,
      corrections: result.corrections,
      categoryId:  parseInt(categoryId),
    });
    setQuestion('');
    setSentence('');
    setResult(null);
    showToast('已保存到笔记本 ✓');
    onSaved();
  };

  const [pasteText, setPasteText]   = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const parseJson = (text: string) => {
    try {
      const json = JSON.parse(text);
      if (!Array.isArray(json)) { showToast('JSON 格式错误：根节点须为数组'); return; }
      const items: BatchItem[] = json
        .filter((x: any) => typeof x.sentence === 'string' && x.sentence.trim())
        .map((x: any) => ({ question: x.question?.trim() || '', sentence: x.sentence.trim() }));
      if (items.length === 0) { showToast('未找到有效条目（需含 sentence 字段）'); return; }
      setBatchItems(items);
      setPasteText('');
    } catch { showToast('JSON 解析失败，请检查格式'); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => parseJson(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => parseJson(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleBatchImport = async () => {
    if (!batchCatId) { showToast('请先选择分类'); return; }
    if (batchItems.length === 0) return;

    const existing = await getEntries();
    const inCat = existing.filter(e => e.categoryId === parseInt(batchCatId));
    const existingSet = new Set(inCat.map(e => e.original));

    const total = batchItems.length;
    let done = 0, err = 0;
    setBatchProgress({ done: 0, total, err: 0 });

    const CONCURRENCY = 10;
    const queue = [...batchItems];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        try {
          if (!existingSet.has(item.sentence)) {
            const r = await analyze(item.sentence, false, 'general');
            await createEntry({
              question:    item.question || '',
              original:    item.sentence,
              spoken:      r.spoken,
              translation: r.translation,
              analysis:    r.analysis,
              corrections: r.corrections,
              categoryId:  parseInt(batchCatId),
            });
            existingSet.add(item.sentence);
          }
        } catch { err++; }
        done++;
        setBatchProgress({ done, total, err });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

    showToast(`导入完成：${done - err} 条成功${err > 0 ? `，${err} 条失败` : ''}`);
    setBatchItems([]);
    setBatchProgress(null);
    setBatchOpen(false);
    onSaved();
  };

  const renderBlock = (text: string) =>
    text.split('\n').filter(l => l.trim()).map((l, i) => <p key={i}>{l}</p>);

  const sections = getSections(result?.practiceType ?? practiceType);

  return (
    <div className="practice-wrap">
      <h2>输入句子</h2>

      <div className="input-label">练习类型</div>
      <select
        className="practice-type-select"
        value={practiceType}
        onChange={e => setPracticeType(e.target.value as PracticeType)}
      >
        {PRACTICE_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div className="input-label" style={{ marginTop: 12 }}>回答的问题（可选）</div>
      <div className="textarea-wrap">
        <textarea
          className="input-textarea"
          rows={2}
          placeholder="这句话是在回答什么问题？"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <MicButton voiceState={qVoice} onToggle={qToggle} />
      </div>

      <div className="input-label" style={{ marginTop: 12 }}>英语句子</div>
      <div className="textarea-wrap">
        <textarea
          ref={sentenceRef}
          className={`input-textarea${sentenceErr ? ' input-error' : ''}`}
          rows={4}
          placeholder="在此输入一个英语句子..."
          value={sentence}
          onChange={e => { setSentence(e.target.value); setSentenceErr(false); }}
        />
        <MicButton voiceState={sVoice} onToggle={sToggle} />
      </div>

      <div className="submit-row">
        {practiceType === 'interview' ? (
          <button className="btn btn-primary" disabled={loading} onClick={() => handleSubmit(true)}>面试优化分析</button>
        ) : (
          <>
            <button className="btn btn-primary" disabled={loading} onClick={() => handleSubmit(false)}>快速分析</button>
            <button className="btn btn-primary" disabled={loading} onClick={() => handleSubmit(true)}>完整分析</button>
          </>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <span>AI 正在分析，请稍候...</span>
        </div>
      )}

      {/* 批量导入 */}
      <div className="batch-section">
        <button className="btn-batch-toggle" onClick={() => { setBatchOpen(o => !o); setBatchItems([]); setBatchProgress(null); }}>
          {batchOpen ? '▲ 收起批量导入' : '▼ 批量导入'}
        </button>
        {batchOpen && (
          <div className="batch-panel">
            <p className="batch-desc">
              JSON 格式：<code>{'[{"question":"问题(可选)","sentence":"英文句子"}, ...]'}</code>
            </p>

            {/* 拖拽 / 点击选文件区域 */}
            <div
              className={`batch-dropzone${isDragOver ? ' batch-dropzone--over' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
              <span className="batch-dropzone-icon">📂</span>
              <span>拖入 JSON 文件，或点击选择</span>
            </div>

            {/* 粘贴区域 */}
            <div className="batch-paste-row">
              <textarea
                className="batch-paste-area"
                rows={4}
                placeholder='或直接粘贴 JSON，例如：[{"sentence":"I work at a tech company."}]'
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <button
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-end' }}
                disabled={!pasteText.trim()}
                onClick={() => parseJson(pasteText)}
              >解析</button>
            </div>

            {batchItems.length > 0 && (
              <>
                <div className="batch-preview-header">
                  <span className="batch-count">已加载 {batchItems.length} 条</span>
                  <button className="btn-clear-batch" onClick={() => setBatchItems([])}>✕ 清空</button>
                </div>
                <div className="batch-preview">
                  {batchItems.slice(0, 5).map((it, i) => (
                    <div key={i} className="batch-preview-item">
                      <span className="batch-preview-index">#{i + 1}</span>
                      {it.question && <span className="batch-preview-q">{it.question}</span>}
                      <span className="batch-preview-s">{it.sentence}</span>
                    </div>
                  ))}
                  {batchItems.length > 5 && <div className="batch-preview-more">…还有 {batchItems.length - 5} 条</div>}
                </div>
                <div className="batch-row" style={{ marginTop: 10 }}>
                  <select className="category-select" value={batchCatId} onChange={e => setBatchCatId(e.target.value)}>
                    <option value="">— 选择目标分类 —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    className="btn btn-primary"
                    disabled={!!batchProgress}
                    onClick={handleBatchImport}
                  >
                    {batchProgress ? `分析中 ${batchProgress.done}/${batchProgress.total}…` : '开始导入'}
                  </button>
                </div>
                {batchProgress && (
                  <div className="batch-progress-bar">
                    <div className="batch-progress-fill" style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="result-card">
          {result.question && (
            <div className="result-section question-section">
              <div className="section-label">问题</div>
              <p>{result.question}</p>
            </div>
          )}
          <div className="result-section">
            <div className="section-label">原句</div>
            <p>{result.original}</p>
          </div>
          {result.includeSpoken && (
            <div className="result-section">
              <div className="section-label">{sections[0].label}</div>
              <p>{result.spoken}</p>
            </div>
          )}
          {sections.filter(s => s.key !== 'spoken').map(s => (
            <div key={s.key} className={`result-section${s.key === 'corrections' ? ' corrections-section' : ''}`}>
              <div className="section-label">{s.label}</div>
              <div className="analysis-block">{renderBlock(result[s.key])}</div>
            </div>
          ))}

          <div className="result-actions">
            <select
              className="category-select"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">— 请选择分类 —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn-success" onClick={handleSave}>确认保存</button>
            <button className="btn btn-secondary" onClick={() => setResult(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
