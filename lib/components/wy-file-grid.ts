import { html, nothing } from "lit";
import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileType } from "../types/files.types";
import { WyFilesList } from "./wy-files-list";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace, inputConsume } from "../utils/keyboard";
import { Ref, ref } from "lit/directives/ref.js";
import { autofocusRef } from "../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";
import { checkImageLoad, imageLoaded } from "../utils/images";
import { partMap } from "../utils/directives/shadow-part-map";
import { msg, str } from "@lit/localize";

import "./base/wy-icon";
import "./wy-file-menu";

export function renderFileCard(
  this: WyFilesList,
  file: FileType,
  isRenamingId?: number,
  highlightId?: number,
  highlightRef?: Ref<HTMLElement>
) {
  const fileSize = file.size && file.size > 0 ? fileSizeAsString(file.size) : nothing;
  const fileChangedAt = file.updated_at || file.created_at;
  const fileDate = new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
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

  const trashedPart = {
    "wy-trashed": file.is_trashed,
  };

  const highlight = Boolean(highlightId && highlightId === file.id);

  return html`
    <div
      part=${partMap({
        "wy-card": true,
        "wy-card-trashed": file.is_trashed,
        "wy-card-hover": !file.is_trashed && !isRenaming,
        "wy-highlight": highlight,
      })}
      title="${file.name} • ${fileSize} • ${fileDate}"
      tabindex="0"
      @click=${(e: Event) => {
        !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(file.id);
      }}
      @keydown=${clickOnEnterAndConsumeOnSpace}
      @keyup=${clickOnSpace}
      ${highlight && highlightRef ? ref(highlightRef) : nothing}
    >
      <div part="wy-card-actions">
        <wy-file-menu
          small
          .file=${file}
          @edit-name=${(e: CustomEvent) => this.dispatchEditName(e.detail.file)}
          @trash=${(e: CustomEvent) => this.dispatchTrash(e.detail.file)}
          @restore=${(e: CustomEvent) => this.dispatchRestore(e.detail.file)}
          @delete-forever=${(e: CustomEvent) => this.dispatchDeleteForever(e.detail.file)}
          @subscribe=${(e: CustomEvent) => this.dispatchSubscribe(e.detail.file, e.detail.subscribe)}
        ></wy-file-menu>
      </div>
      ${!file.is_trashed && file.thumbnail_url
        ? html`
            <img
              part="wy-card-top wy-card-content wy-card-image ${partMap({
                "wy-card-top-image": file.kind === "image",
                ...trashedPart,
              })}"
              width=${ifDefined(file.width)}
              height=${ifDefined(file.height)}
              src=${file.thumbnail_url}
              alt=${file.name}
              ${ref(checkImageLoad)}
              @load=${imageLoaded}
              loading="lazy"
              decoding="async"
            />
          `
        : html`
            <div part="wy-card-top wy-card-content wy-card-icon ${partMap(trashedPart)}">
              <wy-icon name=${icon} .overlayName=${provider} size="96" kind=${file.kind} ext=${ext}></wy-icon>
            </div>
          `}
      <div part="wy-card-content wy-filename ${partMap(trashedPart)}">
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
          : html`<div class="wy-truncated-text-and-icon"
              ><div>${file.name}</div> ${file.comments?.count
                ? html`<wy-button
                    small
                    kind="icon"
                    @click=${(e: Event) => {
                      if (!e.defaultPrevented && !file.is_trashed) {
                        (e.target as HTMLElement).blur();
                        this.dispatchFileOpen(file.id, "comments");
                        e.stopPropagation();
                      }
                    }}
                    title=${msg(str`${file.comments.count} comments`)}
                  >
                    <span class="wy-badge">${file.comments.count}</span>
                  </wy-button>`
                : nothing}</div
            >`}
      </div>
    </div>
  `;
}
