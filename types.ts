export interface VoteRange {
  min: number;
  max: number | null; // null represents Infinity
  label: string;
}

export interface FilmCriteria {
  year: number;
  voteTier: number;
  voteRange: VoteRange;
  url: string;
}