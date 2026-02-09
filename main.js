const YEAR_MIN = 1975;
const YEAR_MAX = 2025;

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
  movieDescription: document.getElementById('movieDescription'),
  imdbTitleLink: document.getElementById('imdbTitleLink'),
};

const proxies = [
  {
    name: 'allorigins',
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'corsproxy',
    build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'r.jina.ai',
    build: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
  },
];

function setStatus(text, type = '') {
  els.status.textContent = text;
  els.status.className = `status ${type}`.trim();
}

function randomYear() {
  return Math.floor(Math.random() * (YEAR_MAX - YEAR_MIN + 1)) + YEAR_MIN;
}

function buildSearchUrl(year) {
  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${year}-01-01,${year}-12-31`;
}

async function fetchWithFallback(url) {
  const errors = [];

  for (const proxy of proxies) {
    const proxiedUrl = proxy.build(url);
    try {
      const response = await fetch(proxiedUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      if (!text || text.length < 50) {
        throw new Error('Пустой или слишком короткий ответ');
      }

      return { text, source: proxy.name };
    } catch (error) {
      errors.push(`${proxy.name}: ${error.message}`);
    }
  }

  throw new Error(`Не удалось загрузить страницу через доступные источники. ${errors.join(' | ')}`);
}

function extractTitleIds(searchHtml) {
  const ids = [...new Set(searchHtml.match(/\/title\/(tt\d{6,10})\//g)?.map((m) => m.match(/tt\d{6,10}/)[0]) || [])];
  return ids;
}

function parseJsonLdMovie(movieHtml) {
  const doc = new DOMParser().parseFromString(movieHtml, 'text/html');
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const movie = normalizeMovieNode(data);
      if (movie) return movie;
    } catch {
      const fallback = findMovieInBrokenJson(raw);
      if (fallback) return fallback;
    }
  }

  return null;
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

function findMovieInBrokenJson(raw) {
  const match = raw.match(/\{[\s\S]*"@type"\s*:\s*"Movie"[\s\S]*\}/);
  if (!match) return null;
  try {
    return normalizeMovieNode(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

function formatVotes(value) {
  const num = Number(String(value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return 'нет данных';
  return new Intl.NumberFormat('ru-RU').format(Math.round(num));
}

function sanitizeText(text) {
  if (!text) return 'Описание отсутствует.';
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function renderPoster(imageUrl, title) {
  els.posterWrap.innerHTML = '';

  if (!imageUrl) {
    const fallback = document.createElement('div');
    fallback.className = 'poster-placeholder';
    fallback.textContent = 'Постер недоступен';
    els.posterWrap.appendChild(fallback);
    return;
  }

  const img = document.createElement('img');
  img.className = 'poster';
  img.src = imageUrl;
  img.alt = `Постер: ${title}`;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => {
    renderPoster('', title);
  };

  els.posterWrap.appendChild(img);
}

function renderMovie({ movie, year, titleUrl }) {
  const ratingValue = movie.aggregateRating?.ratingValue || 'нет данных';
  const ratingCount = movie.aggregateRating?.ratingCount;

  els.movieTitle.textContent = movie.name || 'Без названия';
  els.movieRating.textContent = String(ratingValue);
  els.movieVotes.textContent = formatVotes(ratingCount);
  els.movieYear.textContent = String(year);
  els.movieDescription.textContent = sanitizeText(movie.description);

  renderPoster(movie.image, movie.name || 'Фильм');

  els.imdbTitleLink.href = titleUrl;
  els.movieCard.hidden = false;
}

async function handleRandomClick() {
  const year = randomYear();
  const searchUrl = buildSearchUrl(year);

  els.yearValue.textContent = String(year);
  els.searchLink.href = searchUrl;

  els.randomBtn.disabled = true;
  setStatus('Ищем фильмы за выбранный год…');
  els.movieCard.hidden = true;

  try {
    const { text: searchHtml, source: searchSource } = await fetchWithFallback(searchUrl);
    const ids = extractTitleIds(searchHtml);

    if (!ids.length) {
      throw new Error('Не удалось найти фильмы в поисковой выдаче IMDb.');
    }

    const titleId = ids[0];
    const titleUrl = `https://www.imdb.com/title/${titleId}/`;

    setStatus(`Найден фильм, загружаем карточку… (источник: ${searchSource})`);

    const { text: titleHtml, source: titleSource } = await fetchWithFallback(titleUrl);
    const movie = parseJsonLdMovie(titleHtml);

    if (!movie) {
      throw new Error('Не удалось распарсить JSON-LD карточки фильма IMDb.');
    }

    renderMovie({ movie, year, titleUrl });
    setStatus(`Готово! Данные получены через: поиск — ${searchSource}, фильм — ${titleSource}.`, 'success');
  } catch (error) {
    setStatus(`Ошибка: ${error.message}`, 'error');
  } finally {
    els.randomBtn.disabled = false;
  }
}

els.randomBtn.addEventListener('click', handleRandomClick);
setStatus('Нажмите «Рандом», чтобы получить случайный фильм IMDb.');
