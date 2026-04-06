/* pipeline.js — AI Editorial Pipeline for The Destroyer */

// Groq calls are proxied through /api/groq on our Express server so API keys stay server-side.
// Actual model is chosen on the server (GROQ_MODEL in .env); this matches the server default for local tooling only.
const GROQ_ENDPOINT_PROXY = '/api/groq';
const GROQ_MODEL = 'llama-3.1-8b-instant';
/** Long-form article JSON needs headroom (body + escapes + keyFacts). */
const ARTICLE_MAX_TOKENS = 4096;

const CATEGORY_LABELS = {
  general: 'General', technology: 'Technology', business: 'Business',
  science: 'Science', health: 'Health', entertainment: 'Entertainment', sports: 'Sports'
};

const CATEGORY_EMOJI = {
  general: '📰', technology: '⚡', business: '📈',
  science: '🔬', health: '🩺', entertainment: '🎬', sports: '🏆'
};

const CATEGORY_BG = {
  general: 'bg-general', technology: 'bg-tech', business: 'bg-business',
  science: 'bg-science', health: 'bg-health', entertainment: 'bg-entertainment', sports: 'bg-sports'
};

// ── Bulletproof JSON Parser ──────────────────────────────────────────────────
function parseLLMJson(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn("Standard JSON parse failed, attempting sanitization...", e.message);
    // Escape unescaped control characters inside string literals
    let inString = false;
    let escaped = false;
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '\\') {
            escaped = !escaped;
            result += char;
            continue;
        }
        if (char === '"' && !escaped) {
            inString = !inString;
        }
        if (inString && (char === '\n' || char === '\r' || char === '\t' || char.charCodeAt(0) < 32)) {
            if (char === '\n') result += '\\n';
            else if (char === '\r') result += '\\r';
            else if (char === '\t') result += '\\t';
            // strip other control chars
        } else {
            result += char;
        }
        escaped = false;
    }
    try {
      return JSON.parse(result);
    } catch (e2) {
      console.error("Sanitized JSON parse also failed:", e2.message);
      throw new Error("Invalid output format from editorial engine. Please try another article.");
    }
  }
}

/** Find index of the `}` that closes the first `{` in s (respects strings). Returns -1 if unbalanced / truncated. */
function findMatchingClosingBrace(s) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Extract one JSON object from model text (fenced ```json block, preamble, or raw). */
function extractJsonObjectFromLLMOutput(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  const slice = candidate.slice(start);
  const end = findMatchingClosingBrace(slice);
  if (end === -1) return null;
  return slice.slice(0, end + 1);
}

/** Normal Groq/OpenAI-shaped completion body; throws a clear error if missing or empty. */
function groqCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  const apiErr =
    data?.error?.message ||
    (typeof data?.error === 'string' ? data.error : null);
  if (apiErr) throw new Error(apiErr);
  throw new Error(
    'AI returned no message (empty choices). Check GROQ_API_KEY, model name, and quota.'
  );
}

// ── Core Groq API call (proxied through server) ─────────────────────────────
async function callGroq(messages, maxTokens = 1024, temperature = 0.65) {
  const response = await fetch(GROQ_ENDPOINT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `API error ${response.status}: ${data?.error?.message || data?.message || 'Unknown error'}`
    );
  }

  return groqCompletionText(data);
}

// ── Streaming Groq call (proxied through server) ───────────────────────────
async function* callGroqStream(messages, maxTokens = 2048, temperature = 0.65) {
  const response = await fetch(GROQ_ENDPOINT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true
    })
  });

  if (!response.ok) throw new Error(`Stream error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleSseLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) return false;
    const payload = trimmed.slice(6).trim();
    if (payload === '[DONE]') return true;
    try {
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) return delta;
    } catch { /* skip malformed SSE JSON */ }
    return null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const out = handleSseLine(line);
      if (out === true) return;
      if (typeof out === 'string') yield out;
    }
  }
  const tailOut = handleSseLine(buffer);
  if (tailOut === true) return;
  if (typeof tailOut === 'string') yield tailOut;
}

// ── Fetch headlines from our local proxy ────────────────────────────────────
async function fetchHeadlines(category = 'general', pageSize = 12, page = 1) {
  const url = `/api/news/headlines?category=${category}&pageSize=${pageSize}&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch headlines');
  const data = await response.json();
  if (data.status !== 'ok') throw new Error(data.message || 'API error');
  return (data.articles || []).filter(a =>
    a.title && a.title !== '[Removed]' && a.source?.name !== '[Removed]'
  );
}

// ── Search news ─────────────────────────────────────────────────────────────
async function searchNews(query, pageSize = 9) {
  const url = `/api/news/search?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Search failed');
  const data = await response.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Search error');
  return (data.articles || []).filter(a =>
    a.title && a.title !== '[Removed]'
  );
}

// ── Generate card content ───────────────────────────────────────────────────
async function generateCardContent(article, category = 'general') {
  const cacheKey = `card_${article.url}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const prompt = `You are the autonomous editorial desk of an AI-native newsroom (no human editor in the loop). Based on this wire item, write polished copy a serious reader would trust.

SOURCE HEADLINE: ${article.title}
SOURCE: ${article.source?.name || 'Wire'}
SUMMARY: ${article.description || 'No summary available.'}
PUBLISHED: ${article.publishedAt}

Produce:
1. A sharp, precise headline (improve on original if possible; max 12 words)
2. A single compelling dek sentence capturing the news value (max 25 words)
3. Three key facts from the story (short, concrete, factual)

Return ONLY valid JSON format:
{"headline":"...","dek":"...","keyFacts":["...","...","..."]}`;

  try {
    const raw = await callGroq([
      { role: 'system', content: 'You are an autonomous news desk producing publishable copy. Return JSON only.' },
      { role: 'user', content: prompt }
    ], 512, 0.5);

    const jsonStr = extractJsonObjectFromLLMOutput(raw);
    if (!jsonStr) throw new Error('No JSON found');
    const result = parseLLMJson(jsonStr);
    result.category = category;
    result.originalUrl = article.url;
    result.imageUrl = article.urlToImage || null;
    result.source = article.source?.name || 'The Destroyer';
    result.publishedAt = article.publishedAt;
    sessionStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (err) {
    const fallback = {
      headline: article.title?.replace(/\s*-\s*[^-]+$/, '') || 'Breaking Story',
      dek: article.description || 'Read the full report from The Destroyer.',
      keyFacts: ['Story developing — full article available'],
      category,
      originalUrl: article.url,
      imageUrl: article.urlToImage || null,
      source: article.source?.name || 'Newswire',
      publishedAt: article.publishedAt
    };
    return fallback;
  }
}

// ── Generate full article (long-form, streaming) ─────────────────────────────
async function generateFullArticle(article, cardData, onChunk) {
  const cacheKey = `article_${article.url || cardData.originalUrl}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    if (onChunk) onChunk(data.body, true);
    return data;
  }

  const prompt = `You are the autonomous long-form desk of an AI-native newsroom: your output is published without human editorial review. Write a complete, publishable news article worthy of a top outlet (depth and neutrality like The Atlantic or The Economist), based only on this information:

HEADLINE: ${cardData.headline}
SOURCE: ${cardData.source}
SUMMARY: ${article.description || cardData.dek}
ORIGINAL TITLE: ${article.title}
PUBLISHED: ${article.publishedAt || new Date().toISOString()}

ARTICLE STRUCTURE:
1. News lede (first paragraph): who, what, when, where, why — 2–3 sentences, authoritative.
2. Second paragraph: expand the core development, add context.
3. Third paragraph: background — how did we get here?
4. Fourth paragraph: implications and what this means.
5. Fifth paragraph (closing): broader significance.

REQUIREMENTS:
- Total length: 500-700 words.
- Write in authoritative, neutral voice.
- Paragraph breaks with \\n\\n
- Use standard escapes for quotes, NO unescaped newlines inside the JSON string literal.

Return ONLY a valid JSON object matching this schema exactly:
{
  "headline": "Final headline",
  "dek": "Compelling subtitle",
  "body": "Full article body text with \\n\\n between paragraphs",
  "keyFacts": ["Fact 1", "Fact 2", "Fact 3"]
}`;

  const messages = [
    { role: 'system', content: 'You are an autonomous investigative-style news engine. Reply with a single JSON object only — no markdown, no preamble.' },
    { role: 'user', content: prompt }
  ];

  function parseArticleResponse(fullText) {
    const jsonStr = extractJsonObjectFromLLMOutput(fullText);
    if (!jsonStr) throw new Error('No JSON in response');
    const parsed = parseLLMJson(jsonStr);
    if (!parsed.body || typeof parsed.body !== 'string' || !parsed.body.trim()) {
      throw new Error('Article body missing in model response');
    }
    return parsed;
  }

  try {
    let fullText = '';

    if (onChunk) {
      for await (const chunk of callGroqStream(messages, ARTICLE_MAX_TOKENS, 0.5)) {
        fullText += chunk;
        const bodyMatch = fullText.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (bodyMatch) {
          let partialBody = bodyMatch[1];
          partialBody = partialBody.replace(/\\n/g, '\n').replace(/\\"/g, '"');
          onChunk(partialBody, false);
        }
      }
    } else {
      fullText = await callGroq(messages, ARTICLE_MAX_TOKENS, 0.5);
    }

    let result;
    try {
      result = parseArticleResponse(fullText);
    } catch (firstErr) {
      console.warn('Article parse failed (stream or shape); retrying non-stream:', firstErr.message);
      fullText = await callGroq(messages, ARTICLE_MAX_TOKENS, 0.45);
      result = parseArticleResponse(fullText);
    }

    result.source = cardData.source;
    result.originalUrl = cardData.originalUrl || article.url;
    result.category = cardData.category;
    result.publishedAt = article.publishedAt;
    result.imageUrl = cardData.imageUrl;

    if (onChunk) onChunk(result.body, true);

    sessionStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('Article generation error:', err);
    throw err;
  }
}

// ── Generate daily digest ────────────────────────────────────────────────────
async function generateDigest(articles) {
  const cacheKey = `digest_${new Date().toDateString()}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const headlines = articles.slice(0, 8).map((a, i) =>
    `${i + 1}. ${a.title} (${a.source?.name || 'Wire'})`
  ).join('\n');

  const prompt = `You are the autonomous editorial director of an AI-native newsroom composing the morning briefing (no human reviews this text before readers see it).

Today's top stories:
${headlines}

Write a crisp daily news briefing with exactly 5 bullet points. Each bullet must:
- Be a single, information-dense sentence (max 30 words)
- Start with the most important fact

Return ONLY valid JSON:
{"points": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"]}`;

  try {
    const raw = await callGroq([
      { role: 'system', content: 'Return only valid JSON.' },
      { role: 'user', content: prompt }
    ], 512, 0.4);

    const jsonStr = extractJsonObjectFromLLMOutput(raw);
    if (!jsonStr) throw new Error('No JSON');
    const result = parseLLMJson(jsonStr);
    sessionStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (err) {
    return {
      points: articles.slice(0, 5).map(a => a.title?.replace(/\s*-\s*[^-]+$/, '') || 'Story developing')
    };
  }
}

// ── Answer question about article ────────────────────────────────────────────
async function answerQuestion(question, articleContext) {
  const messages = [
    {
      role: 'system',
      content: `You are a knowledgeable journalist at The Destroyer. You wrote this article:
Headline: ${articleContext.headline}
${articleContext.body}

Answer reader questions accurately based ONLY on this article. Keep answers 2-4 sentences. Do not use JSON, reply in plain text.`
    },
    { role: 'user', content: question }
  ];

  const response = await fetch(GROQ_ENDPOINT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 500, temperature: 0.5 })
  });
  
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${data?.error?.message || 'Unknown error'}`);
  }
  return groqCompletionText(data);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function countWords(text) { return text ? text.trim().split(/\s+/).length : 0; }
function readingTime(text) { return Math.max(1, Math.ceil(countWords(text) / 200)); }
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.Signal = {
  CATEGORY_LABELS, CATEGORY_EMOJI, CATEGORY_BG,
  fetchHeadlines, searchNews, generateCardContent, generateFullArticle,
  generateDigest, answerQuestion, timeAgo, formatDate, countWords, readingTime, escapeHtml
};

// ── Theme Toggle ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
    });
  }
});
