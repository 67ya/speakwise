import { useState, useEffect, useCallback } from 'react';
import PracticeView from './components/PracticeView';
import NotebookView from './components/NotebookView';
import DailyView from './components/DailyView';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { getCategories } from './api/categories';
import type { Category } from './types';

type View = 'practice' | 'notebook' | 'daily';

export default function App() {
  const [view, setView]             = useState<View>('practice');
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const { toasts, showToast }       = useToast();

  const loadCategories = useCallback(async () => {
    const cats = await getCategories();
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
          >英语天天练</button>
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
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
