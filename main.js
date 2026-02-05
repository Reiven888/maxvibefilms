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
    // fallback без CORS-прокси; возвращает текстовую версию страницы
    name: 'jina-reader',
    buildUrl: (url) => `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
  },
];

const state = {
  movies: [],
  currentIndex: -1,
  currentSearchUrl: '',
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getVotesRangeByTier(tier) {
  if (tier === 1) {
    return { minVotes: 20000, maxVotes: 100000 };
  }

  if (tier === 11) {
    return { minVotes: 1000001, maxVotes: null };
  }

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
  if (maxVotes === null) {
    return `от ${formatter.format(minVotes)} и выше`;
  }
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
      if (!response.ok) {
        throw new Error(`${strategy.name}: HTTP ${response.status}`);
      }

      const text = await response.text();
      if (!text || text.length < 200) {
        throw new Error(`${strategy.name}: пустой ответ`);
      }

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

  const cardSelectors = [
    '[data-testid="title-list-item"]',
    '.lister-item.mode-advanced',
    '.ipc-metadata-list-summary-item',
  ];

  let cards = [];
  for (const selector of cardSelectors) {
    cards = [...doc.querySelectorAll(selector)];
    if (cards.length > 0) break;
  }

  const movies = [];

  for (const card of cards) {
    const titleLink = card.querySelector('a[href*="/title/tt"]');
    const href = titleLink?.getAttribute('href') || '';
    const match = href.match(/\/title\/(tt\d+)\//);
    if (!match) continue;

    const imdbId = match[1];
    const url = `https://www.imdb.com/title/${imdbId}/`;

    const title =
      titleLink?.textContent?.trim() ||
      card.querySelector('h3')?.textContent?.trim() ||
      'Без названия';

    const ratingNode =
      card.querySelector('[data-testid="rating-group--imdb-rating"]') ||
      card.querySelector('.ratings-imdb-rating strong') ||
      card.querySelector('[aria-label*="IMDb rating"]');
    const ratingText = ratingNode?.textContent?.trim() || '';
    const ratingMatch = ratingText.match(/\d(?:\.\d)?/);
    const rating = ratingMatch ? ratingMatch[0] : null;

    const votesText = card.textContent || '';
    const votesMatch = votesText.match(/([\d,\.\s]+)\s*votes/i);
    const votes = votesMatch ? votesMatch[1].replace(/[\s,.](?=\d{3}\b)/g, '') : null;

    const description =
      card.querySelector('[data-testid="plot"]')?.textContent?.trim() ||
      card.querySelector('.text-muted')?.textContent?.trim() ||
      'Краткое описание отсутствует.';

    const imageRaw = card.querySelector('img')?.getAttribute('src') || '';

    movies.push({
      imdbId,
      title,
      rating,
      votes,
      description,
      image: normalizePosterUrl(imageRaw),
      url,
    });
  }

  if (movies.length > 0) {
    return movies;
  }

  const fallbackIds = [...new Set((html.match(/tt\d{7,9}/g) || []))];
  return fallbackIds.map((id) => ({
    imdbId: id,
    title: `Фильм ${id}`,
    rating: null,
    votes: null,
    description: 'Подробности не удалось извлечь, но ссылку на фильм можно открыть в IMDb.',
    image: '',
    url: `https://www.imdb.com/title/${id}/`,
  }));
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
  movieDescription.textContent = movie.description;
  movieRating.textContent = `⭐ Рейтинг: ${movie.rating ?? '—'}`;
  movieVotes.textContent = `🗳 Оценок: ${formatVotesCount(movie.votes)}`;

  if (movie.url) {
    movieLink.href = movie.url;
    movieLink.style.display = 'inline-block';
  } else {
    movieLink.style.display = 'none';
  }

  if (movie.image) {
    poster.src = movie.image;
    poster.alt = `Постер: ${movie.title}`;
  } else {
    poster.removeAttribute('src');
    poster.alt = 'Постер недоступен';
  }
}

function showMovieByIndex(index) {
  const movie = state.movies[index];
  if (!movie) {
    statusText.textContent = 'Нет фильма, поэтому нужна новая подборка.';
    nextMovieBtn.disabled = true;
    return;
  }

  renderMovie(movie);
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
    imdbSearchLink.textContent = imdbUrl;

    resultSection.style.display = 'block';
    state.currentSearchUrl = imdbUrl;

    const { text: searchHtml, strategy } = await fetchHtmlWithFallback(imdbUrl);
    state.movies = parseMoviesFromSearch(searchHtml);
    state.currentIndex = -1;

    if (state.movies.length === 0) {
      statusText.textContent = 'IMDb не вернул фильмы по этой выборке. Нажми «Рандом» ещё раз.';
      nextMovieBtn.disabled = true;
      return;
    }

    showMovieByIndex(0);
    statusText.textContent += ` Источник: ${strategy}.`;
  } catch (error) {
    statusText.textContent = `Ошибка загрузки подборки: ${error.message}. Попробуй ещё раз.`;
    nextMovieBtn.disabled = true;
  } finally {
    setLoading(false);
  }
}

function showNextMovie() {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.movies.length) {
    statusText.textContent = 'Нет фильма, поэтому новая подборка. Нажми «Рандом». ';
    nextMovieBtn.disabled = true;
    return;
  }

  showMovieByIndex(nextIndex);
}

randomizeBtn.addEventListener('click', () => {
  generateSelection();
});

nextMovieBtn.addEventListener('click', () => {
  showNextMovie();
});
