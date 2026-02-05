export interface FilmCriteria {
  year: number;
  tier: number;
  minVotes: number;
  maxVotes: number | null; // null represents infinity
}

export interface RandomizerResult {
  criteria: FilmCriteria;
  imdbUrl: string;
}
