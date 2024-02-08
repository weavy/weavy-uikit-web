/**
 * Makes the first letter in a string uppercase
 *
 * @param {string} str - The string to transform
 * @returns {string} - The transformed string
 */
export function toUpperCaseFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.substring(1).toLowerCase();
}

export const wordBoundary = '\\s,.:;"';
export const wordBoundaryWithHyphens = '\\s\\-,.:;"_';
export const separateByWordBoundaryRegExp = new RegExp(`^|[${wordBoundary}]|$`, "g");
export const separateByWordBoundaryWithHyphensRegExp = new RegExp(`^|[${wordBoundaryWithHyphens}]|$`, "g");
export const selectByWordBoundaryRegExp = new RegExp(
  `(?<=[${wordBoundary}]|^)[^${wordBoundary}]+(?=[${wordBoundary}]|$)`,
  "g"
);
export const selectByWordBoundaryWithHyphensRegExp = new RegExp(
  `(?<=[${wordBoundaryWithHyphens}]|^)[^${wordBoundaryWithHyphens}]+(?=[${wordBoundaryWithHyphens}]|$)`,
  "g"
);

/**
 *  Converts Initial Letters To Uppercase.
 *  Respects Bound-Words and don't convert contractions like "don't"
 *
 * @param str {string}
 * @returns {string}
 */
export function toTitleCase(str: string) {
  // Replacement for \b and \w that respects åäö etc

  return str.replace(selectByWordBoundaryWithHyphensRegExp, toUpperCaseFirst);
}

/**
 * Changes a string to snake_case from camelCase, PascalCase and spinal-case.
 *
 * @param {string} str - The string to change to snake case
 * @returns {string} The processed string as snake_case
 */
export function toSnakeCase(str: string) {
  if (str.length > 0) {
    return str
      .replace(/([a-z\d])([A-Z]+)/g, "$1_$2")
      .replace(/-|\s+/g, "_")
      .toLowerCase();
  } else {
    return str;
  }
}

/**
 * Changes a string to kebab-case/spinal-case from camelCase, PascalCase and snake_case.
 *
 * @param {string} str - The string to change to kebab case
 * @returns {string} The processed string as kebab-case
 */
export function toKebabCase(str: string) {
  if (str.length > 0) {
    return str
      .replace(/([a-z\d])([A-Z]+)/g, "$1-$2")
      .replace(/_|\s+/g, "-")
      .toLowerCase();
  } else {
    return str;
  }
}

/**
 * Changes a string to camelCase from PascalCase, spinal-case and snake_case.
 *
 * @param {string} str - The string to change to camel case
 * @param {boolean} [pascal] - Make ste string PascalCase
 * @returns {string} The processed string as camelCase or PascalCase
 */
export function toCamelCase(str: string, pascal?: boolean) {
  if (pascal) {
    // to PascalCase
    str = str[0].toUpperCase() + str.substring(1);
  } else {
    // from PascalCase
    str = str[0].toLowerCase() + str.substring(1);
  }

  // from snake_case and spinal-case
  return str.replace(/([-_][a-z])/gi, function ($1) {
    return $1.toUpperCase().replace("-", "").replace("_", "");
  });
}

/**
 *
 * @param name {string} - A name for which to get get initials, e.g. "Eddie" or "John Doe"
 * @param length {number} - Max number of chars to return.
 * @returns
 */
export function getInitials(name: string, length: number = 2) {
  if (!name) {
    return null;
  }

  let initials: string = "";

  const words = name.split(separateByWordBoundaryRegExp).filter((w) => w);

  if (words.length == 1) {
    initials = words[0];
  } else {
    words.forEach((word) => {
      initials += word.charAt(0);
    });
  }

  return initials.substring(0, length).toUpperCase();
}
