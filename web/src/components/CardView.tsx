import { useState, useCallback } from 'react';
import { getEntries, updateColor } from '../api/entries';
import type { Entry, Category } from '../types';

const DAILY_CAT     = '中英天天练';
const CODE_CAT      = '代码解析';
const INTERVIEW_CAT = '面试';
const P1_COLOR  = '#E0E0E0';
const HIGH_COLORS = new Set(['#FFE0B2', '#F8BBD9', '#9FA8DA']); // P5, P6, P7

const PRIORITY_COLORS = [
  { label: 'P1 最低', value: '#E0E0E0', text: '#555' },
  { label: 'P2',      value: '#FFF59D', text: '#5D4037' },
  { label: 'P3',      value: '#C8E6C9', text: '#1B5E20' },
  { label: 'P4',      value: '#B3E5FC', text: '#01579B' },
  { label: 'P5',      value: '#FFE0B2', text: '#E65100' },
  { label: 'P6',      value: '#F8BBD9', text: '#880E4F' },
  { label: 'P7 最高', value: '#9FA8DA', text: '#1A237E' },
];

interface Props {
  categories: Category[];
  showToast: (msg: string) => void;
}

const TODAY = new Date().toISOString().slice(0, 10);
const STORAGE_KEY = `card_passed_${TODAY}`;

function loadPassedToday(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as number[]);
  } catch {
    return new Set();
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawCards(entries: Entry[], passedToday: Set<number>): Entry[] {
  const pool = entries.filter(e => !passedToday.has(e.id));
  const high = shuffle(pool.filter(e => e.color != null && HIGH_COLORS.has(e.color)));
  const low  = shuffle(pool.filter(e => !e.color || !HIGH_COLORS.has(e.color)));
  const taken = high.slice(0, 3);
  const rest  = low.slice(0, 10 - taken.length);
  return [...taken, ...rest];
}

const renderLines = (text: string) =>
  text.split('\n').filter(l => l.trim()).map((l, i) => <p key={i}>{l}</p>);

export default function CardView({ categories, showToast }: Props) {
  const [selectedCatId, setSelectedCatId] = useState('');
  const [cards, setCards]                 = useState<Entry[]>([]);
  const [flipped, setFlipped]             = useState<Set<number>>(new Set());
  const [passedToday, setPassedToday]     = useState<Set<number>>(loadPassedToday);
  const [colors, setColors]               = useState<Map<number, string | null>>(new Map());
  const [isLoading, setIsLoading]         = useState(false);

  const markPassed = (id: number) => {
    setPassedToday(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const handleStart = useCallback(async () => {
    if (!selectedCatId) { showToast('请先选择一个分类'); return; }
    setIsLoading(true);
    try {
      const all = await getEntries();
      const catEntries = all.filter(e => e.categoryId === parseInt(selectedCatId));
      if (catEntries.length === 0) { showToast('该分类暂无条目'); return; }
      const drawn = drawCards(catEntries, passedToday);
      const colorMap = new Map<number, string | null>();
      drawn.forEach(e => colorMap.set(e.id, e.color ?? null));
      setColors(colorMap);
      setCards(drawn);
      setFlipped(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [selectedCatId, passedToday, showToast]);

  const handleFlip = (id: number) => {
    setFlipped(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleColor = async (entry: Entry, color: string | null) => {
    await updateColor(entry.id, color);
    setColors(prev => new Map(prev).set(entry.id, color));
    if (color === P1_COLOR) {
      markPassed(entry.id);
      setCards(prev => prev.filter(c => c.id !== entry.id));
      showToast('已标记为今日掌握 ✓');
    }
  };

  const catName     = categories.find(c => c.id === parseInt(selectedCatId))?.name ?? '';
  const isDaily     = catName === DAILY_CAT;
  const isCode      = catName === CODE_CAT;
  const isInterview = catName.includes(INTERVIEW_CAT);

  const renderBack = (entry: Entry) => {
    if (isCode) return (
      <div className="card-back">
        {entry.question && (
          <div className="detail-section">
            <div className="section-label">源代码</div>
            <pre className="code-block"><code>{entry.question}</code></pre>
          </div>
        )}
        <div className="detail-section">
          <div className="section-label">代码解析</div>
          <pre className="code-block"><code>{entry.spoken}</code></pre>
        </div>
      </div>
    );

    if (isInterview) return (
      <div className="card-back">
        <div className="detail-section">
          <div className="section-label">我的原始答案</div>
          <p>{entry.original}</p>
        </div>
        {entry.spoken && (
          <div className="detail-section">
            <div className="section-label">面试优化答案</div>
            <p>{entry.spoken}</p>
          </div>
        )}
        {entry.translation && (
          <div className="detail-section">
            <div className="section-label">中文翻译</div>
            <p>{entry.translation}</p>
          </div>
        )}
        {entry.analysis && (
          <div className="detail-section">
            <div className="section-label">词汇解析</div>
            <div className="analysis-block">{renderLines(entry.analysis)}</div>
          </div>
        )}
        {entry.corrections && entry.corrections !== '—' && (
          <div className="detail-section">
            <div className="section-label">内容优化说明</div>
            <div className="analysis-block">{renderLines(entry.corrections)}</div>
          </div>
        )}
      </div>
    );

    if (isDaily) return (
      <div className="card-back">
        <div className="detail-section">
          <div className="section-label">英文口语</div>
          <p>{entry.spoken}</p>
        </div>
        {entry.analysis && (
          <div className="detail-section">
            <div className="section-label">词汇解析</div>
            <div className="analysis-block">{renderLines(entry.analysis)}</div>
          </div>
        )}
      </div>
    );

    return (
      <div className="card-back">
        {entry.spoken && (
          <div className="detail-section">
            <div className="section-label">口语版本</div>
            <p>{entry.spoken}</p>
          </div>
        )}
        {entry.translation && (
          <div className="detail-section">
            <div className="section-label">中文翻译</div>
            <p>{entry.translation}</p>
          </div>
        )}
        {entry.analysis && (
          <div className="detail-section">
            <div className="section-label">词汇解析</div>
            <div className="analysis-block">{renderLines(entry.analysis)}</div>
          </div>
        )}
        {entry.corrections && entry.corrections !== '—' && (
          <div className="detail-section">
            <div className="section-label">修改建议</div>
            <div className="analysis-block">{renderLines(entry.corrections)}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
      <div className="card-toolbar">
        <select
          className="category-select-inline"
          value={selectedCatId}
          onChange={e => { setSelectedCatId(e.target.value); setCards([]); setFlipped(new Set()); }}
        >
          <option value="">— 选择分类 —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-primary" onClick={handleStart} disabled={isLoading}>
          {isLoading ? '加载中…' : '开始复习'}
        </button>
        <span className="card-passed-count">今日已掌握：{passedToday.size} 张</span>
      </div>

      {cards.length === 0 && !isLoading && (
        <div className="empty-tip" style={{ margin: '60px auto', textAlign: 'center' }}>
          {selectedCatId ? '该分类今日已全部掌握 🎉' : '选择分类后点击"开始复习"'}
        </div>
      )}

      <div className="card-grid">
        {cards.map((entry, i) => {
          const isFlipped  = flipped.has(entry.id);
          const color      = colors.get(entry.id);
          const colorInfo  = PRIORITY_COLORS.find(c => c.value === color);
          return (
            <div
              key={entry.id}
              className={`flash-card${isFlipped ? ' flash-card--flipped' : ''}`}
              style={color ? { backgroundColor: color, color: colorInfo?.text } : {}}
              onClick={() => handleFlip(entry.id)}
            >
              <div className="card-index">#{i + 1}</div>
              <div
                className="card-front"
                onClick={isFlipped ? e => e.stopPropagation() : undefined}
              >{isInterview && entry.question ? entry.question : entry.original}</div>
              <div className="card-hint">{isFlipped ? '点击折叠 ▲' : '点击查看详情 ▼'}</div>

              {isFlipped && (
                <>
                  <div onClick={e => e.stopPropagation()}>
                    {renderBack(entry)}
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 12 }}>
                    <span className="color-label">标记：</span>
                    <div id="color-btns">
                      {PRIORITY_COLORS.map(c => (
                        <button
                          key={c.value}
                          className={`color-dot${color === c.value ? ' active-color' : ''}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                          onClick={ev => { ev.stopPropagation(); handleColor(entry, c.value); }}
                        />
                      ))}
                    </div>
                    <button
                      className="color-clear-btn"
                      onClick={ev => { ev.stopPropagation(); handleColor(entry, null); }}
                    >✕</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
