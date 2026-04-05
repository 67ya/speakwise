import { useState, useRef } from 'react';
import { analyzeDaily, randomConversation } from '../api/daily';
import { createEntry, getEntries } from '../api/entries';
import type { Category, DailyLine } from '../types';

interface Props {
  categories: Category[];
  defaultCategoryId: number | null;
  onSaved: () => void;
  showToast: (msg: string) => void;
}

export default function DailyView({ categories, defaultCategoryId, onSaved, showToast }: Props) {
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
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : '');
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
      const topic = chinese.trim() || undefined;
      const r = await randomConversation(topic);
      const newLines: DailyLine[] = r.lines.map((l, i) => ({
        id: `${Date.now()}-${i}`,
        chinese: l.chinese,
        spoken: l.english,
        vocabulary: l.vocabulary,
        speaker: l.speaker,
      }));
      setLines(newLines);
      setSelectedId(newLines[0]?.id ?? null);
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : '');
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
    const existing = await getEntries();
    const inCat = existing.filter(e => e.categoryId === parseInt(categoryId));
    if (inCat.some(e => e.original === selected.chinese)) {
      showToast('该句子已存在于笔记本'); return;
    }
    await createEntry({
      question:    '',
      original:    selected.chinese,
      spoken:      selected.spoken,
      translation: '',
      analysis:    selected.vocabulary,
      corrections: '—',
      categoryId:  parseInt(categoryId),
    });
    showToast('已保存到笔记本 ✓');
    onSaved();
  };

  const speak = (text: string) => {
    if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  const renderBlock = (text: string) =>
    text.split('\n').filter(l => l.trim()).map((l, i) => <p key={i}>{l}</p>);

  const isLoading = loading || randomLoading;

  // 跟手滑动切换
  const touchStartY  = useRef(0);
  const touchStartX  = useRef(0);
  const [dragY, setDragY]         = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const currentIndex = lines.findIndex(l => l.id === selectedId);

  const snapTo = (nextIndex: number, direction: number) => {
    const target = direction * window.innerHeight;
    setIsSnapping(true);
    setDragY(target);
    setTimeout(() => {
      setSelectedId(lines[nextIndex].id);
      setDragY(0);
      setIsSnapping(false);
    }, 260);
  };

  const goToNext = () => { if (currentIndex < lines.length - 1) snapTo(currentIndex + 1, -1); };
  const goToPrev = () => { if (currentIndex > 0)               snapTo(currentIndex - 1,  1); };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSnapping) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSnapping) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (Math.abs(dy) < dx * 0.8) return; // 横向滑动不处理
    if (dy < 0 && currentIndex >= lines.length - 1) return; // 已是最后一句
    if (dy > 0 && currentIndex <= 0) return;               // 已是第一句
    setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (isSnapping) return;
    const threshold = 70;
    if (dragY < -threshold && currentIndex < lines.length - 1) {
      snapTo(currentIndex + 1, -1);
    } else if (dragY > threshold && currentIndex > 0) {
      snapTo(currentIndex - 1, 1);
    } else {
      setIsSnapping(true);
      setDragY(0);
      setTimeout(() => setIsSnapping(false), 260);
    }
  };

  // 相邻卡片（拖动时显示）
  const adjacentIndex = dragY < 0 ? currentIndex + 1 : currentIndex - 1;
  const adjacentLine  = adjacentIndex >= 0 && adjacentIndex < lines.length ? lines[adjacentIndex] : null;

  const renderCardBody = (line: DailyLine, withSave: boolean) => (
    <>
      <div className="detail-section">
        <div className="section-label">中文原句</div>
        <p style={{ color: '#555' }}>{line.chinese}</p>
      </div>
      <div className="detail-section">
        <div className="section-label-row">
          <div className="section-label">口语翻译</div>
          <button className="btn-speak" onClick={() => speak(line.spoken)} title="朗读英文">🔊</button>
        </div>
        <p>{line.spoken}</p>
      </div>
      <div className="detail-section">
        <div className="section-label">词汇解析</div>
        <div className="analysis-block">{renderBlock(line.vocabulary)}</div>
      </div>
      {withSave && (
        <div className="detail-section">
          <div className="result-actions">
            <select className="category-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— 请选择分类 —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn-success" onClick={handleSave}>保存到笔记本</button>
          </div>
        </div>
      )}
    </>
  );

  const transition = isSnapping ? 'transform 0.26s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';

  const detailPanel = (
    <div className="daily-detail">
      {!selected ? (
        <div className="detail-ph">← 从左侧选择一句话查看详情</div>
      ) : (
        <>
          <div className="daily-detail-topbar">
            <button className="btn-back" onClick={() => setMobileDetail(false)}>← 返回</button>
            {lines.length > 1 && (
              <div className="daily-card-nav">
                <button className="card-nav-btn" onClick={goToPrev} disabled={currentIndex === 0}>‹</button>
                <span className="card-nav-pos">{currentIndex + 1} / {lines.length}</span>
                <button className="card-nav-btn" onClick={goToNext} disabled={currentIndex === lines.length - 1}>›</button>
              </div>
            )}
          </div>

          <div
            className="daily-swipe-area"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* 当前卡片 */}
            <div
              className="daily-card-slide"
              style={{
                transform: `translateY(${dragY}px)`,
                transition,
                opacity: Math.max(0.2, 1 - Math.abs(dragY) / 500),
              }}
            >
              {renderCardBody(selected, true)}
            </div>

            {/* 相邻卡片（跟随拖动出现） */}
            {adjacentLine && (
              <div
                className="daily-card-slide daily-card-adjacent"
                style={{
                  transform: `translateY(calc(${dragY < 0 ? '100%' : '-100%'} + ${dragY}px))`,
                  transition,
                }}
              >
                {renderCardBody(adjacentLine, false)}
              </div>
            )}
          </div>
        </>
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
                <span className="daily-line-en">{line.chinese}</span>
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
