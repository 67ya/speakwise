const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'entries.json');
const CATS_FILE = path.join(__dirname, 'data', 'categories.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
if (!fs.existsSync(CATS_FILE)) fs.writeFileSync(CATS_FILE, '[]');

const config = require('./config');
app.get('/api/config', (req, res) => {
  res.json({ baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey });
});

// ── Entries
app.get('/api/entries', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
});

app.post('/api/entries', (req, res) => {
  const entries = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const entry = { id: Date.now(), ...req.body, timestamp: new Date().toISOString(), color: null };
  entries.unshift(entry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  res.json(entry);
});

app.put('/api/entries/:id', (req, res) => {
  const entries = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const idx = entries.findIndex(e => e.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  entries[idx] = { ...entries[idx], ...req.body };
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  res.json(entries[idx]);
});

app.delete('/api/entries/:id', (req, res) => {
  let entries = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  entries = entries.filter(e => e.id !== parseInt(req.params.id));
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  res.json({ ok: true });
});

// ── Categories
app.get('/api/categories', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(CATS_FILE, 'utf-8')));
});

app.post('/api/categories', (req, res) => {
  const cats = JSON.parse(fs.readFileSync(CATS_FILE, 'utf-8'));
  const cat = { id: Date.now(), name: req.body.name };
  cats.push(cat);
  fs.writeFileSync(CATS_FILE, JSON.stringify(cats, null, 2));
  res.json(cat);
});

app.put('/api/categories/:id', (req, res) => {
  const cats = JSON.parse(fs.readFileSync(CATS_FILE, 'utf-8'));
  const idx = cats.findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  cats[idx].name = req.body.name;
  fs.writeFileSync(CATS_FILE, JSON.stringify(cats, null, 2));
  res.json(cats[idx]);
});

app.delete('/api/categories/:id', (req, res) => {
  const catId = parseInt(req.params.id);
  const entries = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const count = entries.filter(e => e.categoryId === catId).length;
  if (count > 0) {
    return res.status(400).json({ error: `该分类下还有 ${count} 条记录，请先删除后再删除分类` });
  }
  let cats = JSON.parse(fs.readFileSync(CATS_FILE, 'utf-8'));
  cats = cats.filter(c => c.id !== catId);
  fs.writeFileSync(CATS_FILE, JSON.stringify(cats, null, 2));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ 服务已启动：http://localhost:${PORT}`);
});
