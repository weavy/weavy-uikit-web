import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { msg } from "@lit/localize";

import "./wy-icon";
import "./wy-file-menu";

import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileOrderByType, FileOrderType, FileType } from "../types/files.types";
import { WyFilesList } from "./wy-files-list";

import { repeat } from "lit/directives/repeat.js";
import { type WeavyContext } from "../client/context-definition";
import { inputConsume, clickOnSpace, clickOnEnterAndConsumeOnSpace } from "../utils/keyboard";
import { ref } from "lit/directives/ref.js";
import { autofocusRef } from "../utils/dom";

export type FileOrderHeaderType = { by: FileOrderByType | undefined; title: string }[];

export function renderFileTable(
  this: WyFilesList,
  weavyContext: WeavyContext | undefined,
  files: FileType[],
  order?: FileOrderType,
  isRenamingId?: number
) {
  return files && files.length
    ? html`
        <table class="wy-table wy-table-hover wy-table-files">
          <thead class="wy-files-thead">${renderFileTableHeaders.call(this, order)}</thead>
          <tbody class="wy-files-tbody">
            ${repeat(
              files,
              (file) => file.id,
              (file) => renderFileTableRow.call(this, weavyContext, { file }, isRenamingId)
            )}
          </tbody>
        </table>
      `
    : nothing;
}

export function renderFileTableHeaders(this: WyFilesList, order?: FileOrderType) {
  const headers: FileOrderHeaderType = [
    { by: "name", title: msg("Name") },
    { by: "modified_at", title: msg("Modified") },
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
  weavyContext: WeavyContext | undefined,
  { file }: { file: FileType },
  isRenamingId?: number
) {
  const fileSize = file.size && file.size > 0 ? fileSizeAsString(file.size) : nothing;
  const fileChangedAt = file.modified_at || file.created_at;
  const fileDateFull = new Intl.DateTimeFormat(weavyContext?.locale, { dateStyle: "full", timeStyle: "short" }).format(
    new Date(fileChangedAt)
  );
  const fileDateShort = new Intl.DateTimeFormat(weavyContext?.locale, { dateStyle: "short" }).format(
    new Date(fileChangedAt)
  );
  const isRenaming = Boolean(isRenamingId && isRenamingId === file.id);

  let { icon } = getIcon(file.name);
  const ext = getExtension(file.name);
  const provider = getProvider(file.provider);

  if (provider) {
    icon = `${icon}+${provider}`;
  }

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

  return html`
    <tr
      class=${ifDefined(file.is_trashed ? "wy-table-trashed" : undefined)}
      @click=${(e: Event) => {
        !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(file);
      }}
    >
      <td class="wy-table-cell-icon"><wy-icon name=${icon} size="24" kind=${file.kind} ext=${ext}></wy-icon></td>
      <td class="wy-files-td-filename">
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
          : html` <span>${file.name}</span> `}
      </td>
      <td class="wy-files-td-modified"
        ><time datetime="${fileChangedAt}" title=${fileDateFull}>${fileDateShort}</time></td
      >
      <td class="wy-files-td-kind"><span>${file.kind}</span></td>
      <td class="wy-files-td-size"><span>${fileSize}</span></td>
      <td class="wy-table-cell-icon">
        <wy-file-menu
          .file=${file}
          .availableFeatures=${this.availableFeatures}
          .features=${this.features}
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
