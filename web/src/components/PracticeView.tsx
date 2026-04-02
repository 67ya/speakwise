import { useState, useRef, useCallback } from 'react';
import { analyze } from '../api/analyze';
import { createEntry } from '../api/entries';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { Category, PendingEntry, PracticeType } from '../types';

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
