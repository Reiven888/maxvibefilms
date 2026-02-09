const MIN_YEAR = 1975;
const MAX_YEAR = 2025;

const FETCH_STRATEGIES = [
  {
    name: 'allorigins',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'corsproxy.io',
    buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'r.jina.ai',
    buildUrl: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
  },
];

const state = {
  movies: [],
  currentIndex: -1,
  isLoading: false,
};

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
  const numeric = Number(String(votesCount).replace(/\s/g, '').replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('ru-RU').format(numeric);
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
      if (!text || text.length < 100) throw new Error(`${strategy.name}: слишком короткий ответ`);

      return { text, strategy: strategy.name };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'не удалось получить данные из fallback-источников');
}

function parseMoviesFromSearch(html) {
  const ids = [...new Set((html.match(/\/title\/(tt\d{7,9})\//g) || []).map((hit) => hit.match(/tt\d{7,9}/)?.[0]).filter(Boolean))];

  return ids.map((id) => ({
    imdbId: id,
    url: `https://www.imdb.com/title/${id}/`,
    detailsLoaded: false,
    title: `Фильм ${id}`,
    rating: null,
    votes: null,
    description: 'Загрузка описания... ',
    image: '',
  }));
}

function extractMovieJsonLd(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data)
        ? data
        : Array.isArray(data['@graph'])
          ? data['@graph']
          : [data];

      const movieNode = nodes.find((node) => {
        const type = node?.['@type'];
        if (Array.isArray(type)) return type.includes('Movie');
        return type === 'Movie';
      });

      if (movieNode) return movieNode;
    } catch {
      // пропускаем сломанный блок
    }
  }

  return null;
}

function normalizePosterUrl(raw) {
  if (!raw) return '';
  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `https://www.imdb.com${raw}`;
  return '';
}

async function loadMovieDetails(movie) {
  if (movie.detailsLoaded) return movie;

  const { text } = await fetchHtmlWithFallback(movie.url);
  const ldMovie = extractMovieJsonLd(text);

  if (!ldMovie) {
    movie.detailsLoaded = true;
    movie.description = 'Описание недоступно. Можно открыть карточку фильма на IMDb.';
    return movie;
  }

  movie.title = ldMovie.name || movie.title;
  movie.description = ldMovie.description || 'Описание недоступно.';
  movie.image = normalizePosterUrl(ldMovie.image || '');

  const ratingValue = ldMovie.aggregateRating?.ratingValue;
  const ratingCount = ldMovie.aggregateRating?.ratingCount;
  movie.rating = ratingValue ? String(ratingValue) : null;
  movie.votes = ratingCount ? String(ratingCount) : null;
  movie.detailsLoaded = true;

  return movie;
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  randomizeBtn.disabled = isLoading;
  nextMovieBtn.disabled = isLoading || state.movies.length === 0;
  randomizeBtn.textContent = isLoading ? 'Загрузка…' : 'Рандом';
}

function renderMovie(movie) {
  movieTitle.textContent = movie.title;
  movieDescription.textContent = movie.description;
  movieRating.textContent = `⭐ Рейтинг IMDb: ${movie.rating ?? '—'}`;
  movieVotes.textContent = `🗳 Оценок: ${formatVotesCount(movie.votes)}`;

  movieLink.href = movie.url;
  movieLink.style.display = 'inline-block';

  if (movie.image) {
    poster.src = movie.image;
    poster.alt = `Постер фильма «${movie.title}»`;
  } else {
    poster.removeAttribute('src');
    poster.alt = 'Постер недоступен';
  }
}

async function showMovieByIndex(index) {
  const movie = state.movies[index];
  if (!movie) {
    statusText.textContent = 'Нет фильма, поэтому новая подборка. Нажми «Рандом».';
    nextMovieBtn.disabled = true;
    return;
  }

  nextMovieBtn.disabled = true;
  statusText.textContent = `Загружаю фильм ${index + 1} из ${state.movies.length}...`;

  try {
    await loadMovieDetails(movie);
    renderMovie(movie);
    state.currentIndex = index;

    statusText.textContent = `Фильм ${index + 1} из ${state.movies.length}. Если уже видел — жми «Я уже видел».`;
    nextMovieBtn.disabled = false;
  } catch (error) {
    statusText.textContent = `Не удалось загрузить карточку фильма: ${error.message}. Попробуй «Я уже видел» или «Рандом».`;
    nextMovieBtn.disabled = false;
  }
}

async function generateSelection() {
  setLoading(true);
  statusText.textContent = 'Формирую новую подборку IMDb...';

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
      statusText.textContent = 'Фильмы в выдаче не найдены. Нажми «Рандом», чтобы попробовать ещё раз.';
      nextMovieBtn.disabled = true;
      return;
    }

    await showMovieByIndex(0);
    statusText.textContent += ` Источник поиска: ${strategy}.`;
  } catch (error) {
    state.movies = [];
    state.currentIndex = -1;
    statusText.textContent = `Ошибка загрузки подборки: ${error.message}. Попробуй ещё раз.`;
    nextMovieBtn.disabled = true;
  } finally {
    setLoading(false);
  }
}

async function showNextMovie() {
  if (state.isLoading) return;

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.movies.length) {
    statusText.textContent = 'Нет фильма, поэтому новая подборка. Нажми «Рандом».';
    nextMovieBtn.disabled = true;
    return;
  }

  await showMovieByIndex(nextIndex);
}

randomizeBtn.addEventListener('click', generateSelection);
nextMovieBtn.addEventListener('click', showNextMovie);
