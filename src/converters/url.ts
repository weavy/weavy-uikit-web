export function toUrl(value?: string | null) {
  // `value` is a string
  if (value) {
    try {
      return new URL(value);
    } catch(e) {
      console.warn("Invalid url: ", value);
    }
  }

  return undefined;
}
