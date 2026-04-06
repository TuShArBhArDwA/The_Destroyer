/* app.js — Main feed orchestration for The Destroyer */

const S = window.Signal;

let currentCategory = 'general';
let rawArticles = [];
let currentPage = 1;
let isLoading = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const heroCard       = document.getElementById('hero-card');
const articleGrid    = document.getElementById('article-grid');
const digestBody     = document.getElementById('digest-body');
const digestDate     = document.getElementById('digest-date');
const loadMoreWrap   = document.getElementById('load-more-wrap');
const loadMoreBtn    = document.getElementById('load-more-btn');
const tickerTrack    = document.getElementById('ticker-track');
const searchOverlay  = document.getElementById('search-overlay');
const searchField    = document.getElementById('search-field');
const editionDate    = document.getElementById('edition-date');

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setEditionDate();
  setupCategoryNav();
  setupSearch();
  setupLoadMore();
  loadFeed(currentCategory);
});

function setEditionDate() {
  const now = new Date();
  editionDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  digestDate.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Category Nav ──────────────────────────────────────────────────────────────
function setupCategoryNav() {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cat === currentCategory && !isLoading) return;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      currentPage = 1;
      rawArticles = [];
      loadFeed(currentCategory);
    });
  });
}

// ── Main Feed Load ────────────────────────────────────────────────────────────
async function loadFeed(category) {
  if (isLoading) return;
  isLoading = true;

  showSkeletons();

  try {
    const articles = await S.fetchHeadlines(category, 12, currentPage);

    if (!articles.length) {
      articleGrid.innerHTML = '<div class="error-msg" style="grid-column: 1/-1">No stories found for this section.</div>';
      isLoading = false;
      return;
    }

    rawArticles = articles;
    updateTicker(articles);

    const heroArticle = articles[0];
    renderHeroSkeleton(heroArticle, category);

    const cardArticles = articles.slice(1, 10);

    const [heroData, ...cardDatas] = await Promise.all([
      S.generateCardContent(heroArticle, category),
      ...cardArticles.map(a => S.generateCardContent(a, category))
    ]);

    renderHero(heroArticle, heroData);
    renderCards(cardArticles, cardDatas);

    if (articles.length >= 10) {
      loadMoreWrap.style.display = 'block';
    }

    generateAndRenderDigest(articles);

    isLoading = false;

  } catch (err) {
    console.error('Feed load error:', err);
    articleGrid.innerHTML = `<div class="error-msg" style="grid-column: 1/-1">Trouble loading feed. Please refresh the page.</div>`;
    isLoading = false;
  }
}

// ── Render skeletons while loading ───────────────────────────────────────────
function showSkeletons() {
  heroCard.innerHTML = `
    <div class="hero-content">
      <div class="skel" style="width:80px;height:10px;margin-bottom:16px;border-radius:2px"></div>
      <div class="skel" style="height:32px;margin-bottom:10px;border-radius:2px"></div>
      <div class="skel" style="height:32px;width:70%;margin-bottom:20px;border-radius:2px"></div>
      <div class="skel" style="height:14px;margin-bottom:8px;border-radius:2px"></div>
      <div class="skel" style="height:14px;width:80%;margin-bottom:28px;border-radius:2px"></div>
      <div class="skel" style="width:140px;height:36px;border-radius:4px"></div>
    </div>
    <div class="hero-image bg-general"></div>`;
  heroCard.className = 'hero-card skeleton';
  heroCard.onclick = null;

  articleGrid.innerHTML = Array(6).fill(0).map((_, i) => {
    return `<div class="article-card skeleton">
      <div class="card-img-placeholder bg-general skel"></div>
      <div class="card-body">
        <div class="skel" style="width:60px;height:9px;margin-bottom:12px;border-radius:2px"></div>
        <div class="skel" style="height:15px;margin-bottom:7px;border-radius:2px"></div>
        <div class="skel" style="height:15px;width:80%;margin-bottom:14px;border-radius:2px"></div>
        <div class="skel" style="height:11px;margin-bottom:5px;border-radius:2px"></div>
        <div class="skel" style="height:11px;width:65%;border-radius:2px"></div>
      </div>
    </div>`;
  }).join('');

  loadMoreWrap.style.display = 'none';
  digestBody.innerHTML = `<div class="loading-state" style="color:var(--text-muted);font-size:0.8rem">Generating desk briefing (autonomous pipeline)…</div>`;
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function renderHeroSkeleton(article, category) {
  const bg = S.CATEGORY_BG[category] || 'bg-general';
  heroCard.innerHTML = `
    <div class="hero-content">
      <div class="hero-category">${S.CATEGORY_LABELS[category] || 'News'}</div>
      <div class="hero-headline skel" style="height:30px;margin-bottom:10px"></div>
      <div class="hero-headline skel" style="height:30px;width:75%;margin-bottom:20px"></div>
      <div class="hero-dek skel" style="height:13px;margin-bottom:7px"></div>
      <div class="hero-dek skel" style="height:13px;width:80%";margin-bottom:28px></div>
    </div>
    <div class="hero-image ${bg}">
      ${article.urlToImage ? `<img src="${article.urlToImage}" alt="Story image" onerror="this.parentElement.innerHTML='<div class=hero-image-placeholder></div>'" />` : ``}
    </div>`;
  heroCard.className = 'hero-card skeleton';
}

function renderHero(article, data) {
  const bg = S.CATEGORY_BG[data.category] || 'bg-general';

  heroCard.innerHTML = `
    <div class="hero-content">
      <div class="hero-category">${S.CATEGORY_LABELS[data.category] || 'News'}</div>
      <h2 class="hero-headline">${S.escapeHtml(data.headline)}</h2>
      <p class="hero-dek">${S.escapeHtml(data.dek)}</p>
      <div class="hero-footer">
        <span class="hero-source">${S.escapeHtml(data.source)} · ${S.timeAgo(data.publishedAt)}</span>
        <button class="read-btn">Read Article →</button>
      </div>
    </div>
    <div class="hero-image ${bg}">
      ${data.imageUrl
        ? `<img src="${data.imageUrl}" alt="Story image" onerror="this.parentElement.innerHTML=''" />`
        : ``}
    </div>`;

  heroCard.className = 'hero-card fade-in';
  heroCard.style.cursor = 'pointer';
  heroCard.onclick = () => openArticle(article, data);
}

// ── Article Cards ─────────────────────────────────────────────────────────────
function renderCards(articles, cardsData) {
  articleGrid.innerHTML = '';

  cardsData.forEach((data, i) => {
    const article = articles[i];
    const bg = S.CATEGORY_BG[data.category] || 'bg-general';
    const delay = i * 0.06;

    const card = document.createElement('div');
    card.className = 'article-card fade-in';
    card.style.animationDelay = `${delay}s`;
    card.innerHTML = `
      ${data.imageUrl
        ? `<img class="card-img" src="${data.imageUrl}" alt="" onerror="this.outerHTML='<div class=card-img-placeholder ${bg}></div>'" />`
        : `<div class="card-img-placeholder ${bg}"></div>`}
      <div class="card-body">
        <div class="card-cat">${S.CATEGORY_LABELS[data.category] || 'News'}</div>
        <h3 class="card-headline">${S.escapeHtml(data.headline)}</h3>
        <p class="card-dek">${S.escapeHtml(data.dek)}</p>
        <div class="card-footer">
          <span class="card-source">${S.escapeHtml(data.source)}</span>
          <span class="card-time">${S.timeAgo(data.publishedAt)}</span>
        </div>
      </div>`;

    card.addEventListener('click', () => openArticle(article, data));
    articleGrid.appendChild(card);
  });
}

// ── Navigate to article ───────────────────────────────────────────────────────
function openArticle(article, cardData) {
  sessionStorage.setItem('signal_article', JSON.stringify({ article, cardData }));
  sessionStorage.setItem('signal_all_articles', JSON.stringify(rawArticles.slice(0, 8).map(a => ({
    article: a,
    cardData: { headline: a.title, source: a.source?.name, publishedAt: a.publishedAt, category: currentCategory }
  }))));
  window.location.href = '/article.html';
}

// ── Digest ────────────────────────────────────────────────────────────────────
async function generateAndRenderDigest(articles) {
  try {
    const digest = await S.generateDigest(articles);
    digestBody.innerHTML = digest.points.map((point, i) => `
      <div class="digest-point" style="animation-delay:${i * 0.1}s">
        <span class="digest-num">${i + 1}.</span>
        <span class="digest-text">${S.escapeHtml(point)}</span>
      </div>`).join('');
  } catch {
    digestBody.innerHTML = '<div class="error-msg" style="padding:0;font-size:0.75rem;text-align:left">Digest unavailable today.</div>';
  }
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function updateTicker(articles) {
  const texts = articles.slice(0, 8)
    .map(a => a.title?.replace(/\s*-\s*[^-]+$/, '') || '')
    .filter(Boolean)
    .join('   ·   ');
  tickerTrack.textContent = texts + '   ·   ' + texts + '   ·   ';
}

// ── Load More ─────────────────────────────────────────────────────────────────
function setupLoadMore() {
  loadMoreBtn.addEventListener('click', async () => {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.textContent = 'Loading…';

    try {
      currentPage++;
      const more = await S.fetchHeadlines(currentCategory, 9, currentPage);
      const filtered = more.filter(a => !rawArticles.some(r => r.url === a.url));

      if (!filtered.length) {
        loadMoreWrap.style.display = 'none';
        isLoading = false;
        return;
      }

      rawArticles = [...rawArticles, ...filtered];

      const skels = filtered.map(() => {
        const el = document.createElement('div');
        el.className = 'article-card skeleton';
        el.innerHTML = `<div class="card-img-placeholder bg-general skel"></div>
          <div class="card-body">
            <div class="skel" style="height:9px;width:60px;margin-bottom:12px;border-radius:2px"></div>
            <div class="skel" style="height:15px;margin-bottom:7px;border-radius:2px"></div>
            <div class="skel" style="height:15px;width:80%;border-radius:2px"></div>
          </div>`;
        articleGrid.appendChild(el);
        return el;
      });

      const cardsData = await Promise.all(filtered.map(a => S.generateCardContent(a, currentCategory)));

      skels.forEach((skel, i) => {
        const data = cardsData[i];
        const article = filtered[i];
        const bg = S.CATEGORY_BG[data.category] || 'bg-general';
        skel.className = 'article-card fade-in';
        skel.innerHTML = `
          ${data.imageUrl
            ? `<img class="card-img" src="${data.imageUrl}" alt="" onerror="this.outerHTML='<div class=card-img-placeholder ${bg}></div>'" />`
            : `<div class="card-img-placeholder ${bg}"></div>`}
          <div class="card-body">
            <div class="card-cat">${S.CATEGORY_LABELS[data.category] || 'News'}</div>
            <h3 class="card-headline">${S.escapeHtml(data.headline)}</h3>
            <p class="card-dek">${S.escapeHtml(data.dek)}</p>
            <div class="card-footer">
              <span class="card-source">${S.escapeHtml(data.source)}</span>
              <span class="card-time">${S.timeAgo(data.publishedAt)}</span>
            </div>
          </div>`;
        skel.addEventListener('click', () => openArticle(article, data));
      });

    } catch (err) {
      console.error('Load more error:', err);
    }

    loadMoreBtn.textContent = 'Load More Stories';
    isLoading = false;
  });
}

// ── Search ────────────────────────────────────────────────────────────────────
function setupSearch() {
  document.getElementById('search-open-btn').addEventListener('click', openSearch);

  searchField.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'Enter' && searchField.value.trim()) {
      const query = searchField.value.trim();
      closeSearch();
      await runSearch(query);
    }
  });

  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });
}

function openSearch() {
  searchOverlay.classList.add('open');
  searchField.value = '';
  setTimeout(() => searchField.focus(), 100);
}

function closeSearch() {
  searchOverlay.classList.remove('open');
}

async function runSearch(query) {
  showSkeletons();
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));

  try {
    const articles = await S.searchNews(query, 10);
    if (!articles.length) {
      articleGrid.innerHTML = `<div class="error-msg" style="grid-column:1/-1">No results found for "${query}".</div>`;
      return;
    }

    rawArticles = articles;
    updateTicker(articles);

    const [heroData, ...cardDatas] = await Promise.all([
      S.generateCardContent(articles[0], 'general'),
      ...articles.slice(1, 9).map(a => S.generateCardContent(a, 'general'))
    ]);

    renderHero(articles[0], heroData);
    renderCards(articles.slice(1, 9), cardDatas);
    generateAndRenderDigest(articles);
  } catch (err) {
    articleGrid.innerHTML = `<div class="error-msg" style="grid-column:1/-1">Search failed.</div>`;
  }
}
