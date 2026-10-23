// Based loosely on https://www.daniweb.com/programming/web-development/code/543112/codemirror-markdown-editor-toolbar
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Line } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

export type mdBlockFormat = {
  gfmName: string;
  gfmMatch?: RegExp;
  before?: string;
  prefixNumber?: boolean;
  marker: string;
  after?: string;
  match: RegExp;
  clean: string;
  isMultiline?: boolean;
  placeholderText?: string;
};

export type mdInlineFormat = {
  gfmName: string;
  gfmMatch?: RegExp;
  input?: RegExp;
  construct: string;
  match: RegExp;
  clean: string;
  placeholderText: string;
};

export type mdFormat = mdBlockFormat | mdInlineFormat;

export type mdFormats = {
  [key: string]: mdFormat;
};

/**
 * Type guard to check if a mdFormat is mdBlockFormat
 */
export function isMdBlockFormat(format: mdFormat): format is mdBlockFormat {
  return "marker" in format;
}

/**
 * Type guard to check if a mdFormat is mdInlineFormat
 */
export function isMdInlineFormat(format: mdFormat): format is mdInlineFormat {
  return "construct" in format;
}

/**
 * A mapping of common GFM elements to their CodeMirror/Lezer node names
 * and their formatting specifications.
 * Note: 'Emphasis' and 'StrongEmphasis' are used for both standard and GFM.
 */
export const GFM_FORMATS = {
  bold: {
    gfmName: "StrongEmphasis",
    construct: "**$&**",
    placeholderText: "Bold",
    match: /\*\*(?=[^*\s])(.*[^*\s])\*\*/gm,
    clean: "$1",
  },
  italic: {
    gfmName: "Emphasis",
    construct: "*$&*",
    placeholderText: "Emphasized",
    match: /\*(?![*][^*]|\s)([^*\s]|.+\S)(?<![^*][*])\*(?![*]{1,2})/gm,
    clean: "$1",
  },
  link: {
    gfmName: "Link",
    gfmMatch: /Link|Image/,
    placeholderText: "Click Here",
    input: /(?:(?<description>.*?)(?:(?:^|\s)+(?<url>[a-z0-9+\-.]+:\S*))|(?<text>.*))(?:\s*)$/m,
    construct: "[$<description>$<text>]($<url>)",
    match: /[!]?\[(.*)\]\((.*)\)/gm,
    clean: "$1 $2",
  },
  image: {
    gfmName: "Image",
    gfmMatch: /Link|Image/,
    placeholderText: "Image",
    input: /(?:(?<description>.*?)(?:(?:^|\s)+(?<url>[a-z0-9+\-.]+:\S*))|(?<text>.*))(?:\s*)$/m,
    construct: "![$<description>$<text>]($<url>)",
    match: /[!]?\[(.*)\]\((.*)\)/gm,
    clean: "$1 $2",
  },
  inlineCode: {
    gfmName: "InlineCode",
    construct: "`$&`",
    placeholderText: "Code example",
    match: /(?<!`)`([^`]*)`(?!`)/gm,
    clean: "$1",
  },
  blockquote: {
    gfmName: "Blockquote",
    marker: "> ",
    isMultiline: true,
    placeholderText: "Quote",
    match: /^> (.*)$/gm,
    clean: "$1",
  },
  // Headings are identified by their level
  heading1: {
    gfmName: "ATXHeading1",
    gfmMatch: /ATXHeading\d/,
    marker: "# ",
    placeholderText: "Heading 1",
    match: /^[#]{1,6} (Heading \d)?(.*)$/g,
    clean: "$2",
  },
  heading2: {
    gfmName: "ATXHeading2",
    gfmMatch: /ATXHeading\d/,
    marker: "## ",
    placeholderText: "Heading 2",
    match: /^[#]{1,6} (Heading \d)?(.*)$/g,
    clean: "$2",
  },
  heading3: {
    gfmName: "ATXHeading3",
    gfmMatch: /ATXHeading\d/,
    marker: "### ",
    placeholderText: "Heading 3",
    match: /^[#]{1,6} (Heading \d)?(.*)$/g,
    clean: "$2",
  },
  heading4: {
    gfmName: "ATXHeading4",
    gfmMatch: /ATXHeading\d/,
    marker: "#### ",
    placeholderText: "Heading 4",
    match: /^[#]{1,6} (Heading \d)?(.*)$/g,
    clean: "$2",
  },
  heading5: {
    gfmName: "ATXHeading5",
    gfmMatch: /ATXHeading\d/,
    marker: "##### ",
    placeholderText: "Heading 5",
    match: /^[#]{1,6} (Heading \d)?(.*)$/g,
    clean: "$2",
  },
  heading6: {
    gfmName: "ATXHeading6",
    gfmMatch: /ATXHeading\d/,
    marker: "###### ",
    placeholderText: "Heading 6",
    match: /^[#]{1,6} (Heading \d)?(.*)$/g,
    clean: "$2",
  },
  // Block code can be indented or fenced (```)
  blockCode: {
    gfmName: "FencedCode",
    marker: "",
    before: "```",
    after: "```",
    isMultiline: true,
    placeholderText: "Code example",
    //match: /^```(\S+)?\n(?:(?:Code example)|((?:.*|\n)*))\n```$/gm,
    match: /^```(\S+)?$/gm,
    clean: "",
  },
  // Lists distinguish between the container and the items
  listOrdered: {
    gfmName: "OrderedList",
    gfmMatch: /OrderedList|BulletList/,
    marker: ". ",
    prefixNumber: true,
    isMultiline: true,
    placeholderText: "Item",
    match: /^\w*(?:\d+\.|\*|-) (.*)$/gm,
    clean: "$1",
  },
  listUnordered: {
    gfmName: "BulletList",
    gfmMatch: /OrderedList|BulletList/,
    marker: "* ",
    isMultiline: true,
    placeholderText: "Item",
    match: /^\w*(?:\d+\.|\*|-) (.*)$/gm,
    clean: "$1",
  },
  listItem: {
    gfmName: "ListItem",
    marker: "* ",
    isMultiline: true,
    placeholderText: "Item",
    match: /^\w*(?:\d+\.|\*|-) (.*)$/g,
    clean: "$1",
  },
} as const satisfies mdFormats;

/**
 * Checks if the cursor is at the very start of a line.
 * Note: This checks the absolute start (index 0 of that line).
 */
export function isCursorAtLineStart(state: EditorState): boolean {
  // Get the position of the main cursor
  const pos = state.selection.main.head;

  // Get line metadata for that position
  const line = state.doc.lineAt(pos);

  // line.from is the index where the line begins
  return pos === line.from;
}

/**
 * Checks if the cursor/selection has
 * a specific Markdown syntax node and returns it.
 * @param state - The current EditorState
 * @param nodeName - The node type name (e.g., 'StrongEmphasis', 'Link', 'AtxHeading1')
 */
export function getSyntaxNodes(state: EditorState, nodeName: string | RegExp): SyntaxNode[] {
  const selection = state.selection.main;
  const hasSelection = selection.from !== selection.to;

  let syntaxNodes;

  if (hasSelection) {
    syntaxNodes = findSyntaxNodesInRange(state, nodeName, selection.from, selection.to);
  } else {
    const node = getSyntaxNode(state, nodeName);
    syntaxNodes = node ? [node] : [];
  }

  return syntaxNodes;
}

/**
 * Checks if the cursor (or a specific position) is wrapped within
 * a specific Markdown syntax node and returns it.
 * @param state - The current EditorState
 * @param nodeName - The node type name (e.g., 'StrongEmphasis', 'Link', 'AtxHeading1')
 */
export function getSyntaxNode(state: EditorState, nodeName: string | RegExp): SyntaxNode | undefined {
  const pos = state.selection.main.head;

  // The 'side' parameter (-1) looks slightly to the left of the cursor,
  // which is usually what users expect when typing at the end of a formatted word.
  // In the beginning of a line we must do the opposite.
  const side = isCursorAtLineStart(state) ? 1 : -1;

  // Resolve the syntax node at the current position.
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);

  //console.log(nodeName, node)

  // Walk up the tree towards the root
  while (node) {
    const nodeMatch = typeof nodeName === "string" ? nodeName === node.name : nodeName.test(node.name);
    if (nodeMatch) {
      return node;
    }
    node = node.parent;
  }

  return undefined;
}

/**
 * Finds all syntax nodes of a given type within a specified range.
 * Recursively walks the syntax tree to locate all matching nodes.
 * When a matching node is found, it's added but its children are not checked.
 */
function findSyntaxNodesInRange(state: EditorState, nodeName: string | RegExp, from: number, to: number): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];

  function walk(node: SyntaxNode) {
    // Skip nodes that don't overlap with the range
    if (node.from >= to || node.to <= from) {
      return;
    }

    const nodeMatch = typeof nodeName === "string" ? nodeName === node.name : nodeName.test(node.name);

    if (nodeMatch) {
      // Found a matching node - add it but don't recurse into its children
      nodes.push(node);
      return;
    }

    // Node doesn't match - check its children to find nested matching nodes
    let child = node.firstChild;
    while (child) {
      walk(child);
      child = child.nextSibling;
    }
  }

  walk(syntaxTree(state).topNode);
  return nodes;
}

const editorDirtyStates = new WeakMap<EditorView, EditorState>();
const editorFormatNodeCache = new Map<string, SyntaxNode[]>();

export function hasMdFormat(cm: EditorView | undefined, name: keyof typeof GFM_FORMATS, similar: boolean = false) {
  if (!cm) {
    return false;
  }

  const cacheName: keyof typeof GFM_FORMATS | `similar:${string}` = similar ? `similar:${name}` : name;

  // Use cached value?
  if (editorDirtyStates.get(cm) === cm.state && editorFormatNodeCache.has(cacheName)) {
    return Boolean(editorFormatNodeCache.get(cacheName)?.length);
  } else {
    const format: mdFormat = GFM_FORMATS[name];
    const nodes = getSyntaxNodes(cm.state, (similar && format.gfmMatch) || format.gfmName);

    editorFormatNodeCache.set(cacheName, nodes);
    return Boolean(nodes.length);
  }
}

const applyFormatting = ({ cm, format }: { cm: EditorView | undefined; format: mdFormat }): boolean => {
  if (!cm) {
    return false;
  }

  cm.focus();

  let modified = false;

  modified = removeFormatting(cm, format);

  if (!modified) {
    if (isMdBlockFormat(format)) {
      modified = insertBlockFormatting(cm, format);
    } else if (isMdInlineFormat(format)) {
      modified = insertInlineFormatting(cm, format);
    }
  }

  if (!modified) {
    modified = insertPlaceholder(cm, format);
  }

  // Always return true (when used as keyboard event)
  return true; // modified;
};

const removeFormatting = (cm: EditorView, format: mdFormat): boolean => {
  const changes: { from: number; to: number; insert: string }[] = [];
  let formattingNodes = getSyntaxNodes(cm.state, format.gfmName);

  let similar = false;

  // If no match, try similar
  if (!formattingNodes.length && format.gfmMatch) {
    formattingNodes = getSyntaxNodes(cm.state, format.gfmMatch);
    similar = true;
  }

  if (formattingNodes.length > 0) {
    const from = formattingNodes[0].from;
    const to = formattingNodes[formattingNodes.length - 1].to;

    const originalLength = to - from;
    let changedLength = originalLength;

    formattingNodes.forEach((formatNode) => {
      const nodeText = cm.state.doc.sliceString(formatNode.from, formatNode.to);

      if (format.match.test(nodeText)) {
        let cleanedText = nodeText.replace(format.match, format.clean);

        if (cleanedText.trim() === format.placeholderText) {
          cleanedText = "";
        }

        changedLength -= nodeText.length - cleanedText.length;

        changes.push({
          from: formatNode.from,
          to: formatNode.to,
          insert: cleanedText,
        });
      }
    });

    if (changes.length > 0) {
      cm.dispatch({
        changes,
        selection: {
          anchor: from,
          head: from + changedLength,
        },
        scrollIntoView: true,
      });

      // Only return true on exact match
      return similar ? false : true;
    }
  }

  return false;
};

const insertBlockFormatting = (cm: EditorView, format: mdBlockFormat, count: number = 1): boolean => {
  const changes: { from: number; to: number; insert: string }[] = [];

  const selection = () => cm.state.selection.main;
  //const hasSelection = selection().from !== selection().to;

  // Get the first and last lines that contain selected text
  const firstLine = () => cm.state.doc.lineAt(selection().from);
  const lastLine = () => cm.state.doc.lineAt(selection().to);

  const lines: Line[] = [];
  for (let lineNum = firstLine().number; lineNum <= lastLine().number; lineNum++) {
    lines.push(cm.state.doc.line(lineNum));
  }

  let lineStart: number = cm.state.selection.main.from;
  let lineEnd: number = cm.state.selection.main.to;
  let changedLength = 0;

  let startingLength = 0;
  let endingLength = 0;

  lineStart = Math.min(lineStart, firstLine().from);
  lineEnd = Math.max(lineEnd, lastLine().to);

  // Nothing selected and no content
  if (lines.length === 1 && !firstLine().text.trim()) {
    return false;
  }

  if (format.before) {
    const starting = `${format.before}\n`;
    const firstLineText = firstLine().text.trim();

    startingLength += starting.length;

    if (!firstLineText) {
      startingLength -= firstLine().text.length + 1;
    }

    changes.push({
      from: lineStart,
      to: firstLineText ? lineStart : lineStart + firstLine().text.length + 1,
      insert: starting,
    });
  }

  if (format.after) {
    const ending = `\n${format.after}`;
    const lastLineText = lastLine().text.trim();

    endingLength += ending.length;

    if (!lastLineText) {
      endingLength -= lastLine().text.length + 1;
    }

    changes.push({
      from: lastLineText ? lineEnd : lineEnd - lastLine().text.length - 1,
      to: lineEnd,
      insert: ending,
    });
  }

  for (const line of lines) {
    lineStart = Math.min(lineStart, line.from);
    lineEnd = Math.max(lineEnd, line.to);

    // No formatting node - check if current line(s) have content
    const lineText = line.text.trim();

    if (lineText.length > 0 || (format.isMultiline && line !== lines[lines.length - 1])) {
      // Line has content - add formatting
      const textToInsert = `${format.prefixNumber ? count++ : ""}${format.marker}`;
      changedLength += textToInsert.length;

      changes.push({
        from: line.from,
        to: line.from,
        insert: textToInsert,
      });
    }
  }

  if (changes.length) {
    cm.dispatch({
      changes,
      selection: {
        anchor: lineStart + startingLength + (lines.length === 1 ? changedLength : 0),
        head: lineEnd + changedLength + endingLength,
      },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
};

const insertInlineFormatting = (cm: EditorView, format: mdInlineFormat): boolean => {
  const selection = () => cm.state.selection.main;
  const hasSelection = () => selection().from !== selection().to;

  if (!hasSelection()) {
    // Select any word at cursor position
    const word = cm.state.wordAt(selection().head);

    if (word) {
      cm.dispatch({
        selection: {
          anchor: word.from,
          head: word.to,
        },
        scrollIntoView: true,
      });
    }
  }

  if (hasSelection()) {
    // Get the selected text and calculate trim amounts
    const rangeText = cm.state.sliceDoc(selection().from, selection().to);
    const trimmedText = rangeText.trim();
    const leadingWhitespace = rangeText.length - rangeText.trimStart().length;

    // Adjust selection boundaries to exclude whitespace
    const trimmedFrom = selection().from + leadingWhitespace;
    const trimmedTo = selection().to - (rangeText.length - trimmedText.length - leadingWhitespace);

    // Selection is larger than the formatting nodes - remove formatting and re-apply to entire trimmed selection
    const extractedText = cm.state.sliceDoc(trimmedFrom, trimmedTo);

    const input = format.input ?? /(.*)/m;

    if (input.test(extractedText)) {
      const constructedText = extractedText.replace(input, format.construct);

      // Add indices to the regexp
      const matchFlagsWithD = format.match.hasIndices ? format.match.flags : format.match.flags + "d";
      const formatMatch = new RegExp(format.match, matchFlagsWithD);

      const textSelectionMatch = formatMatch.exec(constructedText);
      const [selectionStart, selectionEnd] = textSelectionMatch?.indices?.[1] ||
        textSelectionMatch?.indices?.[0] || [0, 0];

      // Apply formatting to the entire trimmed selection
      cm.dispatch({
        changes: {
          from: trimmedFrom,
          to: trimmedTo,
          insert: constructedText,
        },
        selection: {
          anchor: trimmedFrom + selectionStart,
          head: trimmedFrom + selectionEnd,
        },
        scrollIntoView: true,
      });
      return true;
    }
  }

  return false;
};

const insertPlaceholder = (cm: EditorView, format: mdFormat): boolean => {
  const selection = cm.state.selection.main;
  const hasSelection = selection.from !== selection.to;

  // Line is empty - add placeholder
  if (!hasSelection && format.placeholderText) {
    cm.dispatch({
      ...cm.state.replaceSelection(format.placeholderText),
      selection: {
        anchor: selection.from,
        head: selection.from + format.placeholderText.length,
      },
      scrollIntoView: true,
    });

    if (isMdBlockFormat(format)) {
      insertBlockFormatting(cm, format);
    } else if (isMdInlineFormat(format)) {
      insertInlineFormatting(cm, format);
    }

    return true;
  }

  return false;
};

export function mdBold(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.bold,
  });
}

export function mdItalic(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.italic,
  });
}

export function mdLink(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.link,
  });
}

export function mdImage(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.image,
  });
}

export function mdHeading(level: number = 1, cm: EditorView | undefined): boolean {
  const headingKey = `heading${level}` as keyof typeof GFM_FORMATS;
  const headingConfig = GFM_FORMATS[headingKey] as mdBlockFormat;

  return applyFormatting({
    cm,
    format: headingConfig,
  });
}

export function mdCodeBlock(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.blockCode,
  });
}

export function mdCode(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.inlineCode,
  });
}

export function mdQuote(cm: EditorView | undefined, message?: string): boolean {
  if (!cm) {
    return false;
  }

  // Place a custom message first?
  if (message?.length) {
    cm.focus();

    cm.dispatch({
      ...cm.state.replaceSelection(message),
      scrollIntoView: true,
    });
  }

  return applyFormatting({
    cm,
    format: GFM_FORMATS.blockquote,
  });
}

export function mdListOL(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.listOrdered,
  });
}

export function mdListUL(cm: EditorView | undefined): boolean {
  return applyFormatting({
    cm,
    format: GFM_FORMATS.listUnordered,
  });
}

/*
export function editor_image(cm: EditorView, anchor: string, uri: string | null): boolean {
  if (!cm) {
    return false;
  }

  if (uri == null) {
    uri = prompt("Please enter the Image URI", "https://static.daniweb.com/attachments/");
  }

  if (anchor == null) {
    anchor = "Image";
  }

  if (uri != null) {
    cm.focus();

    cm.dispatch({
      changes: {
        from: cm.state.selection.main.from,
        to: cm.state.selection.main.from,
        insert: "\n![" + anchor + "](" + uri + ")\n",
      },
    });
  }

  return true;
}
*/

export const markdownKeymap: KeyBinding[] = [
  { key: "Mod-b", run: mdBold },
  { key: "Mod-i", run: mdItalic },
  { key: "Mod-l", run: mdLink },
  { key: "Mod-h", run: mdHeading.bind(this, 1) },
  { key: "Mod-K", run: mdCodeBlock },
  { key: "Mod-k", run: mdCode },
  { key: "Mod-q", run: mdQuote },
  { key: "Ctrl-o", mac: "Cmd-o", run: mdListOL },
  { key: "Ctrl-u", mac: "Cmd-u", run: mdListUL },
];
