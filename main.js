const MIN_YEAR = 1975;
const MAX_YEAR = 2025;

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

function buildImdbUrl(year, minVotes, maxVotes) {
  const releaseDate = `${year}-01-01,${year}-12-31`;
  const numVotes = maxVotes === null ? `${minVotes},` : `${minVotes},${maxVotes}`;

  return `https://www.imdb.com/search/title/?title_type=feature&release_date=${releaseDate}&num_votes=${numVotes}`;
}

function formatVotes(minVotes, maxVotes) {
  const formatter = new Intl.NumberFormat('ru-RU');

  if (maxVotes === null) {
    return `от ${formatter.format(minVotes)} и выше`;
  }

  return `${formatter.format(minVotes)} — ${formatter.format(maxVotes)}`;
}

function generateRandomResult() {
  const year = randomInt(MIN_YEAR, MAX_YEAR);
  const tier = randomInt(1, 11);
  const { minVotes, maxVotes } = getVotesRangeByTier(tier);
  const imdbUrl = buildImdbUrl(year, minVotes, maxVotes);

  return { year, tier, minVotes, maxVotes, imdbUrl };
}

const randomizeBtn = document.getElementById('randomizeBtn');
const resultSection = document.getElementById('result');
const yearValue = document.getElementById('yearValue');
const tierValue = document.getElementById('tierValue');
const votesValue = document.getElementById('votesValue');
const imdbLink = document.getElementById('imdbLink');

randomizeBtn.addEventListener('click', () => {
  const { year, tier, minVotes, maxVotes, imdbUrl } = generateRandomResult();

  yearValue.textContent = String(year);
  tierValue.textContent = String(tier);
  votesValue.textContent = formatVotes(minVotes, maxVotes);
  imdbLink.href = imdbUrl;
  imdbLink.textContent = imdbUrl;

  resultSection.style.display = 'block';
});
