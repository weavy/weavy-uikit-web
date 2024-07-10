import { directive } from "lit/directive.js";
import { Directive } from "lit/async-directive.js";

type replacerFn = (substring: string, ...args: string[]) => string;

export function md(strings: string[], ...values: unknown[]) {
  const para: replacerFn = function (text, line) {
    const trimmed = line.trim();
    if (/^<\/?(ul|ol|li|h|p|bl)/i.test(trimmed)) {
      return `\n${line}\n`;
    }
    return `\n<p>${trimmed}</p>\n`;
  };

  const ulList: replacerFn = function (text, item) {
    return `\n<ul>\n\t<li>${item.trim()}</li>\n</ul>`;
  };

  const olList: replacerFn = function (text, item) {
    return `\n<ol>\n\t<li>${item.trim()}</li>\n</ol>`;
  };

  const blockquote: replacerFn = function (text, tmp, item) {
    return `\n<blockquote>${item.trim()}</blockquote>`;
  };

  const header: replacerFn = function (text, chars, content) {
    const level = chars.length;
    return `<h${level}>${content.trim()}</h${level}>`;
  };

  return [
    { regex: /(#+)(.*)/g, replacement: header }, // headers
    { regex: /!\[([^[]+)\]\(([^)]+)\)/g, replacement: "<img src='$2' alt='$1'>" }, // image
    { regex: /\[([^[]+)\]\(([^)]+)\)/g, replacement: "<a href='$2'>$1</a>" }, // hyperlink
    { regex: /(\*\*|__)(.*?)\1/g, replacement: "<strong>$2</strong>" }, // bold
    { regex: /(\*|_)(.*?)\1/g, replacement: "<em>$2</em>" }, // emphasis
    { regex: /~~(.*?)~~/g, replacement: "<del>$1</del>" }, // del
    { regex: /:"(.*?)":/g, replacement: "<q>$1</q>" }, // quote
    { regex: /`(.*?)`/g, replacement: "<code>$1</code>" }, // inline code
    { regex: /\n\*(.*)/g, replacement: ulList }, // ul lists
    { regex: /\n[0-9]+\.(.*)/g, replacement: olList }, // ol lists
    { regex: /\n(&gt;|>)(.*)/g, replacement: blockquote }, // blockquotes
    { regex: /\n-{5,}/g, replacement: "\n<hr />" }, // horizontal rule
    { regex: /\n([^\n]+)\n/g, replacement: para }, // add paragraphs
    { regex: /<\/ul>\s?<ul>/g, replacement: "" }, // fix extra ul
    { regex: /<\/ol>\s?<ol>/g, replacement: "" }, // fix extra ol
    { regex: /<\/blockquote><blockquote>/g, replacement: "\n" }, // fix extra blockquote
  ].reduce(
    (text, rule) => text.replace(rule.regex, rule.replacement as never),

    (Array.isArray(strings) ? strings : [strings])
      .map((part, index) => `${part}${values[index] ? values[index] : ""}`)
      .join("")
  );
}

/**
 * A directive to render a Lit template.
 *
 * See [Lit docs on Custom Directives](https://lit.dev/docs/templates/custom-directives/).
 */
export class MarkdownDirective extends Directive {
  render(mdText: string) {
    return md([mdText]);
  }
}

/**
 * To be used in Lit templates.
 *
 * See {@link MarkdownDirective.render | MarkdownDirective.render}
 */
export const markdown = directive(MarkdownDirective);
