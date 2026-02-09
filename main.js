const YEAR_MIN = 1975;
const YEAR_MAX = 2025;
const MAX_RESULTS = 50;

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

const parser = new DOMParser();

const proxyBuilders = [
  {
    name: 'allorigins',
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  },
  {
    name: 'corsproxy',
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
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('ru-RU').format(number);
}

async function fetchWithFallback(url, note) {
  let lastError = null;

  for (let i = 0; i < proxyBuilders.length; i += 1) {
    const proxy = proxyBuilders[i];
    const proxiedUrl = proxy.build(url);

    try {
      setStatus(`Загрузка (${note}) через ${proxy.name}...`, 'warning');
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
      if (!text || text.length < 50) {
        throw new Error('Пустой или слишком короткий ответ');
      }

      return { text, source: proxy.name };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Не удалось загрузить данные через все источники. Последняя ошибка: ${lastError?.message || 'неизвестно'}`);
}

function extractMoviesFromSearchHtml(html) {
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a[href^="/title/tt"]'));

  const uniqueMovies = [];
  const seen = new Set();

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/title\/(tt\d+)\/?/);
    if (!match) continue;

    const id = match[1];
    if (seen.has(id)) continue;

    const title = link.textContent.trim();
    if (!title) continue;

    seen.add(id);
    uniqueMovies.push({
      id,
      title,
      url: `https://www.imdb.com/title/${id}/`
    });

    if (uniqueMovies.length >= MAX_RESULTS) break;
  }

  return uniqueMovies;
}

function extractMovieDetails(html) {
  const doc = parser.parseFromString(html, 'text/html');

  const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  let movieJson = null;

  for (const script of jsonLdScripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const candidates = Array.isArray(data) ? data : [data];

      const found = candidates.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const type = item['@type'];
        return type === 'Movie' || (Array.isArray(type) && type.includes('Movie'));
      });

      if (found) {
        movieJson = found;
        break;
      }
    } catch {
      // ignore malformed json-ld blocks
    }
  }

  const title = movieJson?.name || doc.querySelector('h1')?.textContent?.trim() || 'Без названия';
  const rating = movieJson?.aggregateRating?.ratingValue || null;
  const votes = movieJson?.aggregateRating?.ratingCount || null;
  const image = movieJson?.image || '';
  const description = movieJson?.description || '';

  return { title, rating, votes, image, description };
}

async function translateToRussian(text) {
  if (!text) return 'Описание недоступно.';

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map((part) => part?.[0] || '').join('')
      : '';

    if (translated.trim()) {
      return translated.trim();
    }
  } catch {
    // try fallback below
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ru`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const translated = data?.responseData?.translatedText || '';
    if (translated.trim()) {
      return translated.trim();
    }
  } catch {
    // no-op
  }

  return `${text} (не удалось автоматически перевести на русский)`;
}

function renderMovieCard(movie, details, year, rank) {
  titleEl.textContent = details.title || movie.title;
  ratingChipEl.textContent = `IMDb: ${details.rating || '—'}`;
  votesChipEl.textContent = `Оценок: ${numberWithSpaces(details.votes)}`;
  rankChipEl.textContent = `Позиция: ТОП ${rank}`;
  descriptionEl.textContent = details.description;

  posterEl.src = details.image || 'https://placehold.co/400x600/11172b/e8eeff?text=Нет+постера';
  posterEl.alt = `Постер: ${details.title || movie.title}`;

  movieLinkEl.href = movie.url;
  selectedYearEl.textContent = String(year);
  selectedRankEl.textContent = `ТОП ${rank}`;

  cardEl.classList.remove('hidden');
}

async function handleRandom() {
  randomBtn.disabled = true;
  cardEl.classList.add('hidden');
  selectedRankEl.textContent = '—';

  try {
    const year = randomInt(YEAR_MIN, YEAR_MAX);
    selectedYearEl.textContent = String(year);

    const searchUrl = `https://www.imdb.com/search/title/?title_type=feature&release_date=${year}-01-01,${year}-12-31`;

    searchLink.href = searchUrl;
    searchLink.style.display = 'inline-flex';

    const searchResponse = await fetchWithFallback(searchUrl, 'поиск IMDb');

    setStatus(`Парсим выдачу IMDb за ${year} год (источник: ${searchResponse.source})...`, 'warning');
    const movies = extractMoviesFromSearchHtml(searchResponse.text);

    if (!movies.length) {
      throw new Error('Не удалось найти фильмы в выдаче IMDb. Попробуйте ещё раз.');
    }

    const randomIndex = randomInt(0, movies.length - 1);
    const selectedMovie = movies[randomIndex];
    const rank = randomIndex + 1;

    setStatus(`Выбран фильм с позицией ТОП ${rank}. Загружаем карточку фильма...`, 'warning');
    const movieResponse = await fetchWithFallback(selectedMovie.url, `фильм ${selectedMovie.id}`);

    const details = extractMovieDetails(movieResponse.text);
    const ruDescription = await translateToRussian(details.description || 'Описание отсутствует.');
    details.description = ruDescription;

    renderMovieCard(selectedMovie, details, year, rank);
    setStatus(`Готово! Найден фильм «${details.title}».`, 'good');
  } catch (error) {
    setStatus(`Ошибка: ${error.message}`, 'error');
  } finally {
    randomBtn.disabled = false;
  }
}

randomBtn.addEventListener('click', handleRandom);
setStatus('Нажмите «Рандом», чтобы подобрать фильм.', 'good');
