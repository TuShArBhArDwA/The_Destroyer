/* article.js — Full article detail page for The Destroyer */

const S = window.Signal;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const progressBar    = document.getElementById('article-progress');
const articleLoading = document.getElementById('article-loading');
const articleContent = document.getElementById('article-content');
const qaSection      = document.getElementById('qa-section');
const relatedSection = document.getElementById('related-section');
const relatedGrid    = document.getElementById('related-grid');

// Article fields
const artCategory  = document.getElementById('art-category');
const artHeadline  = document.getElementById('art-headline');
const artDek       = document.getElementById('art-dek');
const artDate      = document.getElementById('art-date');
const artSource    = document.getElementById('art-source');
const artReadTime  = document.getElementById('art-read-time');
const artWordCount = document.getElementById('art-word-count');
const artBody      = document.getElementById('art-body');
const artSourceLink = document.getElementById('art-source-link');
const keyFactsList = document.getElementById('key-facts-list');

// Q&A
const qaMessages = document.getElementById('qa-messages');
const qaInput    = document.getElementById('qa-input');
const qaSend     = document.getElementById('qa-send');

// ── State ─────────────────────────────────────────────────────────────────────
let currentArticleContext = null;
let qaHistory = [];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupProgress();
  loadArticle();
  setupAudio();
});

// ── Reading Progress ──────────────────────────────────────────────────────────
function setupProgress() {
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = `${Math.min(100, pct)}%`;
  }, { passive: true });
}

// ── Audio Newsreader ──────────────────────────────────────────────────────────
function setupAudio() {
  const listenBtn = document.getElementById('listen-btn');
  if (!listenBtn) return;
  
  let synth = window.speechSynthesis;
  let isPlaying = false;
  let utterance = null;

  listenBtn.addEventListener('click', () => {
    if (isPlaying) {
      synth.cancel();
      isPlaying = false;
      listenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px; vertical-align: middle;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Listen';
      return;
    }
    
    if (!synth) { alert("Audio playback not supported in this browser."); return; }
    
    const title = artHeadline && artHeadline.textContent ? artHeadline.textContent : '';
    const body = artBody && artBody.textContent ? artBody.textContent : '';
    if (!body) return;
    
    const textToRead = `${title}. ... ${body}`;
    
    utterance = new SpeechSynthesisUtterance(textToRead);
    const voices = synth.getVoices();
    const goodVoice = voices.find(v => v.lang.includes('en-GB') || v.name.includes('Google UK') || v.name.includes('Kyra') || v.name.includes('Samantha')) || voices[0];
    if(goodVoice) utterance.voice = goodVoice;
    
    utterance.rate = 0.95;
    utterance.pitch = 0.95;
    
    utterance.onend = () => {
      isPlaying = false;
      listenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px; vertical-align: middle;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Listen';
    };

    synth.speak(utterance);
    isPlaying = true;
    listenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px; vertical-align: middle;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Stop';
  });
}

// ── Load & Generate Article ───────────────────────────────────────────────────
async function loadArticle() {
  const stored = sessionStorage.getItem('signal_article');
  if (!stored) {
    showError('No article data found. Please return to the feed.');
    return;
  }

  let { article, cardData } = JSON.parse(stored);

  // Update page title immediately
  document.title = `${cardData.headline} — The Destroyer`;

  try {
    // Check cache first
    const cacheKey = `article_${article.url || cardData.originalUrl}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      renderArticle(data, article, cardData);
      return;
    }

    // Stream the article
    let bodyAccumulator = '';
    let isFirstChunk = true;

    const fullData = await S.generateFullArticle(article, cardData, (bodyChunk, isDone) => {
      if (isFirstChunk) {
        // Show article shell as soon as writing begins
        articleLoading.style.display = 'none';
        articleContent.style.display = 'block';

        artCategory.textContent = S.CATEGORY_LABELS[cardData.category] || 'News';
        artHeadline.textContent = cardData.headline;
        artDek.textContent = cardData.dek;
        artDate.textContent = S.formatDate(article.publishedAt);
        artSource.textContent = cardData.source || 'Newswire';
        artReadTime.textContent = '~5 min';
        artWordCount.textContent = '~700';
        artBody.className = 'article-body streaming';
        artSourceLink.href = article.url || '#';

        isFirstChunk = false;
      }

      if (!isDone) {
        bodyAccumulator = bodyChunk;
        // Render paragraphs progressively
        renderBodyParagraphs(bodyAccumulator, true);
      } else {
        // Final render - clean up streaming state
        artBody.className = 'article-body';
      }
    });

    // Final complete render
    renderArticle(fullData, article, cardData);

  } catch (err) {
    console.error('Article load error:', err);
    showError(`Could not generate article: ${err.message}`);
  }
}

function renderBodyParagraphs(bodyText, streaming = false) {
  const paragraphs = bodyText.split(/\n\n+/).filter(p => p.trim());
  artBody.innerHTML = paragraphs.map((p, i) =>
    `<p>${S.escapeHtml(p.trim())}</p>`
  ).join('');
  if (streaming) artBody.classList.add('streaming');
}

function renderArticle(data, article, cardData) {
  articleLoading.style.display = 'none';
  articleContent.style.display = 'block';
  artBody.className = 'article-body';

  const headline = data.headline || cardData.headline;
  const dek = data.dek || cardData.dek;
  const body = data.body || '';

  document.title = `${headline} — The Destroyer`;
  artCategory.textContent = S.CATEGORY_LABELS[data.category || cardData.category] || 'News';
  artHeadline.textContent = headline;
  artDek.textContent = dek;
  artDate.textContent = S.formatDate(data.publishedAt || article.publishedAt);
  artSource.textContent = data.source || cardData.source || 'Newswire';

  const words = S.countWords(body);
  const minRead = S.readingTime(body);
  artReadTime.textContent = `${minRead} min`;
  artWordCount.textContent = words.toLocaleString();

  artSourceLink.href = data.originalUrl || article.url || '#';
  artSourceLink.textContent = `🔗 ${data.source || cardData.source || 'Original report'}`;

  // Body
  renderBodyParagraphs(body);

  // Key facts
  if (data.keyFacts?.length) {
    keyFactsList.innerHTML = data.keyFacts.map(f =>
      `<div class="key-fact">${S.escapeHtml(f)}</div>`
    ).join('');
  } else {
    document.getElementById('key-facts-section').style.display = 'none';
  }

  // Store context for Q&A
  currentArticleContext = { headline, body, dek };

  // Show Q&A
  qaSection.style.display = 'block';
  setupQA();

  // Related stories
  renderRelated();
}

// ── Q&A ───────────────────────────────────────────────────────────────────────
function setupQA() {
  qaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
    // Auto-resize textarea
    qaInput.style.height = 'auto';
    qaInput.style.height = Math.min(120, qaInput.scrollHeight) + 'px';
  });

  qaSend.addEventListener('click', submitQuestion);
}

async function submitQuestion() {
  const question = qaInput.value.trim();
  if (!question || !currentArticleContext) return;

  qaSend.disabled = true;
  qaInput.value = '';
  qaInput.style.height = 'auto';

  // Render user message
  appendMessage('user', question);

  // Render thinking indicator
  const thinkingEl = appendMessage('assistant', null, true);

  try {
    const answer = await S.answerQuestion(question, currentArticleContext);
    thinkingEl.querySelector('.msg-bubble').textContent = answer;
    thinkingEl.querySelector('.msg-bubble').classList.remove('thinking');

    // Store in history for context
    qaHistory.push({ q: question, a: answer });

    // Scroll to bottom
    qaMessages.scrollTop = qaMessages.scrollHeight;
  } catch (err) {
    thinkingEl.querySelector('.msg-bubble').textContent = 'Sorry, something went wrong. Please try again.';
  }

  qaSend.disabled = false;
  qaInput.focus();
}

function appendMessage(role, content, isThinking = false) {
  const div = document.createElement('div');
  div.className = `qa-message ${role}`;

  const label = role === 'user' ? 'You' : 'Pipeline assistant';
  const bubbleContent = isThinking
    ? `<div class="generating-state" style="padding:0"><div class="gen-dots"><div class="gen-dot"></div><div class="gen-dot"></div><div class="gen-dot"></div></div></div>`
    : S.escapeHtml(content);

  div.innerHTML = `
    <div class="msg-label">${label}</div>
    <div class="msg-bubble ${isThinking ? 'thinking' : ''}">${isThinking ? bubbleContent : bubbleContent}</div>`;

  qaMessages.appendChild(div);
  qaMessages.scrollTop = qaMessages.scrollHeight;
  return div;
}

// ── Related Stories ───────────────────────────────────────────────────────────
function renderRelated() {
  try {
    const allStored = sessionStorage.getItem('signal_all_articles');
    if (!allStored) return;
    const all = JSON.parse(allStored);

    // Pick 2-4 stories that aren't the current one
    const currentUrl = currentArticleContext?.headline;
    const others = all.filter(item =>
      item.cardData?.headline !== currentUrl
    ).slice(0, 4);

    if (!others.length) return;

    relatedSection.style.display = 'block';
    relatedGrid.innerHTML = others.map(item => `
      <div class="related-card" onclick="openRelated('${encodeURIComponent(JSON.stringify(item))}')">
        <div class="related-headline">${S.escapeHtml(item.cardData?.headline || item.article?.title || 'Story')}</div>
        <div class="related-source">${S.escapeHtml(item.cardData?.source || item.article?.source?.name || '')} · ${S.timeAgo(item.cardData?.publishedAt || item.article?.publishedAt)}</div>
      </div>`).join('');

  } catch { /* skip related */ }
}

window.openRelated = function(encodedItem) {
  try {
    const item = JSON.parse(decodeURIComponent(encodedItem));
    sessionStorage.setItem('signal_article', JSON.stringify(item));
    window.scrollTo({ top: 0 });
    location.reload();
  } catch { /* ignore */ }
};

// ── Error State ───────────────────────────────────────────────────────────────
function showError(msg) {
  articleLoading.innerHTML = `<div class="error-msg">${msg}<br><br><a href="/" style="color:var(--accent-gold)">← Return to feed</a></div>`;
}
