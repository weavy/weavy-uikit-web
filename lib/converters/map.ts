export function toMap<TKey = unknown, TValue = unknown>(value: string) {
  // `value` is a string
  const mapLike = JSON.parse(value) as Iterable<readonly [TKey, TValue]>;
  // `mapLike` should be an array or similar
  return new Map<TKey, TValue>(mapLike);
}
