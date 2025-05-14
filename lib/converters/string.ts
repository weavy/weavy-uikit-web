export function toIntOrString(value?: string | null) {
  // `value` is a string
  if (value) {
    if (value.match(/^[0-9]+$/)) {
      return parseInt(value);
    } else {
      return value;
    }
  }

  return undefined;
}
