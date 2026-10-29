import {describe , it, expect} from 'vitest';
import {rankBetween} from '../src/shared/rank';

describe("rankBetween", ()=> {
  it("generates 1,000 unique, correctly ordered ranks", ()=> {
    const lower = "a";
    let upper = "z";

    const ranks = new Set<string>();

    for(let i = 0; i < 1000; i++) {
      const rank = rankBetween(lower, upper);

      expect(rank > lower).toBe(true);
      expect(rank < upper).toBe(true);

      // Checked that this rank has not been generated before
      expect(ranks.has(rank)).toBe(false);
      ranks.add(rank);
      // Make the new rank the upper boundary for the next insert
      upper = rank;
    }
    // Confirm that all 1,000 ranks were unique.
    expect(ranks.size).toBe(1000);
  })

})