import { useState, useEffect, useCallback } from 'react';
import { getEntries, updateColor, updateCategory, deleteEntry } from '../api/entries';
import { getCategories } from '../api/categories';
import CategoryModal from './CategoryModal';
import type { Entry, Category } from '../types';

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
  refreshSignal: number;
  showToast: (msg: string) => void;
}

export default function NotebookView({ refreshSignal, showToast }: Props) {
  const [entries, setEntries]           = useState<Entry[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<number | 'null'>>(new Set());
  const [showModal, setShowModal]       = useState(false);
  // 手机端：是否正在查看详情（true = 详情面板，false = 列表面板）
  const [mobileDetail, setMobileDetail] = useState(false);

  const load = useCallback(async () => {
    const [e, c] = await Promise.all([getEntries(), getCategories()]);
    setEntries(e);
    setCategories(c);
  }, []);

  useEffect(() => { load(); setExpandedCats(new Set()); }, [refreshSignal, load]);

  const selected = entries.find(e => e.id === selectedId) ?? null;

  const selectEntry = (id: number) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const backToList = () => {
    setMobileDetail(false);
  };

  const toggleCat = (key: number | 'null') => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const groups = new Map<number | 'null', Entry[]>();
  entries.forEach(e => {
    const key = e.categoryId ?? 'null';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });

  const handleColorChange = async (color: string | null) => {
    if (!selectedId) return;
    const updated = await updateColor(selectedId, color);
    setEntries(prev => prev.map(e => e.id === selectedId ? updated : e));
  };

  const handleCategoryChange = async (catId: number | null) => {
    if (!selectedId) return;
    const updated = await updateCategory(selectedId, catId);
    setEntries(prev => prev.map(e => e.id === selectedId ? updated : e));
  };

  const handleDelete = async () => {
    if (!selectedId || !confirm('确定删除这条记录？')) return;
    await deleteEntry(selectedId);
    setSelectedId(null);
    setMobileDetail(false);
    load();
  };

  const renderBlock = (text: string) =>
    text.split('\n').filter(l => l.trim()).map((l, i) => <p key={i}>{l}</p>);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtDate = (ts: string) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const renderEntryItem = (entry: Entry, i: number) => {
    const words = entry.original.split(' ').slice(0, 5).join(' ');
    const preview = entry.original.split(' ').length > 5 ? words + '…' : words;
    const colorInfo = PRIORITY_COLORS.find(c => c.value === entry.color);
    return (
      <div
        key={entry.id}
        className={`entry-item${entry.id === selectedId ? ' selected' : ''}`}
        style={entry.color ? { backgroundColor: entry.color, color: colorInfo?.text } : {}}
        onClick={() => selectEntry(entry.id)}
      >
        <span className="entry-index">{i + 1}</span>
        <div className="entry-info">
          <div className="entry-preview">{preview}</div>
          <div className="entry-date">{fmtDate(entry.timestamp)}</div>
        </div>
      </div>
    );
  };

  const detailPanel = (
    <div className="nb-detail">
      {!selected ? (
        <div className="detail-ph">← 选择左侧条目查看详情</div>
      ) : (
        <div>
          {/* 手机端返回按钮 */}
          <button className="btn-back" onClick={backToList}>← 返回列表</button>

          {selected.question && (
            <div className="detail-section question-section">
              <div className="section-label">问题</div>
              <p>{selected.question}</p>
            </div>
          )}
          <div className="detail-section">
            <div className="section-label">原句</div>
            <p>{selected.original}</p>
          </div>
          {selected.spoken && (
            <div className="detail-section">
              <div className="section-label">口语版本</div>
              <p>{selected.spoken}</p>
            </div>
          )}
          <div className="detail-section">
            <div className="section-label">中文翻译</div>
            <p>{selected.translation}</p>
          </div>
          <div className="detail-section">
            <div className="section-label">词汇解析</div>
            <div className="analysis-block">{renderBlock(selected.analysis)}</div>
          </div>
          <div className="detail-section corrections-section">
            <div className="section-label">修改建议</div>
            <div className="analysis-block">{renderBlock(selected.corrections || '—')}</div>
          </div>
          <div className="detail-section">
            <div className="section-label">所属分类</div>
            <select
              className="category-select-inline"
              value={selected.categoryId ?? ''}
              onChange={e => handleCategoryChange(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">— 未分类 —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="color-picker-row">
            <span className="color-label">优先级标记：</span>
            <div id="color-btns">
              {PRIORITY_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`color-dot${selected.color === c.value ? ' active-color' : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onClick={() => handleColorChange(c.value)}
                />
              ))}
            </div>
            <button className="color-clear-btn" onClick={() => handleColorChange(null)}>✕</button>
          </div>

          <button className="btn btn-danger" onClick={handleDelete}>删除此条目</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="notebook-wrap">
      {/* 左侧列表 */}
      <div className={`nb-list${mobileDetail ? ' nb-list--hidden' : ''}`}>
        <div className="nb-list-header">
          <span>我的笔记</span>
          <button className="btn-manage" onClick={() => setShowModal(true)}>管理分类</button>
        </div>

        <div id="entries-list">
          {entries.length === 0 && <div className="empty-tip">还没有保存的句子</div>}

          {categories.map(cat => {
            const catEntries = groups.get(cat.id);
            if (!catEntries) return null;
            const isOpen = expandedCats.has(cat.id);
            return (
              <div key={cat.id}>
                <div className="cat-header" onClick={() => toggleCat(cat.id)}>
                  <span className="cat-chevron">{isOpen ? '▼' : '▶'}</span>
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-count">{catEntries.length}</span>
                </div>
                {isOpen && catEntries.map((entry, i) => renderEntryItem(entry, i))}
              </div>
            );
          })}

          {(() => {
            const uncat = groups.get('null');
            if (!uncat) return null;
            const isOpen = expandedCats.has('null');
            return (
              <div>
                <div className="cat-header" onClick={() => toggleCat('null')}>
                  <span className="cat-chevron">{isOpen ? '▼' : '▶'}</span>
                  <span className="cat-name">未分类</span>
                  <span className="cat-count">{uncat.length}</span>
                </div>
                {isOpen && uncat.map((entry, i) => renderEntryItem(entry, i))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className={`nb-detail-wrap${mobileDetail ? ' nb-detail-wrap--visible' : ''}`}>
        {detailPanel}
      </div>

      {showModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onChanged={load}
          showToast={showToast}
        />
      )}
    </div>
  );
}
