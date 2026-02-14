const YEAR_MIN = 1975;
const YEAR_MAX = 2025;
const TOP_LIMIT = 10;
const FETCH_TIMEOUT_MS = 14000;
const LOG_LIMIT = 30;
const MAX_ATTEMPTS = 8;

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
  { name: 'codetabs', build: (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}` },
  { name: 'corsproxy.io', build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'thingproxy', build: (url) => `https://thingproxy.freeboard.io/fetch/${url}` },
  { name: 'r.jina.ai', build: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}` }
];

function getProxiesForLabel(label) {
  const normalized = (label || '').toLowerCase();

  // На IMDb сначала пробуем самые стабильные, r.jina.ai оставляем последним шансом.
  if (normalized.includes('imdb')) {
    const preferredOrder = ['allorigins', 'codetabs', 'thingproxy', 'corsproxy.io', 'r.jina.ai'];
    return preferredOrder
      .map((name) => proxyBuilders.find((proxy) => proxy.name === name))
      .filter(Boolean);
  }

  return proxyBuilders;
}

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
  const n = Number((value || '').toString().replace(/[\s,]+/g, ''));
  return Number.isFinite(n) ? new Intl.NumberFormat('ru-RU').format(n) : '—';
}

function buildImdbSearchUrl(year) {
  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${year}-01-01,${year}-12-31`;
}

function updateSearchButton(url) {
  imdbSearchBtn.href = url || '#';
  imdbSearchBtn.classList.toggle('disabled', !url);
}

async function fetchOne(url, label, sourceName = 'direct') {
  const timer = withTimeout(FETCH_TIMEOUT_MS);
  try {
    addLog(`Запрос к ${label} через ${sourceName}...`);
    const response = await fetch(url, {
      method: 'GET',
      signal: timer.signal,
      headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text || text.trim().length < 50) throw new Error('Пустой/короткий ответ');

    addLog(`${label}: ответ получен через ${sourceName}.`);
    return text;
  } catch (error) {
    const reason = error?.name === 'AbortError' ? `таймаут ${FETCH_TIMEOUT_MS}мс` : error.message;
    throw new Error(`${sourceName}: ${reason}`);
  } finally {
    timer.clear();
  }
}

async function fetchHtml(url, label) {
  const errors = [];
  const activeProxies = getProxiesForLabel(label);

  try {
    return await fetchOne(url, label, 'direct');
  } catch (error) {
    errors.push(error.message);
    addLog(`Прямой запрос не сработал (${label}): ${error.message}`, 'warn');
  }

  for (const proxy of activeProxies) {
    const proxiedUrl = proxy.build(url);
    try {
      return await fetchOne(proxiedUrl, label, proxy.name);
    } catch (error) {
      errors.push(error.message);
      addLog(`Источник не сработал (${label}): ${error.message}`, 'warn');
    }
  }

  throw new Error(`${label}: все источники недоступны (${errors.join(' | ')})`);
}

async function fetchImdbSearchHtml(searchUrl) {
  const variants = [
    `${searchUrl}&count=${TOP_LIMIT}&view=simple`,
    `${searchUrl}&count=${TOP_LIMIT}`,
    searchUrl
  ];

  const errors = [];
  for (const variantUrl of variants) {
    try {
      return await fetchHtml(variantUrl, 'поиск IMDb');
    } catch (error) {
      errors.push(error.message);
      addLog(`IMDb-вариант не сработал: ${error.message}`, 'warn');
    }
  }

  throw new Error(`поиск IMDb: варианты запроса не сработали (${errors.join(' | ')})`);
}

function parseVotesFromText(text) {
  const m = clean(text).match(/\(([^)]+)\)/);
  if (!m?.[1]) return '—';
  const raw = m[1].replace(/,/g, '').toUpperCase();
  if (raw.endsWith('K')) return Math.round(Number(raw.slice(0, -1)) * 1000);
  if (raw.endsWith('M')) return Math.round(Number(raw.slice(0, -1)) * 1000000);
  const n = Number(raw);
  return Number.isFinite(n) ? n : '—';
}

function extractSearchMovies(html) {
  const doc = parser.parseFromString(html, 'text/html');
  const items = Array.from(doc.querySelectorAll('li.ipc-metadata-list-summary-item')).slice(0, TOP_LIMIT);

  return items
    .map((item, idx) => {
      const link = item.querySelector('a[href*="/title/tt"]');
      const href = link?.getAttribute('href') || '';
      const id = (href.match(/(tt\d+)/) || [])[1];
      if (!id) return null;

      const rawTitle = clean(item.querySelector('h3')?.textContent || link.textContent);
      const title = rawTitle.replace(/^\d+\.\s*/, '').trim();

      const ratingText = clean(item.querySelector('span.ipc-rating-star--rating')?.textContent);
      const votesText = clean(item.querySelector('span.ipc-rating-star--voteCount')?.textContent);
      const description = clean(item.querySelector('.ipc-html-content-inner-div')?.textContent);
      const poster = item.querySelector('img')?.getAttribute('src') || '';

      return {
        id,
        rank: idx + 1,
        title: title || 'Без названия',
        imdbUrl: `https://www.imdb.com/title/${id}/`,
        rating: ratingText || '—',
        votes: parseVotesFromText(votesText),
        description: description || 'Описание отсутствует.',
        poster
      };
    })
    .filter(Boolean);
}

async function translateToRussian(text, label) {
  const src = clean(text);
  if (!src) return label === 'title' ? 'Название на русском не найдено' : 'Описание отсутствует.';
  if (translationCache.has(src)) return translationCache.get(src);

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(src)}`;

  try {
    const raw = await fetchHtml(url, label === 'title' ? 'перевод названия' : 'перевод описания');
    const data = JSON.parse(raw);
    const translated = (data?.[0] || []).map((row) => row?.[0] || '').join('').trim();
    const result = translated || src;
    translationCache.set(src, result);
    return result;
  } catch (error) {
    addLog(`Перевод не выполнен, оставляем исходный текст: ${error.message}`, 'warn');
    return src;
  }
}

function extractKinopoiskId(html) {
  const direct = html.match(/https?:\/\/(?:www\.)?kinopoisk\.ru\/film\/(\d+)\//i);
  if (direct?.[1]) return direct[1];

  const alt = html.match(/\/film\/(\d+)\//);
  if (alt?.[1]) return alt[1];

  return null;
}

async function findWatchUrl(title, year, imdbId) {
  if (kinopoiskCache.has(imdbId)) return kinopoiskCache.get(imdbId);

  const queries = [`${title} ${year}`, `${title}`, imdbId];
  for (const q of queries) {
    const searchUrl = `https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(q)}`;
    try {
      const html = await fetchHtml(searchUrl, `поиск Кинопоиска (${q})`);
      const kpId = extractKinopoiskId(html);
      if (kpId) {
        const kk = `https://www.kkpoisk.ru/film/${kpId}/`;
        kinopoiskCache.set(imdbId, kk);
        addLog(`Найдена ссылка СМОТРЕТЬ: kkpoisk /film/${kpId}/`);
        return kk;
      }
      addLog(`Кинопоиск не вернул ID для запроса: ${q}`, 'warn');
    } catch (error) {
      addLog(`Ошибка поиска Кинопоиска (${q}): ${error.message}`, 'warn');
    }
  }

  throw new Error('Не удалось найти карточку фильма на Кинопоиске');
}

function renderMovie(movie, ruTitle, ruDescription, watchUrl, year) {
  titleEl.textContent = `${movie.title} (${ruTitle})`;
  ratingChipEl.textContent = `IMDb: ${movie.rating || '—'}`;
  votesChipEl.textContent = `Оценок: ${numberRu(movie.votes)}`;
  rankChipEl.textContent = `Позиция: ТОП ${movie.rank}`;
  descriptionEl.textContent = ruDescription;

  posterEl.src = movie.poster || 'https://placehold.co/400x600/0d1530/eaf0ff?text=Нет+постера';
  posterEl.alt = `Постер: ${movie.title}`;

  movieLinkEl.href = movie.imdbUrl;
  watchLinkEl.href = watchUrl;
  selectedYearEl.textContent = String(year);
  selectedRankEl.textContent = `ТОП ${movie.rank}`;
  movieCard.classList.remove('hidden');
}

async function performAttempt(attempt) {
  const year = randomInt(YEAR_MIN, YEAR_MAX);
  const searchUrl = buildImdbSearchUrl(year);

  selectedYearEl.textContent = String(year);
  selectedRankEl.textContent = '—';
  updateSearchButton(searchUrl);

  addLog(`Попытка ${attempt}/${MAX_ATTEMPTS}. Выбран год: ${year}`);

  setStatus('Получаю выдачу IMDb...', 'warn');
  const searchHtml = await fetchImdbSearchHtml(searchUrl);
  const movies = extractSearchMovies(searchHtml);

  if (!movies.length) throw new Error('IMDb не вернул подходящие фильмы в ТОП-10');

  addLog(`Получено фильмов в первых ${TOP_LIMIT}: ${movies.length}`);
  const movie = movies[randomInt(0, movies.length - 1)];
  addLog(`Случайный выбор: ТОП ${movie.rank} — ${movie.title} (${movie.id})`);

  setStatus('Перевожу данные на русский...', 'warn');
  const [ruTitle, ruDescription] = await Promise.all([
    translateToRussian(movie.title, 'title'),
    translateToRussian(movie.description, 'description')
  ]);

  setStatus('Ищу ссылку для кнопки «СМОТРЕТЬ»...', 'warn');
  const watchUrl = await findWatchUrl(movie.title, year, movie.id);

  renderMovie(movie, ruTitle, ruDescription, watchUrl, year);
}

async function handleRandom() {
  randomBtn.disabled = true;
  movieCard.classList.add('hidden');
  logsListEl.innerHTML = '';

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await performAttempt(attempt);
      setStatus('Готово! Фильм найден.', 'good');
      addLog('Карточка фильма успешно сформирована.');
      randomBtn.disabled = false;
      return;
    } catch (error) {
      lastError = error;
      addLog(`Ошибка на попытке ${attempt}: ${error.message}`, 'error');
      setStatus(`Попытка ${attempt} не удалась, пробую снова...`, 'warn');
    }
  }

  setStatus(`Не удалось подобрать фильм. Причина: ${lastError?.message || 'неизвестная ошибка'}`, 'error');
  randomBtn.disabled = false;
}

randomBtn.addEventListener('click', handleRandom);
updateSearchButton('');
setStatus('Нажмите «Рандом», чтобы начать.', 'good');
