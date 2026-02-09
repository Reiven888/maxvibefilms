const YEAR_MIN = 1975;
const YEAR_MAX = 2025;
const MAX_POOL = 100;

const els = {
  randomBtn: document.getElementById('randomBtn'),
  searchLink: document.getElementById('searchLink'),
  yearValue: document.getElementById('yearValue'),
  status: document.getElementById('status'),
  movieCard: document.getElementById('movieCard'),
  posterWrap: document.getElementById('posterWrap'),
  movieTitle: document.getElementById('movieTitle'),
  movieRating: document.getElementById('movieRating'),
  movieVotes: document.getElementById('movieVotes'),
  movieYear: document.getElementById('movieYear'),
  movieTop: document.getElementById('movieTop'),
  movieDescription: document.getElementById('movieDescription'),
  imdbTitleLink: document.getElementById('imdbTitleLink'),
};

const proxies = [
  {
    name: 'allorigins',
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'corsproxy.io',
    build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'r.jina.ai',
    build: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
  },
];

const translators = [
  async (text) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload?.[0]) ? payload[0].map((item) => item?.[0] || '').join('').trim() : '';
  },
  async (text) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return payload?.responseData?.translatedText?.trim() || '';
  },
];

function setStatus(text, type = '') {
  els.status.textContent = text;
  els.status.className = `status ${type}`.trim();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildSearchUrl(year) {
  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${year}-01-01,${year}-12-31`;
}

async function fetchWithFallback(url) {
  const errors = [];

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy.build(url), {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text || text.length < 80) throw new Error('Пустой ответ');
      return { text, source: proxy.name };
    } catch (error) {
      errors.push(`${proxy.name}: ${error.message}`);
    }
  }

  throw new Error(`Все источники недоступны. ${errors.join(' | ')}`);
}

function extractTitleIds(searchHtml) {
  const matches = searchHtml.match(/\/title\/(tt\d{6,10})\//g) || [];
  const ids = [...new Set(matches.map((entry) => entry.match(/tt\d{6,10}/)[0]))];
  return ids.slice(0, MAX_POOL);
}

function normalizeMovieNode(node) {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = normalizeMovieNode(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== 'object') return null;

  if (Array.isArray(node['@graph'])) {
    return normalizeMovieNode(node['@graph']);
  }

  const type = node['@type'];
  const isMovie = type === 'Movie' || (Array.isArray(type) && type.includes('Movie'));
  return isMovie ? node : null;
}

function parseJsonLdMovie(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const movie = normalizeMovieNode(parsed);
      if (movie) return movie;
    } catch {
      // ignore broken json block
    }
  }

  return null;
}

function sanitizeText(text) {
  if (!text) return 'Описание отсутствует.';
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text);
}

async function toRussian(text) {
  const clean = sanitizeText(text);
  if (clean === 'Описание отсутствует.') return clean;
  if (hasCyrillic(clean)) return clean;

  for (const translate of translators) {
    try {
      const translated = sanitizeText(await translate(clean));
      if (translated && hasCyrillic(translated)) return translated;
    } catch {
      // continue to next provider
    }
  }

  return 'Описание на русском временно недоступно.';
}

function formatVotes(value) {
  const numeric = Number(String(value || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 'нет данных';
  return new Intl.NumberFormat('ru-RU').format(Math.round(numeric));
}

function renderPoster(imageUrl, title) {
  els.posterWrap.innerHTML = '';

  if (!imageUrl) {
    const placeholder = document.createElement('div');
    placeholder.className = 'poster-placeholder';
    placeholder.textContent = 'Постер недоступен';
    els.posterWrap.appendChild(placeholder);
    return;
  }

  const img = document.createElement('img');
  img.className = 'poster';
  img.src = imageUrl;
  img.alt = `Постер: ${title}`;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => renderPoster('', title);
  els.posterWrap.appendChild(img);
}

function renderMovie({ movie, year, titleUrl, topPosition, descriptionRu }) {
  els.movieTitle.textContent = movie.name || 'Без названия';
  els.movieRating.textContent = String(movie.aggregateRating?.ratingValue || 'нет данных');
  els.movieVotes.textContent = formatVotes(movie.aggregateRating?.ratingCount);
  els.movieYear.textContent = String(year);
  els.movieTop.textContent = `ТОП ${topPosition}`;
  els.movieDescription.textContent = descriptionRu;
  els.imdbTitleLink.href = titleUrl;

  renderPoster(movie.image, movie.name || 'Фильм');
  els.movieCard.hidden = false;
}

async function runRandomizer() {
  const year = randomInt(YEAR_MIN, YEAR_MAX);
  const searchUrl = buildSearchUrl(year);

  els.randomBtn.disabled = true;
  els.movieCard.hidden = true;
  els.yearValue.textContent = String(year);
  els.searchLink.href = searchUrl;

  try {
    setStatus('Загружаем IMDb-поиск и подбираем случайный фильм…');
    const { text: searchHtml, source: searchSource } = await fetchWithFallback(searchUrl);

    const ids = extractTitleIds(searchHtml);
    if (!ids.length) {
      throw new Error('Не удалось получить фильмы из первой сотни выдачи IMDb.');
    }

    const randomIndex = randomInt(0, ids.length - 1);
    const titleId = ids[randomIndex];
    const topPosition = randomIndex + 1;
    const titleUrl = `https://www.imdb.com/title/${titleId}/`;

    setStatus(`Выбран фильм из ТОП-${ids.length}, позиция ${topPosition}. Загружаем карточку…`);
    const { text: titleHtml, source: titleSource } = await fetchWithFallback(titleUrl);

    const movie = parseJsonLdMovie(titleHtml);
    if (!movie) {
      throw new Error('Не удалось распарсить JSON-LD фильма.');
    }

    setStatus('Переводим описание на русский…');
    const descriptionRu = await toRussian(movie.description);

    renderMovie({ movie, year, titleUrl, topPosition, descriptionRu });
    setStatus(`Готово! Источники: поиск — ${searchSource}, карточка — ${titleSource}.`, 'success');
  } catch (error) {
    setStatus(`Ошибка: ${error.message}`, 'error');
  } finally {
    els.randomBtn.disabled = false;
  }
}

els.randomBtn.addEventListener('click', runRandomizer);
setStatus('Нажмите «Рандом», чтобы получить случайный фильм IMDb.');
