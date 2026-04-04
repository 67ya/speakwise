import { useState, useEffect, useCallback } from 'react';
import PracticeView from './components/PracticeView';
import NotebookView from './components/NotebookView';
import DailyView from './components/DailyView';
import CodeView from './components/CodeView';
import CardView from './components/CardView';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { getCategories, createCategory } from './api/categories';
import type { Category } from './types';

type View = 'practice' | 'notebook' | 'daily' | 'code' | 'card';

const DAILY_CATEGORY_NAME = '中英天天练';
const CODE_CATEGORY_NAME  = '代码解析';

async function ensureCategory(cats: Category[], name: string): Promise<{ id: number; cats: Category[] }> {
  const existing = cats.find(c => c.name === name);
  if (existing) return { id: existing.id, cats };
  const created = await createCategory(name);
  return { id: created.id, cats: [...cats, created] };
}

export default function App() {
  const [view, setView]             = useState<View>('practice');
  const [categories, setCategories] = useState<Category[]>([]);
  const [dailyCategoryId, setDailyCategoryId] = useState<number | null>(null);
  const [codeCategoryId, setCodeCategoryId]   = useState<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const { toasts, showToast }       = useToast();

  const loadCategories = useCallback(async () => {
    let cats = await getCategories();
    const dailyResult = await ensureCategory(cats, DAILY_CATEGORY_NAME);
    cats = dailyResult.cats;
    setDailyCategoryId(dailyResult.id);

    const codeResult = await ensureCategory(cats, CODE_CATEGORY_NAME);
    cats = codeResult.cats;
    setCodeCategoryId(codeResult.id);

    setCategories(cats);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleSaved = () => {
    setRefreshSignal(s => s + 1);
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">英语练习</div>
        <div className="nav-tabs">
          <button
            className={`nav-tab${view === 'practice' ? ' active' : ''}`}
            onClick={() => setView('practice')}
          >练习</button>
          <button
            className={`nav-tab${view === 'notebook' ? ' active' : ''}`}
            onClick={() => { setView('notebook'); setRefreshSignal(s => s + 1); }}
          >笔记本</button>
          <button
            className={`nav-tab${view === 'daily' ? ' active' : ''}`}
            onClick={() => setView('daily')}
          >中英天天练</button>
          <button
            className={`nav-tab${view === 'code' ? ' active' : ''}`}
            onClick={() => setView('code')}
          >代码解析</button>
          <button
            className={`nav-tab${view === 'card' ? ' active' : ''}`}
            onClick={() => setView('card')}
          >卡牌</button>
        </div>
      </nav>

      {view === 'practice' && (
        <PracticeView
          categories={categories}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}
      {view === 'notebook' && (
        <NotebookView
          refreshSignal={refreshSignal}
          showToast={showToast}
        />
      )}
      {view === 'daily' && (
        <DailyView
          categories={categories}
          defaultCategoryId={dailyCategoryId}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}
      {view === 'code' && (
        <CodeView
          categories={categories}
          defaultCategoryId={codeCategoryId}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}

      {view === 'card' && (
        <CardView
          categories={categories}
          showToast={showToast}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
