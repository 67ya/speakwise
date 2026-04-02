// ── 后端地址
const API = 'http://127.0.0.1:8090';

// ── 7 优先级颜色
const PRIORITY_COLORS = [
  { label: 'P1 最低', value: '#E0E0E0', text: '#555' },
  { label: 'P2',      value: '#FFF59D', text: '#5D4037' },
  { label: 'P3',      value: '#C8E6C9', text: '#1B5E20' },
  { label: 'P4',      value: '#B3E5FC', text: '#01579B' },
  { label: 'P5',      value: '#FFE0B2', text: '#E65100' },
  { label: 'P6',      value: '#F8BBD9', text: '#880E4F' },
  { label: 'P7 最高', value: '#9FA8DA', text: '#1A237E' },
];

// ── State
let currentResult = null;
let selectedId    = null;
let categories    = [];
let expandedCats  = new Set();

// ── DOM
const $ = id => document.getElementById(id);
const navTabs         = document.querySelectorAll('.nav-tab');
const viewPractice    = $('view-practice');
const viewNotebook    = $('view-notebook');
const inputQuestion   = $('input-question');
const inputSentence   = $('input-sentence');
const btnQuick        = $('btn-quick');
const btnFull         = $('btn-full');
const loadingEl       = $('loading');
const resultCard      = $('result');
const resQuestionSec  = $('res-question-section');
const resQuestion     = $('res-question');
const resOriginal     = $('res-original');
const resSpokenSec    = $('res-spoken-section');
const resSpoken       = $('res-spoken');
const resTranslation  = $('res-translation');
const resAnalysis     = $('res-analysis');
const resCorrections  = $('res-corrections');
const selectCategory  = $('select-category');
const btnSave         = $('btn-save');
const btnCancel       = $('btn-cancel');
const entriesList     = $('entries-list');
const emptyTip        = $('empty-tip');
const detailPh        = $('detail-placeholder');
const detailContent   = $('detail-content');
const dQuestionSec    = $('d-question-section');
const dQuestion       = $('d-question');
const dOriginal       = $('d-original');
const dSpokenSec      = $('d-spoken-section');
const dSpoken         = $('d-spoken');
const dTranslation    = $('d-translation');
const dAnalysis       = $('d-analysis');
const dCorrections    = $('d-corrections');
const dCategorySelect = $('d-category-select');
const colorBtns       = $('color-btns');
const btnClearColor   = $('btn-clear-color');
const btnDelete       = $('btn-delete');
const btnManageCats   = $('btn-manage-cats');
const modalCats       = $('modal-cats');
const modalClose      = $('modal-close');
const catList         = $('cat-list');
const inputNewCat     = $('input-new-cat');
const btnAddCat       = $('btn-add-cat');

// ── 初始化
(async () => {
  categories = await apiFetch('/api/categories');
  buildColorButtons();
})();

// ── API 封装
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── 导航
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const v = tab.dataset.view;
    viewPractice.classList.toggle('hidden', v !== 'practice');
    viewNotebook.classList.toggle('hidden', v !== 'notebook');
    if (v === 'notebook') { expandedCats = new Set(); renderNotebook(); }
  });
});

// ── 构建颜色按钮
function buildColorButtons() {
  colorBtns.innerHTML = '';
  PRIORITY_COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'color-dot';
    btn.style.backgroundColor = c.value;
    btn.title = c.label;
    btn.addEventListener('click', () => setColor(c.value));
    colorBtns.appendChild(btn);
  });
}

// ── 填充分类下拉框
function populateSelect(el, cats, selectedCatId, allowEmpty) {
  el.innerHTML = `<option value="">${allowEmpty ? '— 未分类 —' : '— 请选择分类 —'}</option>` +
    cats.map(c =>
      `<option value="${c.id}" ${c.id === selectedCatId ? 'selected' : ''}>${c.name}</option>`
    ).join('');
}

// ── 提交分析
async function handleSubmit(includeSpoken) {
  const sentence = inputSentence.value.trim();
  if (!sentence) {
    inputSentence.focus();
    inputSentence.style.borderColor = '#E53935';
    setTimeout(() => inputSentence.style.borderColor = '', 2000);
    showToast('请先输入一个英语句子');
    return;
  }

  [btnQuick, btnFull].forEach(b => b.disabled = true);
  loadingEl.classList.remove('hidden');
  resultCard.classList.add('hidden');

  try {
    const r = await apiFetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ sentence, includeSpoken }),
    });

    const question = inputQuestion.value.trim();
    currentResult = { question, original: sentence, ...r };

    resQuestionSec.classList.toggle('hidden', !question);
    resQuestion.textContent = question;
    resOriginal.textContent = sentence;
    resSpokenSec.classList.toggle('hidden', !includeSpoken);
    resSpoken.textContent = r.spoken;
    resTranslation.textContent = r.translation;
    renderAnalysis(r.analysis, resAnalysis);
    renderAnalysis(r.corrections, resCorrections);

    categories = await apiFetch('/api/categories');
    populateSelect(selectCategory, categories, null, false);

    resultCard.classList.remove('hidden');

    if (r.fromCache) showToast('⚡ 已从缓存加载');
  } catch (e) {
    alert('分析失败：' + e.message);
  } finally {
    loadingEl.classList.add('hidden');
    [btnQuick, btnFull].forEach(b => b.disabled = false);
  }
}

btnQuick.addEventListener('click', () => handleSubmit(false));
btnFull.addEventListener('click',  () => handleSubmit(true));

// ── 保存
btnSave.addEventListener('click', async () => {
  if (!currentResult) return;
  const catVal = selectCategory.value;
  if (!catVal) { alert('请先选择分类'); selectCategory.focus(); return; }

  await apiFetch('/api/entries', {
    method: 'POST',
    body: JSON.stringify({ ...currentResult, categoryId: parseInt(catVal) }),
  });
  inputQuestion.value = '';
  inputSentence.value = '';
  resultCard.classList.add('hidden');
  currentResult = null;
  showToast('已保存到笔记本 ✓');
});

btnCancel.addEventListener('click', () => {
  resultCard.classList.add('hidden');
  currentResult = null;
});

// ── 渲染笔记本
async function renderNotebook() {
  const [entries, cats] = await Promise.all([
    apiFetch('/api/entries'),
    apiFetch('/api/categories'),
  ]);
  categories = cats;
  entriesList.innerHTML = '';

  if (entries.length === 0) {
    emptyTip.classList.remove('hidden');
    if (selectedId) hideDetail();
    return;
  }
  emptyTip.classList.add('hidden');

  const groups = {};
  entries.forEach(e => {
    const key = e.categoryId ?? 'null';
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  cats.forEach(cat => { if (groups[cat.id]) renderCategoryGroup(cat.id, cat.name, groups[cat.id]); });
  if (groups['null']?.length) renderCategoryGroup('null', '未分类', groups['null']);

  if (selectedId) {
    const found = entries.find(e => e.id === selectedId);
    if (found) fillDetail(found); else hideDetail();
  }
}

function renderCategoryGroup(catId, catName, catEntries) {
  const isExpanded = expandedCats.has(catId);
  const header = document.createElement('div');
  header.className = 'cat-header';
  header.innerHTML = `
    <span class="cat-chevron">${isExpanded ? '▼' : '▶'}</span>
    <span class="cat-name">${catName}</span>
    <span class="cat-count">${catEntries.length}</span>`;
  header.addEventListener('click', () => {
    if (expandedCats.has(catId)) expandedCats.delete(catId); else expandedCats.add(catId);
    renderNotebook();
  });
  entriesList.appendChild(header);
  if (!isExpanded) return;

  catEntries.forEach((entry, i) => {
    const words = entry.original.split(' ').slice(0, 5).join(' ');
    const preview = entry.original.split(' ').length > 5 ? words + '…' : words;
    const dt = new Date(entry.timestamp);
    const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

    const item = document.createElement('div');
    item.className = 'entry-item' + (entry.id === selectedId ? ' selected' : '');
    if (entry.color) {
      item.style.backgroundColor = entry.color;
      const c = PRIORITY_COLORS.find(x => x.value === entry.color);
      if (c) item.style.color = c.text;
    }
    item.innerHTML = `
      <span class="entry-index">${i + 1}</span>
      <div class="entry-info">
        <div class="entry-preview">${preview}</div>
        <div class="entry-date">${dateStr}</div>
      </div>`;
    item.addEventListener('click', () => selectEntry(entry));
    entriesList.appendChild(item);
  });
}

function selectEntry(entry) {
  selectedId = entry.id;
  fillDetail(entry);
  renderNotebook();
}

function fillDetail(entry) {
  detailPh.classList.add('hidden');
  detailContent.classList.remove('hidden');
  dQuestionSec.classList.toggle('hidden', !entry.question);
  dQuestion.textContent = entry.question || '';
  dOriginal.textContent = entry.original;
  dSpokenSec.classList.toggle('hidden', !entry.spoken);
  dSpoken.textContent = entry.spoken || '';
  dTranslation.textContent = entry.translation;
  renderAnalysis(entry.analysis, dAnalysis);
  renderAnalysis(entry.corrections || '—', dCorrections);
  populateSelect(dCategorySelect, categories, entry.categoryId, true);
  colorBtns.querySelectorAll('.color-dot').forEach((btn, i) => {
    btn.classList.toggle('active-color', PRIORITY_COLORS[i].value === entry.color);
  });
}

// 详情页改分类
dCategorySelect.addEventListener('change', async () => {
  if (!selectedId) return;
  const val = dCategorySelect.value ? parseInt(dCategorySelect.value) : null;
  await apiFetch(`/api/entries/${selectedId}/category`, {
    method: 'PATCH',
    body: JSON.stringify({ value: val }),
  });
  await renderNotebook();
});

function hideDetail() {
  selectedId = null;
  detailPh.classList.remove('hidden');
  detailContent.classList.add('hidden');
}

// ── 颜色
async function setColor(colorValue) {
  if (!selectedId) return;
  await apiFetch(`/api/entries/${selectedId}/color`, {
    method: 'PATCH',
    body: JSON.stringify({ value: colorValue }),
  });
  renderNotebook();
}
btnClearColor.addEventListener('click', () => setColor(null));

// ── 删除条目
btnDelete.addEventListener('click', async () => {
  if (!selectedId || !confirm('确定删除这条记录？')) return;
  await apiFetch(`/api/entries/${selectedId}`, { method: 'DELETE' });
  hideDetail();
  renderNotebook();
});

// ── 分类管理弹窗
btnManageCats.addEventListener('click', openCatModal);
modalClose.addEventListener('click', () => modalCats.classList.add('hidden'));
modalCats.addEventListener('click', e => { if (e.target === modalCats) modalCats.classList.add('hidden'); });

async function openCatModal() {
  categories = await apiFetch('/api/categories');
  renderCatModal();
  modalCats.classList.remove('hidden');
  inputNewCat.value = '';
}

function renderCatModal() {
  catList.innerHTML = '';
  if (categories.length === 0) {
    catList.innerHTML = '<div class="cat-empty">暂无分类，请添加</div>';
    return;
  }
  categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-row-name">${cat.name}</span>
      <div class="cat-row-btns">
        <button class="btn-cat-act btn-rename">重命名</button>
        <button class="btn-cat-act btn-del-cat">删除</button>
      </div>`;
    row.querySelector('.btn-rename').addEventListener('click', () => startRename(row, cat));
    row.querySelector('.btn-del-cat').addEventListener('click', () => deleteCategory(cat.id));
    catList.appendChild(row);
  });
}

function startRename(row, cat) {
  const nameEl = row.querySelector('.cat-row-name');
  const btnsEl = row.querySelector('.cat-row-btns');
  const input = document.createElement('input');
  input.className = 'cat-row-input';
  input.value = cat.name;
  nameEl.replaceWith(input);
  input.focus(); input.select();
  btnsEl.innerHTML = `
    <button class="btn-cat-act btn-confirm">确定</button>
    <button class="btn-cat-act btn-cancel-rename">取消</button>`;
  const save = async () => {
    const newName = input.value.trim();
    if (!newName) return;
    if (newName !== cat.name) {
      await apiFetch(`/api/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      categories = await apiFetch('/api/categories');
    }
    renderCatModal();
  };
  btnsEl.querySelector('.btn-confirm').addEventListener('click', save);
  btnsEl.querySelector('.btn-cancel-rename').addEventListener('click', renderCatModal);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderCatModal(); });
}

async function deleteCategory(id) {
  try {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
  } catch (e) {
    alert(e.message);
    return;
  }
  categories = await apiFetch('/api/categories');
  renderCatModal();
  renderNotebook();
}

btnAddCat.addEventListener('click', addCategory);
inputNewCat.addEventListener('keydown', e => { if (e.key === 'Enter') addCategory(); });

async function addCategory() {
  const name = inputNewCat.value.trim();
  if (!name) return;
  await apiFetch('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  categories = await apiFetch('/api/categories');
  inputNewCat.value = '';
  renderCatModal();
}

// ── 渲染解析块
function renderAnalysis(text, el) {
  el.innerHTML = (text || '').split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
}

// ── 工具函数
function pad(n) { return String(n).padStart(2, '0'); }

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
    background: '#323232', color: '#fff', padding: '10px 22px',
    borderRadius: '8px', fontSize: '14px', zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0,0,0,.3)', transition: 'opacity .3s',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2000);
}
