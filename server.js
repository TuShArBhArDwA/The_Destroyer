require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
/** Set in .env — see https://console.groq.com/docs/models */
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy: Top Headlines
app.get('/api/news/headlines', async (req, res) => {
  try {
    const { category = 'general', pageSize = 12, page = 1 } = req.query;
    const url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=${pageSize}&page=${page}&apiKey=${NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('NewsAPI error:', err);
    res.status(500).json({ error: 'Failed to fetch headlines' });
  }
});

// Proxy: Search / Everything
app.get('/api/news/search', async (req, res) => {
  try {
    const { q, pageSize = 12, page = 1, sortBy = 'publishedAt' } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&pageSize=${pageSize}&page=${page}&sortBy=${sortBy}&language=en&apiKey=${NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('NewsAPI search error:', err);
    res.status(500).json({ error: 'Failed to search news' });
  }
});

// Proxy: Groq AI (keeps API key server-side, never exposed to browser)
app.post('/api/groq', async (req, res) => {
  try {
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'Groq API key not configured' });
    const payload = { ...req.body, model: GROQ_MODEL };
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // If streaming, pipe the response through
    if (payload.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (err) {
    console.error('Groq proxy error:', err);
    res.status(500).json({ error: 'Failed to reach AI service' });
  }
});

// Public config (no secrets)
app.get('/api/config', (req, res) => {
  res.json({ groqModel: GROQ_MODEL });
});

// Fallback: serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🗞️  THE DESTROYER is running at http://localhost:${PORT}`);
  console.log(`   Groq model: ${GROQ_MODEL}\n`);
});

module.exports = app;
