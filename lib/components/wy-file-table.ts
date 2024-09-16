import { html, nothing } from "lit";
import { msg } from "@lit/localize";

import "./wy-icon";
import "./wy-file-menu";

import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileOrderByType, FileOrderType, FileType } from "../types/files.types";
import { WyFilesList } from "./wy-files-list";

import { repeat } from "lit/directives/repeat.js";
import { type WeavyType } from "../contexts/weavy-context";
import { inputConsume, clickOnSpace, clickOnEnterAndConsumeOnSpace } from "../utils/keyboard";
import { Ref, ref } from "lit/directives/ref.js";
import { autofocusRef } from "../utils/dom";
import { classMap } from "lit/directives/class-map.js";
import { partMap } from "../utils/directives/shadow-part-map";

export type FileOrderHeaderType = { by: FileOrderByType | undefined; title: string }[];

export function renderFileTable(
  this: WyFilesList,
  files: FileType[],
  order?: FileOrderType,
  isRenamingId?: number,
  highlightId?: number,
  highlightRef?: Ref
) {
  return files && files.length
    ? html`
        <table class="wy-table wy-table-hover wy-table-files">
          <thead>${renderFileTableHeaders.call(this, order)}</thead>
          <tbody>
            ${repeat(
              files,
              (file) => file.id,
              (file) => renderFileTableRow.call(this, this.weavy, { file }, isRenamingId, highlightId, highlightRef)
            )}
          </tbody>
        </table>
      `
    : nothing;
}

export function renderFileTableHeaders(this: WyFilesList, order?: FileOrderType) {
  const headers: FileOrderHeaderType = [
    { by: "name", title: msg("Name") },
    { by: "updated_at", title: msg("Modified") },
    { by: undefined, title: msg("Kind") },
    { by: "size", title: msg("Size") },
  ];

  return html`
    <tr>
      <th class="wy-table-cell-icon"></th>
      ${headers.map((header) => {
        const active = header.by === order?.by;
        const onHeaderClick = (e: Event) => {
          e.preventDefault();
          header.by && this.dispatchOrder({ by: header.by, descending: active && !order?.descending });
        };
        return html` <th>
          ${header.by
            ? html`<div
                class="wy-table-sort-link"
                tabindex="0"
                @click=${onHeaderClick}
                @keydown=${clickOnEnterAndConsumeOnSpace}
                @keyup=${clickOnSpace}
                >${header.title}
                ${(active && html`<wy-icon name=${order?.descending ? "menu-down" : "menu-up"}></wy-icon>`) ||
                nothing}</div
              >`
            : header.title}
        </th>`;
      })}
      <th class="wy-table-cell-icon"></th>
    </tr>
  `;
}

export function renderFileTableRow(
  this: WyFilesList,
  weavy: WeavyType | undefined,
  { file }: { file: FileType },
  isRenamingId?: number,
  highlightId?: number,
  highlightRef?: Ref
) {
  const fileSize = file.size && file.size > 0 ? fileSizeAsString(file.size) : nothing;
  const fileChangedAt = file.updated_at || file.created_at;
  const fileDateFull = new Intl.DateTimeFormat(weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
    new Date(fileChangedAt)
  );
  const fileDateShort = new Intl.DateTimeFormat(weavy?.locale, { dateStyle: "short" }).format(
    new Date(fileChangedAt)
  );
  const isRenaming = Boolean(isRenamingId && isRenamingId === file.id);

  const { icon } = getIcon(file.name);
  const ext = getExtension(file.name);
  const provider = getProvider(file.provider);

  const handleRename = (e: Event) => {
    e.stopImmediatePropagation();

    const renameTarget = e.target as HTMLInputElement;
    if (renameTarget.value && renameTarget.value !== file.name) {
      this.dispatchRename(file, renameTarget.value);
    } else {
      this.dispatchEditName({ id: NaN } as FileType);
    }
  };

  const handleRenameKey = (e: KeyboardEvent & Event) => {
    const target = e.target as HTMLInputElement;

    if (e.key === "Escape") {
      e.preventDefault();
      target.value = file.name;
      target.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      target.blur();
    }
  };

  const highlight = Boolean(highlightId && highlightId === file.id)

  return html`
    <tr
      class=${classMap({"wy-table-row-trashed": file.is_trashed })}
      part=${partMap({"wy-highlight": highlight})}
      @click=${(e: Event) => {
        !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(file.id);
      }}
      ${highlight && highlightRef ? ref(highlightRef): nothing}
    >
      <td class="wy-table-cell-icon"><wy-icon name=${icon} .overlayName=${provider} size="24" kind=${file.kind} ext=${ext}></wy-icon></td>
      <td>
        ${isRenaming
          ? html`
              <input
                type="text"
                maxlength="256"
                class="wy-input"
                .defaultValue=${file.name}
                @blur=${handleRename}
                @keyup=${(e: KeyboardEvent) => {
                  inputConsume(e);
                  handleRenameKey(e);
                }}
                @click=${(e: Event) => e.preventDefault()}
                @focus=${handleSelectFilename}
                ${ref(autofocusRef)}
              />
            `
          : html`<div class="wy-truncated-text-and-icon"><div>${file.name}</div> ${file.comments?.count ? html`<wy-icon size="16" name="comment" color="secondary"></wy-icon>` : nothing}</div>`}
      </td>
      <td><time datetime="${fileChangedAt}" title=${fileDateFull}>${fileDateShort}</time></td
      >
      <td>${file.kind}</td>
      <td>${fileSize}</td>
      <td class="wy-table-cell-icon">
        <wy-file-menu
          .file=${file}
          @edit-name=${(e: CustomEvent) => this.dispatchEditName(e.detail.file)}
          @trash=${(e: CustomEvent) => this.dispatchTrash(e.detail.file)}
          @restore=${(e: CustomEvent) => this.dispatchRestore(e.detail.file)}
          @delete-forever=${(e: CustomEvent) => this.dispatchDeleteForever(e.detail.file)}
          @subscribe=${(e: CustomEvent) => this.dispatchSubscribe(e.detail.file, e.detail.subscribe)}
        >
        </wy-file-menu>
      </td>
    </tr>
  `;
}
