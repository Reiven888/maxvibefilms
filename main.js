const MIN_YEAR = 1975;
const MAX_YEAR = 2025;

const FETCH_STRATEGIES = [
  {
    name: 'allorigins',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'corsproxy',
    buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'jina-reader',
    buildUrl: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
  },
];

const state = {
  movies: [],
  currentIndex: -1,
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getVotesRangeByTier(tier) {
  if (tier === 1) return { minVotes: 20000, maxVotes: 100000 };
  if (tier === 11) return { minVotes: 1000001, maxVotes: null };

  return {
    minVotes: (tier - 1) * 100000 + 1,
    maxVotes: tier * 100000,
  };
}

function buildImdbSearchUrl(year, minVotes, maxVotes) {
  const releaseDate = `${year}-01-01,${year}-12-31`;
  const numVotes = maxVotes === null ? `${minVotes},` : `${minVotes},${maxVotes}`;
  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${releaseDate}&num_votes=${numVotes}`;
}

function formatVotesRange(minVotes, maxVotes) {
  const formatter = new Intl.NumberFormat('ru-RU');
  if (maxVotes === null) return `от ${formatter.format(minVotes)} и выше`;
  return `${formatter.format(minVotes)} — ${formatter.format(maxVotes)}`;
}

function formatVotesCount(votesCount) {
  if (!votesCount) return '—';
  return new Intl.NumberFormat('ru-RU').format(Number(votesCount));
}

function generateCriteria() {
  const year = randomInt(MIN_YEAR, MAX_YEAR);
  const tier = randomInt(1, 11);
  const { minVotes, maxVotes } = getVotesRangeByTier(tier);
  return { year, tier, minVotes, maxVotes };
}

async function fetchHtmlWithFallback(url) {
  let lastError = null;

  for (const strategy of FETCH_STRATEGIES) {
    try {
      const response = await fetch(strategy.buildUrl(url));
      if (!response.ok) throw new Error(`${strategy.name}: HTTP ${response.status}`);

      const text = await response.text();
      if (!text || text.length < 200) throw new Error(`${strategy.name}: пустой ответ`);

      return { text, strategy: strategy.name };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'не удалось загрузить данные');
}

function normalizePosterUrl(raw) {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `https://www.imdb.com${raw}`;
  return '';
}

function parseMoviesFromSearch(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const titleAnchors = [...doc.querySelectorAll('a[href*="/title/tt"]')];

  const unique = new Set();
  const movies = [];

  for (const anchor of titleAnchors) {
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/\/title\/(tt\d+)\//);
    if (!match) continue;

    const imdbId = match[1];
    if (unique.has(imdbId)) continue;
    unique.add(imdbId);

    const title = anchor.textContent?.trim() || `Фильм ${imdbId}`;
    if (title.length < 2) continue;

    movies.push({
      imdbId,
      title,
      rating: null,
      votes: null,
      description: 'Загружаю описание...',
      image: '',
      url: `https://www.imdb.com/title/${imdbId}/`,
      enriched: false,
    });
  }

  return movies;
}

function extractMovieFromLdJson(html, fallbackUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '{}');
      const candidates = Array.isArray(data) ? data : [data];

      for (const item of candidates) {
        if (item?.['@type'] !== 'Movie') continue;

        return {
          title: item.name || 'Без названия',
          rating: item.aggregateRating?.ratingValue || null,
          votes: item.aggregateRating?.ratingCount || null,
          description: item.description || 'Краткое описание отсутствует.',
          image: normalizePosterUrl(item.image || ''),
          url: item.url || fallbackUrl,
        };
      }
    } catch (_) {
      // ignore invalid JSON blocks
    }
  }

  return null;
}

const randomizeBtn = document.getElementById('randomizeBtn');
const nextMovieBtn = document.getElementById('nextMovieBtn');
const resultSection = document.getElementById('result');
const yearValue = document.getElementById('yearValue');
const tierValue = document.getElementById('tierValue');
const votesValue = document.getElementById('votesValue');
const imdbSearchLink = document.getElementById('imdbSearchLink');
const movieTitle = document.getElementById('movieTitle');
const movieRating = document.getElementById('movieRating');
const movieVotes = document.getElementById('movieVotes');
const movieDescription = document.getElementById('movieDescription');
const movieLink = document.getElementById('movieLink');
const poster = document.getElementById('poster');
const statusText = document.getElementById('statusText');

function setLoading(isLoading) {
  randomizeBtn.disabled = isLoading;
  nextMovieBtn.disabled = isLoading || state.movies.length === 0;
  randomizeBtn.textContent = isLoading ? 'Ищу подборку…' : 'Рандом';
}

function renderMovie(movie) {
  movieTitle.textContent = movie.title;
  movieDescription.textContent = movie.description || 'Краткое описание отсутствует.';
  movieRating.textContent = `⭐ Рейтинг: ${movie.rating ?? '—'}`;
  movieVotes.textContent = `🗳 Оценок: ${formatVotesCount(movie.votes)}`;

  movieLink.href = movie.url;
  movieLink.style.display = 'inline-block';

  if (movie.image) {
    poster.src = movie.image;
    poster.alt = `Постер: ${movie.title}`;
  } else {
    poster.removeAttribute('src');
    poster.alt = 'Постер недоступен';
  }
}

async function enrichMovieData(movie) {
  if (movie.enriched) return movie;

  try {
    const { text } = await fetchHtmlWithFallback(movie.url);
    const details = extractMovieFromLdJson(text, movie.url);

    if (details) {
      Object.assign(movie, details, { enriched: true });
      return movie;
    }

    movie.description = 'Краткое описание отсутствует.';
    movie.enriched = true;
    return movie;
  } catch {
    movie.description = movie.description || 'Не удалось загрузить описание. Открой страницу IMDb.';
    movie.enriched = true;
    return movie;
  }
}

async function showMovieByIndex(index) {
  const movie = state.movies[index];
  if (!movie) {
    statusText.textContent = 'Нет фильма, поэтому нужна новая подборка.';
    nextMovieBtn.disabled = true;
    return;
  }

  nextMovieBtn.disabled = true;
  statusText.textContent = `Загружаю фильм ${index + 1} из ${state.movies.length}...`;

  const enriched = await enrichMovieData(movie);
  renderMovie(enriched);

  state.currentIndex = index;
  nextMovieBtn.disabled = false;
  statusText.textContent = `Фильм ${index + 1} из ${state.movies.length}. Если видел — жми «Я уже видел».`;
}

async function generateSelection() {
  setLoading(true);
  statusText.textContent = 'Формирую новую подборку...';

  try {
    const criteria = generateCriteria();
    const imdbUrl = buildImdbSearchUrl(criteria.year, criteria.minVotes, criteria.maxVotes);

    yearValue.textContent = String(criteria.year);
    tierValue.textContent = String(criteria.tier);
    votesValue.textContent = formatVotesRange(criteria.minVotes, criteria.maxVotes);
    imdbSearchLink.href = imdbUrl;
    imdbSearchLink.textContent = 'Открыть IMDb-поиск';

    resultSection.style.display = 'block';

    const { text: searchHtml, strategy } = await fetchHtmlWithFallback(imdbUrl);
    state.movies = parseMoviesFromSearch(searchHtml);
    state.currentIndex = -1;

    if (state.movies.length === 0) {
      statusText.textContent = `IMDb не вернул фильмы по этой выборке. Источник: ${strategy}. Нажми «Рандом» ещё раз.`;
      nextMovieBtn.disabled = true;
      return;
    }

    await showMovieByIndex(0);
    statusText.textContent += ` Источник: ${strategy}.`;
  } catch (error) {
    statusText.textContent = `Ошибка загрузки подборки: ${error.message}. Попробуй ещё раз.`;
    nextMovieBtn.disabled = true;
  } finally {
    setLoading(false);
  }
}

async function showNextMovie() {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.movies.length) {
    statusText.textContent = 'Нет фильма, поэтому новая подборка. Нажми «Рандом». ';
    nextMovieBtn.disabled = true;
    return;
  }

  await showMovieByIndex(nextIndex);
}

randomizeBtn.addEventListener('click', () => {
  generateSelection();
});

nextMovieBtn.addEventListener('click', () => {
  showNextMovie();
});
