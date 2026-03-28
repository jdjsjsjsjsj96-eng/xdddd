const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// POST /api/redeem — user submits a key + their hwid
app.post('/api/redeem', (req, res) => {
  const { key, hwid } = req.body;
  if (!key || !hwid) return res.status(400).json({ error: 'Key and HWID required.' });

  const db = readDB();
  const entry = db.keys.find(k => k.key === key.trim());

  if (!entry) return res.status(400).json({ error: 'Invalid key.' });
  if (entry.used && entry.hwid !== hwid) return res.status(403).json({ error: 'Key already redeemed on another PC.' });

  // First time — bind to this hwid
  if (!entry.used) {
    entry.used = true;
    entry.hwid = hwid;
    entry.redeemedAt = new Date().toISOString();
    writeDB(db);
  }

  // Issue a session token stored in cookie
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = db.sessions || {};
  db.sessions[token] = { key, hwid, createdAt: Date.now() };
  writeDB(db);

  res.cookie('vanta_session', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, key: entry.key, hwid: entry.hwid });
});

// GET /api/me — check existing session
app.get('/api/me', (req, res) => {
  const token = req.cookies.vanta_session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const db = readDB();
  const session = (db.sessions || {})[token];
  if (!session) return res.status(401).json({ error: 'Session expired' });

  const entry = db.keys.find(k => k.key === session.key);
  if (!entry) return res.status(401).json({ error: 'Key not found' });

  res.json({ key: entry.key, hwid: entry.hwid });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  const token = req.cookies.vanta_session;
  if (token) {
    const db = readDB();
    if (db.sessions) delete db.sessions[token];
    writeDB(db);
  }
  res.clearCookie('vanta_session');
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Vanta.cc running at http://localhost:${PORT}`);
  // Print keys on startup so owner can see them
  const db = readDB();
  console.log('\n── Vanta Keys ──');
  db.keys.forEach(k => console.log(`  ${k.key}  [${k.used ? 'USED - ' + k.hwid : 'available'}]`));
  console.log('────────────────\n');
});
