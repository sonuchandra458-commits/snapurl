const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
require('dotenv').config();

const app       = express();
const PORT      = process.env.PORT      || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/snapurl';
const BASE_URL  = process.env.BASE_URL  || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅  MongoDB connected →', MONGO_URI))
  .catch(err => {
    console.error('❌  MongoDB FAILED:', err.message);
    console.error('👉  Start MongoDB: mongod --dbpath ~/data/db');
    process.exit(1);
  });

const urlSchema = new mongoose.Schema({
  shortCode:   { type: String, required: true, unique: true },
  originalUrl: { type: String, required: true },
  sessionId:   { type: String, required: true },
  alias:       { type: String, default: '' },
  clicks:      { type: Number, default: 0 },
  expiresAt:   { type: Date,   default: null },
  createdAt:   { type: Date,   default: Date.now }
});

urlSchema.index({ shortCode: 1 });
urlSchema.index({ sessionId: 1 });

const Url = mongoose.model('Url', urlSchema);

function makeCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/shorten', async (req, res) => {
  try {
    const { url, sessionId, alias, expiresIn } = req.body;

    if (!url || !url.trim())
      return res.status(400).json({ error: 'URL is required' });
    if (!sessionId)
      return res.status(400).json({ error: 'sessionId is required' });

    let parsedUrl;
    try { parsedUrl = new URL(url.trim()); }
    catch { return res.status(400).json({ error: 'Invalid URL — must start with http:// or https://' }); }

    let shortCode;
    if (alias && alias.trim()) {
      shortCode = alias.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 20);
      if (!shortCode) return res.status(400).json({ error: 'Invalid alias characters' });
      const exists = await Url.findOne({ shortCode });
      if (exists) return res.status(409).json({ error: 'Alias already taken — try another' });
    } else {
      let attempts = 0;
      do {
        shortCode = makeCode(6);
        if (++attempts > 10) return res.status(500).json({ error: 'Could not generate code, retry' });
      } while (await Url.findOne({ shortCode }));
    }

    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
      const days = parseInt(expiresIn);
      if (!isNaN(days) && days > 0)
        expiresAt = new Date(Date.now() + days * 86400000);
    }

    const doc = await Url.create({
      shortCode,
      originalUrl: parsedUrl.href,
      sessionId,
      alias: alias ? alias.trim() : '',
      expiresAt
    });

    return res.status(201).json({
      shortCode:   doc.shortCode,
      shortUrl:    `${BASE_URL}/${doc.shortCode}`,
      originalUrl: doc.originalUrl,
      alias:       doc.alias,
      createdAt:   doc.createdAt,
      expiresAt:   doc.expiresAt
    });

  } catch (err) {
    console.error('POST /api/shorten error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: 'session param required' });

    const urls = await Url.find({ sessionId: session }).sort({ createdAt: -1 });
    return res.json(urls.map(u => ({
      _id:         u._id,
      shortCode:   u.shortCode,
      shortUrl:    `${BASE_URL}/${u.shortCode}`,
      originalUrl: u.originalUrl,
      alias:       u.alias,
      clicks:      u.clicks,
      createdAt:   u.createdAt,
      expiresAt:   u.expiresAt
    })));
  } catch (err) {
    console.error('GET /api/history error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.delete('/api/url/:id', async (req, res) => {
  try {
    const { id }      = req.params;
    const { session } = req.query;
    await Url.findOneAndDelete({ _id: id, sessionId: session });
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/url error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (['favicon.ico', 'robots.txt', 'sitemap.xml'].includes(code))
      return res.status(404).end();

    const url = await Url.findOne({ shortCode: code });

    if (!url) return res.redirect('/');

    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(410).send(`
        <!DOCTYPE html><html><head><title>Expired</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:4rem;background:#f2f5ff">
          <h2 style="color:#dc2626">🔗 Link Expired</h2>
          <p style="color:#505880;margin:12px 0">This short link is no longer active.</p>
          <a href="/" style="color:#4361ee;font-weight:700;text-decoration:none">← Create a new link</a>
        </body></html>
      `);
    }

    Url.findByIdAndUpdate(url._id, { $inc: { clicks: 1 } }).exec();

    return res.redirect(url.originalUrl);

  } catch (err) {
    console.error('GET /:code error:', err);
    return res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀  SnapURL →  http://localhost:${PORT}`);
  console.log(`📦  MongoDB →  ${MONGO_URI}\n`);
});