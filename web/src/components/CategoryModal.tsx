import { useState } from 'react';
import { createCategory, updateCategory, deleteCategory } from '../api/categories';
import type { Category } from '../types';

interface Props {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
  showToast: (msg: string) => void;
}

export default function CategoryModal({ categories, onClose, onChanged, showToast }: Props) {
  const [newName, setNewName]       = useState('');
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCategory(newName.trim());
    setNewName('');
    onChanged();
  };

  const handleDelete = async (cat: Category) => {
    try {
      await deleteCategory(cat.id);
      onChanged();
    } catch (e: any) {
      showToast(e.response?.data?.error ?? e.message);
    }
  };

  const handleRename = async (id: number) => {
    if (!editingName.trim()) return;
    await updateCategory(id, editingName.trim());
    setEditingId(null);
    onChanged();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <span>管理分类</span>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cat-list">
          {categories.length === 0 && <div className="cat-empty">暂无分类，请添加</div>}
          {categories.map(cat => (
            <div key={cat.id} className="cat-row">
              {editingId === cat.id ? (
                <input
                  className="cat-row-input"
                  value={editingName}
                  autoFocus
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditingId(null); }}
                />
              ) : (
                <span className="cat-row-name">{cat.name}</span>
              )}
              <div className="cat-row-btns">
                {editingId === cat.id ? (
                  <>
                    <button className="btn-cat-act btn-confirm" onClick={() => handleRename(cat.id)}>确定</button>
                    <button className="btn-cat-act btn-cancel-rename" onClick={() => setEditingId(null)}>取消</button>
                  </>
                ) : (
                  <>
                    <button className="btn-cat-act btn-rename" onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}>重命名</button>
                    <button className="btn-cat-act btn-del-cat" onClick={() => handleDelete(cat)}>删除</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="cat-add-row">
          <input
            className="cat-input"
            placeholder="输入新分类名称..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>添加</button>
        </div>
      </div>
    </div>
  );
}
