import { useState, useEffect, useRef } from 'react';
import { getEntries, updateColor } from '../api/entries';
import { scoreExam, getExamHistory, saveExamHistory, getEntryScores, saveEntryScores } from '../api/exam';
import type { Entry } from '../types';
import type { ExamAnswer, AnswerFeedback, ExamHistoryRecord, EntryScoreRecord } from '../api/exam';

interface Props {
  dailyCategoryId: number | null;
  codeCategoryId:  number | null;
  showToast: (msg: string) => void;
}

type CardType = 'english' | 'daily' | 'code';
type Phase = 'setup' | 'exam' | 'grading' | 'result' | 'review';

interface ExamCard {
  entry:    Entry;
  cardType: CardType;
  blanks?:  { lineIndex: number; comment: string }[];
}

// Stored per-item in history
interface HistoryItem {
  cardType:     CardType;
  prompt:       string;
  userInput:    string;
  markedAnswer: string;
  expected:     string;
  score:        number;
  deduction:    number;
  comment:      string;
  spoken?:      string;
  blanks?:      { lineIndex: number; comment: string }[];
  codeInputs?:  string[];
}

const TOTAL_CARDS = 10;
const BLANK_SEP   = '|||';

// 由深到浅：P7→P6→P5→P4→P3→P2→P1→null
// 分数越低颜色越深（需要重点复习），95+ 不标色
function scoreToColor(score: number): string | null {
  if (score <  65) return '#9FA8DA'; // P7
  if (score <  70) return '#F8BBD9'; // P6
  if (score <  75) return '#FFE0B2'; // P5
  if (score <  80) return '#B3E5FC'; // P4
  if (score <  85) return '#C8E6C9'; // P3
  if (score <  90) return '#FFF59D'; // P2
  if (score <  95) return '#E0E0E0'; // P1
  return null;                        // 95+ 不标色
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseCodeBlanks(spoken: string): { lineIndex: number; comment: string }[] {
  const lines = spoken.split('\n');
  const candidates: { lineIndex: number; comment: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(.*\S.*?)\s+#\s+(.+)$/);
    if (m && m[2].trim().length > 0) candidates.push({ lineIndex: i, comment: m[2].trim() });
  }
  return shuffle(candidates).slice(0, 5);
}

function renderCodeWithBlanks(
  spoken: string,
  blanks: { lineIndex: number; comment: string }[],
  inputs: string[],
  onChange: (idx: number, val: string) => void,
  readonly: boolean,
) {
  const lines    = spoken.split('\n');
  const blankMap = new Map(blanks.map((b, i) => [b.lineIndex, i]));
  return (
    <div className="code-blank-block">
      {lines.map((line, li) => {
        const blankIdx = blankMap.get(li);
        if (blankIdx !== undefined) {
          const hashIdx = line.lastIndexOf(' # ');
          const codePart = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
          return (
            <div key={li} className="code-blank-line">
              <span className="code-blank-code">{codePart} # </span>
              {readonly ? (
                <span className={`code-blank-answer${inputs[blankIdx] === blanks[blankIdx].comment ? ' correct' : ' wrong'}`}>
                  {inputs[blankIdx] || '（未填）'} → {blanks[blankIdx].comment}
                </span>
              ) : (
                <input
                  className="code-blank-input"
                  value={inputs[blankIdx] ?? ''}
                  placeholder="填写注释…"
                  onClick={e => e.stopPropagation()}
                  onChange={e => onChange(blankIdx, e.target.value)}
                />
              )}
            </div>
          );
        }
        return <div key={li} className="code-blank-line"><span className="code-blank-code">{line}</span></div>;
      })}
    </div>
  );
}

// Render answer with {{ERR}}...{{/ERR}} marked in red
function MarkedAnswer({ text }: { text: string }) {
  if (!text || !text.includes('{{ERR}}')) return <span>{text || '（未作答）'}</span>;
  const parts = text.split(/({{ERR}}.*?{{\/ERR}})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^{{ERR}}(.*){{\/ERR}}$/);
        return m
          ? <span key={i} className="answer-err">{m[1]}</span>
          : <span key={i}>{p}</span>;
      })}
    </>
  );
}

// Shared result list renderer (used in result phase + review phase)
function ResultList({ items }: { items: HistoryItem[] }) {
  if (!items?.length) return <div className="empty-tip" style={{ margin: '40px auto' }}>暂无题目数据（旧版记录不支持回顾）</div>;
  return (
    <div className="test-result-list">
      {items.map((item, i) => (
        <div key={i} className={`test-result-item${item.score >= 80 ? ' result-good' : item.score >= 60 ? ' result-ok' : ' result-bad'}`}>
          <div className="result-item-header">
            <span className="result-item-index">#{i + 1}</span>
            <span className={`result-item-badge badge-${item.cardType}`}>
              {item.cardType === 'english' ? '英语' : item.cardType === 'daily' ? '天天练' : '代码'}
            </span>
            <span className="result-item-score">{item.score} / 100</span>
          </div>
          <div className="result-item-prompt">{item.prompt}</div>
          {item.cardType !== 'code' && (
            <>
              <div className="result-item-user">
                你的答案：<MarkedAnswer text={item.markedAnswer || item.userInput} />
              </div>
              <div className="result-item-expected">参考答案：{item.expected}</div>
            </>
          )}
          {item.cardType === 'code' && item.spoken && item.blanks && renderCodeWithBlanks(
            item.spoken, item.blanks, item.codeInputs ?? [], () => {}, true,
          )}
          {item.comment && <div className="result-item-comment">{item.comment}</div>}
        </div>
      ))}
    </div>
  );
}

export default function TestView({ dailyCategoryId, codeCategoryId, showToast }: Props) {
  const [phase, setPhase]           = useState<Phase>('setup');
  const [minutes, setMinutes]       = useState(20);
  const [cards, setCards]           = useState<ExamCard[]>([]);
  const [answers, setAnswers]       = useState<Map<number, string>>(new Map());
  const [codeInputs, setCodeInputs] = useState<Map<number, string[]>>(new Map());
  const [timeLeft, setTimeLeft]     = useState(0);
  const [resultItems, setResultItems]   = useState<HistoryItem[]>([]);
  const [totalScore, setTotalScore]     = useState(0);
  const [history, setHistory]           = useState<ExamHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewRecord, setReviewRecord] = useState<ExamHistoryRecord | null>(null);
  const [isGrading, setIsGrading]   = useState(false);

  const startTimeRef  = useRef<number>(0);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef    = useRef<Map<number, string>>(new Map());
  const codeInputsRef = useRef<Map<number, string[]>>(new Map());
  const cardsRef      = useRef<ExamCard[]>([]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    setHistoryLoading(true);
    getExamHistory().then(setHistory).catch(() => {}).finally(() => setHistoryLoading(false));
  }, []);

  const handleStart = async () => {
    const [all, scoreRecords] = await Promise.all([getEntries(), getEntryScores().catch(() => [] as EntryScoreRecord[])]);
    const scoreMap = new Map(scoreRecords.map(s => [s.entryId, s.lastScore]));

    const daily  = all.filter(e => e.categoryId === dailyCategoryId);
    const code   = all.filter(e => e.categoryId === codeCategoryId);
    const others = all.filter(e => e.categoryId !== dailyCategoryId && e.categoryId !== codeCategoryId);

    if (daily.length + code.length + others.length === 0) { showToast('笔记本中没有任何条目'); return; }

    const toCard = (e: Entry): ExamCard => {
      if (e.categoryId === codeCategoryId) {
        const blanks = parseCodeBlanks(e.spoken);
        return { entry: e, cardType: 'code', blanks: blanks.length > 0 ? blanks : undefined };
      }
      if (e.categoryId === dailyCategoryId) return { entry: e, cardType: 'daily' };
      return { entry: e, cardType: 'english' };
    };

    // 按得分分桶：低分(<75) / 中分(75-94) / 未考过 / 高分(>=95 暂时跳过占用名额)
    const allCards = all
      .map(toCard)
      .filter(c => c.cardType !== 'code' || (c.blanks && c.blanks.length > 0));

    const lowCards    = shuffle(allCards.filter(c => { const s = scoreMap.get(c.entry.id); return s !== undefined && s <  75; }));
    const midCards    = shuffle(allCards.filter(c => { const s = scoreMap.get(c.entry.id); return s !== undefined && s >= 75 && s < 95; }));
    const newCards    = shuffle(allCards.filter(c => !scoreMap.has(c.entry.id)));
    const highCards   = shuffle(allCards.filter(c => { const s = scoreMap.get(c.entry.id); return s !== undefined && s >= 95; }));

    // 5:3:2 比例，不足时从其他桶补充
    const want = { low: Math.round(TOTAL_CARDS * 0.5), mid: Math.round(TOTAL_CARDS * 0.3), new: TOTAL_CARDS - Math.round(TOTAL_CARDS * 0.5) - Math.round(TOTAL_CARDS * 0.3) };
    const taken: ExamCard[] = [];
    const take = (pool: ExamCard[], n: number) => { const got = pool.splice(0, n); taken.push(...got); };
    take(lowCards, want.low);
    take(midCards, want.mid);
    take(newCards, want.new);

    // 补够不足的名额：依次从剩余低→中→新→高里取
    const leftover = shuffle([...lowCards, ...midCards, ...newCards, ...highCards]);
    take(leftover, TOTAL_CARDS - taken.length);

    const drawn = shuffle(taken).slice(0, TOTAL_CARDS);

    if (drawn.length === 0) { showToast('没有可用于测试的条目（代码条目需有注释行）'); return; }

    cardsRef.current      = drawn;
    answersRef.current    = new Map();
    codeInputsRef.current = new Map();
    setCards(drawn);
    setAnswers(new Map());
    setCodeInputs(new Map());

    const secs = minutes * 60;
    setTimeLeft(secs);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleSubmit(drawn); return 0; }
        return prev - 1;
      });
    }, 1000);

    setPhase('exam');
  };

  const handleSubmit = async (currentCards?: ExamCard[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const examCards         = currentCards ?? cardsRef.current;
    const currentAnswers    = answersRef.current;
    const currentCodeInputs = codeInputsRef.current;
    setIsGrading(true);
    setPhase('grading');

    const payload: ExamAnswer[] = examCards.map(c => {
      if (c.cardType === 'code' && c.blanks) {
        const inp = currentCodeInputs.get(c.entry.id) ?? [];
        return {
          entryId:    c.entry.id, type: 'code', prompt: '', input: '', expected: '',
          codeBlanks: c.blanks.map(b => b.comment).join(BLANK_SEP),
          codeInputs: c.blanks.map((_, i) => inp[i] ?? '').join(BLANK_SEP),
        };
      }
      const userAnswer = currentAnswers.get(c.entry.id) ?? '';
      const expected   = c.cardType === 'daily' ? c.entry.spoken : c.entry.translation;
      const prompt     = c.cardType === 'daily' ? c.entry.original : (c.entry.translation ?? c.entry.original);
      return { entryId: c.entry.id, type: c.cardType, prompt, input: userAnswer,
               expected: expected ?? '', codeBlanks: '', codeInputs: '' };
    });

    try {
      const result = await scoreExam(payload);
      if (!result?.feedbacks) throw new Error('Invalid response');

      const fbMap = new Map<number, AnswerFeedback>(result.feedbacks.map(f => [f.entryId, f]));

      // Build history items (compact, no full Entry object)
      const items: HistoryItem[] = examCards.map(c => {
        const fb  = fbMap.get(c.entry.id);
        const inp = currentCodeInputs.get(c.entry.id) ?? [];
        if (c.cardType === 'code' && c.blanks) {
          return {
            cardType:   'code',
            prompt:       c.entry.original,
            userInput:    '',
            markedAnswer: '',
            expected:     '',
            score:        fb?.score      ?? 0,
            deduction:    fb?.deduction  ?? 100,
            comment:      fb?.comment    ?? '',
            spoken:       c.entry.spoken,
            blanks:       c.blanks,
            codeInputs:   c.blanks.map((_, i) => inp[i] ?? ''),
          };
        }
        const prompt   = c.cardType === 'daily' ? c.entry.original : (c.entry.translation ?? c.entry.original);
        const expected = c.cardType === 'daily' ? c.entry.spoken   : c.entry.original;
        return {
          cardType:     c.cardType,
          prompt,
          userInput:    currentAnswers.get(c.entry.id) ?? '',
          markedAnswer: fb?.markedAnswer ?? '',
          expected,
          score:        fb?.score     ?? 0,
          deduction:    fb?.deduction ?? 100,
          comment:      fb?.comment   ?? '',
        };
      });

      setResultItems(items);
      setTotalScore(result.totalScore);

      // 根据得分更新笔记本卡片颜色 + 记录分数
      await Promise.allSettled([
        ...examCards.map(c => {
          const fb    = fbMap.get(c.entry.id);
          const color = scoreToColor(fb?.score ?? 0);
          return updateColor(c.entry.id, color);
        }),
        saveEntryScores(examCards.map(c => ({
          entryId: c.entry.id,
          score:   fbMap.get(c.entry.id)?.score ?? 0,
        }))),
      ]);

      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      await saveExamHistory({
        date:        new Date().toLocaleString('zh-CN'),
        totalScore:  result.totalScore,
        cardCount:   examCards.length,
        durationSec: elapsed,
        itemsJson:   JSON.stringify(items),
      });
      // 重新拉取历史列表
      getExamHistory().then(setHistory).catch(() => {});
      setPhase('result');
    } catch (e: any) {
      showToast('评分失败：' + (e.response?.data?.error ?? e.message));
      setPhase('exam');
    } finally {
      setIsGrading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const setCodeInput = (entryId: number, blankIdx: number, val: string) => {
    setCodeInputs(prev => {
      const next = new Map(prev);
      const arr  = [...(next.get(entryId) ?? [])];
      arr[blankIdx] = val;
      next.set(entryId, arr);
      codeInputsRef.current = next;
      return next;
    });
  };

  const setAnswer = (entryId: number, val: string) => {
    setAnswers(prev => {
      const next = new Map(prev).set(entryId, val);
      answersRef.current = next;
      return next;
    });
  };

  // ── Review phase ─────────────────────────────────────────────────────────
  if (phase === 'review' && reviewRecord !== null) {
    let items: HistoryItem[] = [];
    try { items = JSON.parse(reviewRecord.itemsJson) as HistoryItem[]; } catch { items = []; }
    return (
      <div className="test-wrap test-result-wrap">
        <div className="test-result-header">
          <div className="test-result-score">{reviewRecord.totalScore} 分</div>
          <div className="test-result-sub">{reviewRecord.date} · {reviewRecord.cardCount} 题 · {Math.round(reviewRecord.durationSec / 60)} 分钟</div>
          <button className="btn btn-secondary" onClick={() => { setReviewRecord(null); setPhase('setup'); }}>← 返回</button>
        </div>
        <ResultList items={items} />
      </div>
    );
  }

  // ── Setup phase ──────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="test-wrap">
        <div className="test-setup-card">
          <h2 className="test-title">英语测试</h2>
          <div className="test-setup-row">
            <label className="test-label">考试时长（分钟）</label>
            <input
              type="number" className="test-time-input" min={1} max={120} value={minutes}
              onChange={e => setMinutes(Math.max(1, parseInt(e.target.value) || 20))}
            />
          </div>
          <p className="test-desc">随机抽取 {TOTAL_CARDS} 道题，包含英语练习、中英天天练和代码解析三类。</p>
          <button className="btn btn-primary test-start-btn" onClick={handleStart}>开始考试</button>

          {(historyLoading || history.length > 0) && (
            <div className="test-history">
              <div className="test-history-title">历史记录</div>
              {historyLoading && <div className="empty-tip" style={{ margin: '12px 0' }}>加载中…</div>}
              {history.map(h => (
                <div key={h.id} className="test-history-item">
                  <span className="test-history-date">{h.date}</span>
                  <span className="test-history-score">{h.totalScore} 分</span>
                  <span className="test-history-meta">{h.cardCount} 题 · {Math.round(h.durationSec / 60)} 分钟</span>
                  <button className="btn-review" onClick={() => { setReviewRecord(h); setPhase('review'); }}>
                    查看试卷
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Grading phase ────────────────────────────────────────────────────────
  if (phase === 'grading') {
    return (
      <div className="test-wrap">
        <div className="test-grading">
          <div className="spinner" />
          <span>AI 正在评分，请稍候…</span>
        </div>
      </div>
    );
  }

  // ── Result phase ─────────────────────────────────────────────────────────
  if (phase === 'result') {
    return (
      <div className="test-wrap test-result-wrap">
        <div className="test-result-header">
          <div className="test-result-score">{totalScore} 分</div>
          <div className="test-result-sub">共 {cards.length} 题平均分</div>
          <button className="btn btn-secondary" onClick={() => setPhase('setup')}>返回设置</button>
        </div>
        <ResultList items={resultItems} />
      </div>
    );
  }

  // ── Exam phase ───────────────────────────────────────────────────────────
  const urgent = timeLeft <= 60;
  return (
    <div className="test-wrap test-exam-wrap">
      <div className="exam-topbar">
        <span className={`exam-timer${urgent ? ' exam-timer--urgent' : ''}`}>{formatTime(timeLeft)}</span>
        <span className="exam-progress">{cards.length} 题</span>
        <button className="btn btn-primary exam-submit-btn" disabled={isGrading} onClick={() => handleSubmit()}>
          交卷
        </button>
      </div>

      <div className="exam-card-list">
        {cards.map((c, i) => {
          const inp = codeInputs.get(c.entry.id) ?? [];
          return (
            <div key={c.entry.id} className="exam-card">
              <div className="exam-card-header">
                <span className="exam-card-index">#{i + 1}</span>
                <span className={`result-item-badge badge-${c.cardType}`}>
                  {c.cardType === 'english' ? '英语' : c.cardType === 'daily' ? '天天练' : '代码'}
                </span>
              </div>

              {c.cardType === 'english' && (
                <>
                  <div className="exam-prompt">{c.entry.translation}</div>
                  <textarea className="exam-textarea" rows={3} placeholder="用英文回答..."
                    value={answers.get(c.entry.id) ?? ''} onChange={e => setAnswer(c.entry.id, e.target.value)} />
                </>
              )}
              {c.cardType === 'daily' && (
                <>
                  <div className="exam-prompt">{c.entry.original}</div>
                  <textarea className="exam-textarea" rows={3} placeholder="用英文表达..."
                    value={answers.get(c.entry.id) ?? ''} onChange={e => setAnswer(c.entry.id, e.target.value)} />
                </>
              )}
              {c.cardType === 'code' && c.blanks && renderCodeWithBlanks(
                c.entry.spoken, c.blanks, inp, (idx, val) => setCodeInput(c.entry.id, idx, val), false,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
