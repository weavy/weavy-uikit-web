import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const weavyHighlighter = HighlightStyle.define([
    { tag: tags.meta, class: "code" },
    { tag: tags.link, class: "wy-link" },
    { tag: tags.heading, textDecoration: "underline", fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.keyword, class: "code token keyword" },
    { tag: [tags.atom, tags.bool], class: "code token builtin" },
    { tag: [tags.url, tags.contentSeparator, tags.labelName], class: "code token prolog" },
    { tag: tags.literal, class: "code token char" },
    { tag: tags.inserted, class: "code token inserted" },
    { tag: tags.deleted, class: "code token deleted" },
    { tag: tags.string, class: "code token string" },
    { tag: [tags.regexp, tags.escape, tags.special(tags.string)], class: "code token regex" },
    { tag: tags.definition(tags.variableName), class: "code token constant" },
    { tag: tags.local(tags.variableName), class: "code token variable" },
    { tag: [tags.typeName, tags.namespace], class: "code token keyword" },
    { tag: tags.className, class: "code token class-name" },
    { tag: [tags.special(tags.variableName), tags.macroName], class: "code token function" },
    { tag: tags.propertyName, class: "code token property" },
    { tag: tags.comment, class: "code token comment" },
    { tag: tags.invalid, color: "#f00", class: "code token" },
  ]);