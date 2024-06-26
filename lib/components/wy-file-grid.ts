import { html, nothing } from "lit";
import { classMap } from "lit/directives/class-map.js";

import "./wy-icon";
import "./wy-file-menu";

import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileType } from "../types/files.types";

import { WyFilesList } from "./wy-files-list";
import { type WeavyContextType } from "../contexts/weavy-context";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace, inputConsume } from "../utils/keyboard";
import { ref } from "lit/directives/ref.js";
import { autofocusRef } from "../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";
import { checkImageLoad, imageLoaded } from "../utils/images";

export function renderFileCard(
  this: WyFilesList,
  weavyContext: WeavyContextType | undefined,
  { file }: { file: FileType },
  isRenamingId?: number
) {
  const fileSize = file.size && file.size > 0 ? fileSizeAsString(file.size) : nothing;
  const fileChangedAt = file.updated_at || file.created_at;
  const fileDate = new Intl.DateTimeFormat(weavyContext?.locale, { dateStyle: "full", timeStyle: "short" }).format(
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
    <div
      class="wy-card ${classMap({
        "wy-card-trashed": file.is_trashed,
        "wy-card-hover": !file.is_trashed && !isRenaming,
      })}"
      title="${file.name} • ${fileSize} • ${fileDate}"
      tabindex="0"
      @click=${(e: Event) => {
        !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(file);
      }}
      @keydown=${clickOnEnterAndConsumeOnSpace}
      @keyup=${clickOnSpace}
    >
      <div class="wy-card-actions">
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
              class="wy-card-top wy-card-content wy-card-image ${classMap({
                "wy-card-top-image": file.kind === "image",
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
            <div class="wy-card-top wy-card-content wy-card-icon">
              <wy-icon name=${icon} size="96" kind=${file.kind} ext=${ext}></wy-icon>
            </div>
          `}
      <div class="wy-card-content wy-filename">
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
                ? html`<wy-icon size="16" name="comment" color="secondary"></wy-icon>`
                : nothing}</div
            >`}
      </div>
    </div>
  `;
}
