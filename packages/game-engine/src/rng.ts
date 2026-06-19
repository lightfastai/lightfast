export interface LcgResult {
  state: number;
  value: number;
}

export interface LcgRng {
  getState(): number;
  next(): number;
}

const MULTIPLIER = 1_664_525;
const INCREMENT = 1_013_904_223;
const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

export function nextLcgValue(state: number): LcgResult {
  const nextState = (Math.imul(state >>> 0, MULTIPLIER) + INCREMENT) >>> 0;

  return {
    state: nextState,
    value: nextState / UINT32_MAX_PLUS_ONE,
  };
}

export function createLcgRng(seed: number): LcgRng {
  let state = seed >>> 0;

  return {
    getState() {
      return state;
    },
    next() {
      const result = nextLcgValue(state);
      state = result.state;
      return result.value;
    },
  };
}
