import { FilmCriteria, RandomizerResult } from '../types';

export const generateRandomCriteria = (): RandomizerResult => {
  // 1. Select random year from 1975 to 2025
  const minYear = 1975;
  const maxYear = 2025;
  const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;

  // 2. Select random tier from 1 to 11
  const tier = Math.floor(Math.random() * 11) + 1;

  let minVotes = 0;
  let maxVotes: number | null = 0;

  // Logic: 
  // 1: 20k - 100k
  // 2: 100k - 200k
  // ...
  // 10: 900k - 1M
  // 11: 1M+

  if (tier === 1) {
    minVotes = 20000;
    maxVotes = 100000;
  } else if (tier === 11) {
    minVotes = 1000001;
    maxVotes = null; // Infinity
  } else {
    // For tiers 2 through 10
    // Tier 2: starts 100001
    // Tier 3: starts 200001
    minVotes = (tier - 1) * 100000 + 1;
    maxVotes = tier * 100000;
  }

  // 3. Generate URL
  const dateStart = `${year}-01-01`;
  const dateEnd = `${year}-12-31`;
  
  // Construct votes string: "min,max" or just "min," for infinity
  const votesString = maxVotes ? `${minVotes},${maxVotes}` : `${minVotes},`;

  const baseUrl = 'https://www.imdb.com/search/title/';
  const params = new URLSearchParams({
    title_type: 'feature',
    release_date: `${dateStart},${dateEnd}`,
    num_votes: votesString,
    sort: 'user_rating,desc' // Optional: sort by rating to show best films first
  });

  const imdbUrl = `${baseUrl}?${params.toString()}`;

  return {
    criteria: {
      year,
      tier,
      minVotes,
      maxVotes
    },
    imdbUrl
  };
};
