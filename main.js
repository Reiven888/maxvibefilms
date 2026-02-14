const YEAR_MIN = 1975;
const YEAR_MAX = 2025;
const TOP_LIMIT = 10;
const FETCH_TIMEOUT_MS = 8000;
const LOG_LIMIT = 20;

const randomBtn = document.getElementById('randomBtn');
const imdbSearchBtn = document.getElementById('imdbSearchBtn');
const selectedYearEl = document.getElementById('selectedYear');
const selectedRankEl = document.getElementById('selectedRank');
const statusEl = document.getElementById('status');
const logsListEl = document.getElementById('logsList');

const movieCard = document.getElementById('movieCard');
const posterEl = document.getElementById('poster');
const titleEl = document.getElementById('title');
const ratingChipEl = document.getElementById('ratingChip');
const votesChipEl = document.getElementById('votesChip');
const rankChipEl = document.getElementById('rankChip');
const descriptionEl = document.getElementById('description');
const movieLinkEl = document.getElementById('movieLink');
const watchLinkEl = document.getElementById('watchLink');

const parser = new DOMParser();
const translationCache = new Map();
const kinopoiskCache = new Map();

const proxyBuilders = [
  { name: 'allorigins', build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'corsproxy.io', build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'r.jina.ai', build: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}` }
];

function setStatus(message, type = 'warn') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function addLog(message, level = 'info') {
  const stamp = new Date().toLocaleTimeString('ru-RU');
  const full = `[${stamp}] ${message}`;

  if (level === 'error') {
    console.error(full);
  } else if (level === 'warn') {
    console.warn(full);
  } else {
    console.log(full);
  }

  const li = document.createElement('li');
  li.textContent = full;
  logsListEl.prepend(li);

  while (logsListEl.children.length > LOG_LIMIT) {
    logsListEl.removeChild(logsListEl.lastElementChild);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function numberRu(value) {
  const n = Number((value || '').toString().replace(/,/g, ''));
  return Number.isFinite(n) ? new Intl.NumberFormat('ru-RU').format(n) : '—';
}

function buildImdbSearchUrl(year) {
  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${year}-01-01,${year}-12-31`;
}

function updateSearchButton(url) {
  imdbSearchBtn.href = url || '#';
  imdbSearchBtn.classList.toggle('disabled', !url);
}

async function fetchFromProxy(targetUrl, proxy, label) {
  const timer = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const proxied = proxy.build(targetUrl);
    addLog(`Запрос к ${label} через ${proxy.name}...`);
    const response = await fetch(proxied, { signal: timer.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.trim().length < 60) throw new Error('Слишком короткий ответ');
    addLog(`${label}: ответ получен через ${proxy.name}.`);
    return { text, source: proxy.name };
  } catch (error) {
    const msg = error?.name === 'AbortError' ? `таймаут ${FETCH_TIMEOUT_MS}мс` : error.message;
    throw new Error(`${proxy.name}: ${msg}`);
  } finally {
    timer.clear();
  }
}

async function fetchHtmlFast(url, label) {
  const requests = proxyBuilders.map((proxy) => fetchFromProxy(url, proxy, label));
  try {
    const result = await Promise.any(requests);
    addLog(`Самый быстрый источник: ${result.source} (${label}).`);
    return result.text;
  } catch (agg) {
    const errors = Array.isArray(agg?.errors) ? agg.errors.map((e) => e.message) : [agg?.message || 'неизвестно'];
    throw new Error(`${label}: все источники недоступны (${errors.join(' | ')})`);
  }
}

function extractJsonLd(doc) {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent || '{}');
      if (json?.itemListElement?.length) return json;
      if (Array.isArray(json)) {
        const found = json.find((item) => item?.itemListElement?.length);
        if (found) return found;
      }
    } catch {
      // noop
    }
  }
  return null;
}

function extractSearchMovies(html) {
  const doc = parser.parseFromString(html, 'text/html');
  const jsonLd = extractJsonLd(doc);

  if (jsonLd?.itemListElement?.length) {
    return jsonLd.itemListElement
      .slice(0, TOP_LIMIT)
      .map((row, idx) => {
        const rawUrl = row?.item?.url || '';
        const id = (rawUrl.match(/(tt\d+)/) || [])[1];
        if (!id) return null;
        return {
          id,
          rank: idx + 1,
          title: clean(row?.item?.name),
          imdbUrl: `https://www.imdb.com/title/${id}/`,
          description: clean(row?.item?.description),
          image: row?.item?.image || ''
        };
      })
      .filter(Boolean);
  }

  const items = Array.from(doc.querySelectorAll('li.ipc-metadata-list-summary-item')).slice(0, TOP_LIMIT);
  return items
    .map((item, idx) => {
      const link = item.querySelector('a[href*="/title/tt"]');
      const href = link?.getAttribute('href') || '';
      const id = (href.match(/(tt\d+)/) || [])[1];
      if (!id) return null;
      const title = clean(link.textContent);
      const desc = clean(item.querySelector('.ipc-html-content-inner-div')?.textContent);
      const image = item.querySelector('img')?.getAttribute('src') || '';
      return { id, rank: idx + 1, title, imdbUrl: `https://www.imdb.com/title/${id}/`, description: desc, image };
    })
    .filter(Boolean);
}

function extractRatingAndVotes(html) {
  const doc = parser.parseFromString(html, 'text/html');
  const score = clean(doc.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"] span')?.textContent);
  const votesText = clean(doc.querySelector('[data-testid="hero-rating-bar__aggregate-rating__score"] + div, [data-testid="hero-rating-bar__aggregate-rating__score"] ~ div')?.textContent);
  const votes = (votesText.match(/[\d,.]+/) || [])[0] || '';
  return { rating: score || '—', votes: votes || '—' };
}

async function translateToRussian(text) {
  const source = clean(text);
  if (!source) return 'Описание отсутствует.';
  if (translationCache.has(source)) return translationCache.get(source);

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(source)}`;
  try {
    const raw = await fetchHtmlFast(url, 'перевод текста');
    const parsed = JSON.parse(raw);
    const translated = (parsed?.[0] || []).map((part) => part?.[0] || '').join('').trim();
    const result = translated || source;
    translationCache.set(source, result);
    return result;
  } catch (error) {
    addLog(`Перевод не выполнен: ${error.message}`, 'warn');
    return source;
  }
}

function extractKinopoiskId(html) {
  const direct = html.match(/https?:\/\/(?:www\.)?kinopoisk\.ru\/film\/(\d+)\//i);
  if (direct?.[1]) return direct[1];
  const alt = html.match(/\/film\/(\d+)\//);
  return alt?.[1] || null;
}

async function findWatchUrl(title, year, imdbId) {
  if (kinopoiskCache.has(imdbId)) return kinopoiskCache.get(imdbId);

  const q = encodeURIComponent(`${title} ${year}`);
  const kpSearch = `https://www.kinopoisk.ru/index.php?kp_query=${q}`;
  const html = await fetchHtmlFast(kpSearch, 'поиск Кинопоиска');
  const kpId = extractKinopoiskId(html);

  if (!kpId) throw new Error('Не найден ID фильма на Кинопоиске');
  const url = `https://www.kkpoisk.ru/film/${kpId}/`;
  kinopoiskCache.set(imdbId, url);
  addLog(`Найдена ссылка СМОТРЕТЬ: kkpoisk /film/${kpId}/`);
  return url;
}

function renderMovie(movie, details) {
  titleEl.textContent = `${movie.title} (${details.ruTitle})`;
  ratingChipEl.textContent = `IMDb: ${details.rating}`;
  votesChipEl.textContent = `Оценок: ${numberRu(details.votes)}`;
  rankChipEl.textContent = `Позиция: ТОП ${movie.rank}`;
  descriptionEl.textContent = details.ruDescription;
  posterEl.src = movie.image || 'https://placehold.co/400x600/0d1530/eaf0ff?text=Нет+постера';
  movieLinkEl.href = movie.imdbUrl;
  watchLinkEl.href = details.watchUrl;
  selectedRankEl.textContent = `ТОП ${movie.rank}`;
  movieCard.classList.remove('hidden');
}

async function handleRandom() {
  randomBtn.disabled = true;
  movieCard.classList.add('hidden');

  try {
    const year = randomInt(YEAR_MIN, YEAR_MAX);
    const searchUrl = buildImdbSearchUrl(year);
    selectedYearEl.textContent = String(year);
    selectedRankEl.textContent = '—';
    updateSearchButton(searchUrl);

    addLog(`Выбран год: ${year}`);
    setStatus('Получаю выдачу IMDb...', 'warn');

    const searchHtml = await fetchHtmlFast(searchUrl, 'поиск IMDb');
    const movies = extractSearchMovies(searchHtml);

    if (!movies.length) throw new Error('IMDb не вернул первые 10 фильмов');
    addLog(`Получено фильмов в первых ${TOP_LIMIT}: ${movies.length}`);

    const movie = movies[randomInt(0, movies.length - 1)];
    addLog(`Случайный выбор: ТОП ${movie.rank} — ${movie.title} (${movie.id})`);

    setStatus('Получаю рейтинг и оценки IMDb...', 'warn');
    const movieHtml = await fetchHtmlFast(movie.imdbUrl, `фильм ${movie.id}`);
    const ratingData = extractRatingAndVotes(movieHtml);

    setStatus('Перевожу описание на русский...', 'warn');
    const ruDescription = await translateToRussian(movie.description);
    const ruTitle = await translateToRussian(movie.title);

    setStatus('Ищу ссылку для кнопки «СМОТРЕТЬ»...', 'warn');
    const watchUrl = await findWatchUrl(movie.title, year, movie.id);

    renderMovie(movie, {
      rating: ratingData.rating,
      votes: ratingData.votes,
      ruDescription,
      ruTitle,
      watchUrl
    });

    addLog('Карточка фильма успешно сформирована.');
    setStatus('Готово! Фильм найден.', 'good');
  } catch (error) {
    addLog(`Ошибка: ${error.message}`, 'error');
    setStatus(`Ошибка: ${error.message}`, 'error');
  } finally {
    randomBtn.disabled = false;
  }
}

randomBtn.addEventListener('click', handleRandom);
updateSearchButton('');
