import { VoteRange } from './types';

export const MIN_YEAR = 1975;
export const MAX_YEAR = 2025;

/**
 * Returns a random integer between min and max (inclusive)
 */
export const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Calculates the vote range based on the tier (1-11)
 */
export const getVoteRangeByTier = (tier: number): VoteRange => {
  if (tier === 1) {
    return {
      min: 20000,
      max: 100000,
      label: '20,000 - 100,000'
    };
  }

  if (tier === 11) {
    return {
      min: 1000001,
      max: null,
      label: '1,000,001+'
    };
  }

  // Logic for tiers 2 through 10
  // Tier 2: 100,001 - 200,000
  // Tier 3: 200,001 - 300,000
  // ...
  // Tier 10: 900,001 - 1,000,000
  const min = (tier - 1) * 100000 + 1;
  const max = tier * 100000;

  return {
    min,
    max,
    label: `${min.toLocaleString()} - ${max.toLocaleString()}`
  };
};

/**
 * Constructs the IMDb search URL
 */
export const buildImdbUrl = (year: number, voteRange: VoteRange): string => {
  const baseUrl = 'https://www.imdb.com/search/title/';
  
  const dateParam = `release_date=${year}-01-01,${year}-12-31`;
  
  // Construct votes parameter
  // If max is null, it means infinity, so we just send "min,"
  const votesParam = `num_votes=${voteRange.min},${voteRange.max ? voteRange.max : ''}`;
  
  const typeParam = 'title_type=feature';

  return `${baseUrl}?${typeParam}&${dateParam}&${votesParam}`;
};