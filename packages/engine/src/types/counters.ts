export type CounterType =
  | 'wound'
  | 'stage'
  | 'stun'
  | 'power'
  | 'plus_one_plus_one';

export type CounterMap = Partial<Record<CounterType, number>>;

export function getCounter(counters: CounterMap, type: CounterType): number {
  return counters[type] ?? 0;
}

export function setCounter(counters: CounterMap, type: CounterType, value: number): CounterMap {
  const result = { ...counters };
  if (value <= 0) {
    delete result[type];
  } else {
    result[type] = value;
  }
  return result;
}

export function addCounter(counters: CounterMap, type: CounterType, amount: number): CounterMap {
  return setCounter(counters, type, getCounter(counters, type) + amount);
}
