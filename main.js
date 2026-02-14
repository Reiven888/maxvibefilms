const YEAR_MIN = 1975;
const YEAR_MAX = 2025;
const MAX_RESULTS = 50;
const MAX_SEARCH_RETRIES = 20;

const randomBtn = document.getElementById('randomBtn');
const searchLink = document.getElementById('searchLink');
const selectedYearEl = document.getElementById('selectedYear');
const selectedRankEl = document.getElementById('selectedRank');
const statusEl = document.getElementById('status');

const cardEl = document.getElementById('movieCard');
const titleEl = document.getElementById('title');
const ratingChipEl = document.getElementById('ratingChip');
const votesChipEl = document.getElementById('votesChip');
const rankChipEl = document.getElementById('rankChip');
const descriptionEl = document.getElementById('description');
const posterEl = document.getElementById('poster');
const movieLinkEl = document.getElementById('movieLink');
const watchLinkEl = document.getElementById('watchLink');

const parser = new DOMParser();

const proxyBuilders = [
  {
    name: 'allorigins',
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  },
  {
    name: 'corsproxy.io',
    build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  },
  {
    name: 'r.jina.ai',
    build: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  }
];

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function numberWithSpaces(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('ru-RU').format(num);
}

function buildSearchUrl(year) {
  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${year}-01-01,${year}-12-31`;
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

async function fetchWithFallback(url, label) {
  let lastError = null;

  for (const proxy of proxyBuilders) {
    const proxiedUrl = proxy.build(url);

    try {
      setStatus(`Загрузка (${label}) через ${proxy.name}...`, 'warning');
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      if (!text || text.trim().length < 80) {
        throw new Error('Пустой или слишком короткий ответ');
      }

      return { text, source: proxy.name };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Все источники недоступны. Последняя ошибка: ${lastError?.message || 'неизвестно'}`);
}

function extractMoviesFromSearchHtml(html) {
  const doc = parser.parseFromString(html, 'text/html');
  const rankedItems = Array.from(doc.querySelectorAll('li.ipc-metadata-list-summary-item'));

  const movies = [];
  const seen = new Set();

  for (const item of rankedItems) {
    const link = item.querySelector('a[href^="/title/tt"]');
    if (!link) continue;

    const href = link.getAttribute('href') || '';
    const idMatch = href.match(/\/title\/(tt\d+)\/?/);
    if (!idMatch) continue;

    const id = idMatch[1];
    if (seen.has(id)) continue;

    const title = cleanText(link.textContent);
    if (!title) continue;

    seen.add(id);
    movies.push({
      id,
      title,
      url: `https://www.imdb.com/title/${id}/`
    });

    if (movies.length >= MAX_RESULTS) {
      break;
    }
  }

  if (!movies.length) {
    const links = Array.from(doc.querySelectorAll('a[href^="/title/tt"]'));

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/\/title\/(tt\d+)\/?/);
      if (!idMatch) continue;

      const id = idMatch[1];
      if (seen.has(id)) continue;

      const title = cleanText(link.textContent);
      if (!title || /^(episodes?|photos?|cast|more)$/i.test(title)) continue;

      seen.add(id);
      movies.push({ id, title, url: `https://www.imdb.com/title/${id}/` });

      if (movies.length >= MAX_RESULTS) {
        break;
      }
    }
  }

  return movies.slice(0, MAX_RESULTS);
}

function extractMovieDetails(html) {
  const doc = parser.parseFromString(html, 'text/html');
  const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));

  let movieJson = null;

  for (const script of jsonLdScripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed];

      const found = list.find((item) => {
        const type = item?.['@type'];
        return type === 'Movie' || (Array.isArray(type) && type.includes('Movie'));
      });

      if (found) {
        movieJson = found;
        break;
      }
    } catch {
      // Пропускаем битые JSON-LD блоки.
    }
  }

  const originalTitle = cleanText(movieJson?.name || doc.querySelector('h1')?.textContent || '');
  const rating = cleanText(String(movieJson?.aggregateRating?.ratingValue || ''));
  const votes = cleanText(String(movieJson?.aggregateRating?.ratingCount || ''));
  const image = cleanText(String(movieJson?.image || ''));
  const description = cleanText(movieJson?.description || '');

  return { originalTitle, rating, votes, image, description };
}

async function translateToRussian(text) {
  if (!text || !text.trim()) {
    throw new Error('Отсутствует текст для перевода');
  }

  const cleaned = text.trim();

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(cleaned)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((chunk) => chunk?.[0] || '').join('') : '';

    if (translated && translated.trim()) {
      return translated.trim();
    }
  } catch {
    // fallback ниже
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=en|ru`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const translated = data?.responseData?.translatedText || '';

    if (translated && translated.trim()) {
      return translated.trim();
    }
  } catch {
    // fallback ниже
  }

  return `${cleaned} (автоперевод недоступен)`;
}

function extractKpId(html) {
  const matches = html.match(/\/film\/(\d+)\//g) || [];
  for (const match of matches) {
    const idMatch = match.match(/\/(\d+)\//);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
  }
  return '';
}

async function findKinopoiskData(movie, details, year) {
  const query = encodeURIComponent(`${details.originalTitle} ${year}`);
  const searchUrl = `https://www.kinopoisk.ru/index.php?kp_query=${query}`;

  const response = await fetchWithFallback(searchUrl, 'поиск на Кинопоиске');
  const kpId = extractKpId(response.text);

  if (!kpId) {
    throw new Error('Не удалось найти карточку фильма на Кинопоиске');
  }

  const kpUrl = `https://www.kinopoisk.ru/film/${kpId}/`;
  const kkUrl = `https://www.kkpoisk.ru/film/${kpId}/`;

  let russianTitle = '';
  try {
    const kpPage = await fetchWithFallback(kpUrl, `страница Кинопоиска ${kpId}`);
    const doc = parser.parseFromString(kpPage.text, 'text/html');
    russianTitle = cleanText(doc.querySelector('h1')?.textContent || doc.querySelector('title')?.textContent || '');
    russianTitle = russianTitle.replace(/\s*\(Кинопоиск\).*$/i, '').trim();
  } catch {
    russianTitle = '';
  }

  if (!russianTitle) {
    russianTitle = await translateToRussian(details.originalTitle || movie.title);
  }

  return { kpId, kpUrl, kkUrl, russianTitle };
}

function validateMovie(details, kinopoiskData) {
  if (!details.originalTitle || !details.originalTitle.trim()) {
    throw new Error('У фильма отсутствует оригинальное название');
  }

  if (!details.description || !details.description.trim()) {
    throw new Error('У фильма отсутствует описание');
  }

  if (!kinopoiskData?.kkUrl) {
    throw new Error('Не подготовлена ссылка для кнопки «СМОТРЕТЬ»');
  }
}

function renderMovieCard(movie, details, year, rank, kinopoiskData) {
  titleEl.textContent = `${details.originalTitle} (${kinopoiskData.russianTitle})`;
  ratingChipEl.textContent = `IMDb: ${details.rating || '—'}`;
  votesChipEl.textContent = `Оценок: ${numberWithSpaces(details.votes)}`;
  rankChipEl.textContent = `Позиция: ТОП ${rank}`;
  descriptionEl.textContent = details.description;

  posterEl.src = details.image || 'https://placehold.co/400x600/11172b/e8eeff?text=Нет+постера';
  posterEl.alt = `Постер: ${details.originalTitle}`;

  movieLinkEl.href = movie.url;
  watchLinkEl.href = kinopoiskData.kkUrl;
  watchLinkEl.classList.remove('hidden');

  selectedYearEl.textContent = String(year);
  selectedRankEl.textContent = `ТОП ${rank}`;
  cardEl.classList.remove('hidden');
}

async function performSearchAttempt(attempt, totalAttempts) {
  const year = randomInt(YEAR_MIN, YEAR_MAX);
  const searchUrl = buildSearchUrl(year);

  selectedYearEl.textContent = String(year);
  selectedRankEl.textContent = '—';
  searchLink.href = searchUrl;
  searchLink.style.display = 'inline-flex';
  watchLinkEl.classList.add('hidden');

  setStatus(`Попытка ${attempt}/${totalAttempts}: ищем фильмы за ${year} год...`, 'warning');
  const searchResponse = await fetchWithFallback(searchUrl, 'поиск IMDb');

  const movies = extractMoviesFromSearchHtml(searchResponse.text);
  if (!movies.length) {
    throw new Error('IMDb не вернул список фильмов в первых 50 позициях');
  }

  const randomIndex = randomInt(0, movies.length - 1);
  const movie = movies[randomIndex];
  const rank = randomIndex + 1;

  setStatus(`Найден кандидат: ТОП ${rank}. Загружаем страницу фильма...`, 'warning');
  const movieResponse = await fetchWithFallback(movie.url, `фильм ${movie.id}`);
  const details = extractMovieDetails(movieResponse.text);

  details.description = await translateToRussian(details.description || '');

  setStatus(`Ищем этот фильм на Кинопоиске для кнопки «СМОТРЕТЬ»...`, 'warning');
  const kinopoiskData = await findKinopoiskData(movie, details, year);

  validateMovie(details, kinopoiskData);

  return { movie, details, year, rank, kinopoiskData };
}

async function handleRandomClick() {
  randomBtn.disabled = true;
  cardEl.classList.add('hidden');

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_SEARCH_RETRIES; attempt += 1) {
    try {
      const result = await performSearchAttempt(attempt, MAX_SEARCH_RETRIES);
      renderMovieCard(result.movie, result.details, result.year, result.rank, result.kinopoiskData);
      setStatus(`Готово! Фильм найден с попытки ${attempt}. Приятного просмотра ✨`, 'good');
      randomBtn.disabled = false;
      return;
    } catch (error) {
      lastError = error;
      setStatus(`Попытка ${attempt} не удалась: ${error.message}. Перезапускаем поиск...`, 'warning');
    }
  }

  setStatus(
    `Не удалось найти валидный фильм после ${MAX_SEARCH_RETRIES} попыток. Проверьте соединение и повторите. Детали: ${lastError?.message || 'неизвестная ошибка'}`,
    'error'
  );
  randomBtn.disabled = false;
}

randomBtn.addEventListener('click', handleRandomClick);
setStatus('Нажмите «Рандом», чтобы подобрать фильм.', 'good');
