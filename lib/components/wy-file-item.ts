import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileActionType, FileStatusType, FileType } from "../types/files.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { inputConsume } from "../utils/keyboard";
import { getFileActionIconMapping } from "../utils/icons";
import { ref } from "lit/directives/ref.js";
import { autofocusRef } from "../utils/dom";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { FileDeleteForeverEventType, FileEditNameEventType, FileRenameEventType, FileRestoreEventType, FileSubscribeEventType, FileTrashEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

import filesCss from "../scss/all.scss"

import "./base/wy-icon";
import "./wy-file-menu";
import "./base/wy-spinner";

@customElement("wy-file-item")
export class WyFileItem extends LitElement {
  
  static override styles = filesCss;

  protected exportParts = new ShadowPartsController(this);

  //export const renderFileItem = (file: FileType, isRenaming: boolean, status?: FileStatusType, statusText?: string, hasHover = true, features, appFeatures) => {

  @property({ type: Object })
  file?: FileType;

  @property({ type: Object })
  status: FileStatusType = {
    state: "ok",
  };

  @property({ type: Boolean })
  hasHover = true;

  @property()
  actionType?: FileActionType

  @state()
  isRenaming: boolean = false;

  dispatchEditName(file: FileType) {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchRename(file: FileType, name: string) {
    const event: FileRenameEventType = new (CustomEvent as NamedEvent)("rename", { detail: { file, name } });
    return this.dispatchEvent(event);
  }

  dispatchTrash(file: FileType) {
    const event: FileTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchRestore(file: FileType) {
    const event: FileRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchDeleteForever(file: FileType) {
    const event: FileDeleteForeverEventType = new (CustomEvent as NamedEvent)("delete-forever", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchSubscribe(file: FileType, subscribe: boolean) {
    const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { file, subscribe } });
    return this.dispatchEvent(event);
  }

  override render() {
    const file = this.file;
    if (!file) return nothing;

    const { icon } = getIcon(file.name);
    const actionIcon = getFileActionIconMapping(this.actionType);
    const ext = getExtension(file.name);
    const provider = getProvider(file.provider);

    /*const onClickWrapper = (e: MouseEvent) => {
            if (!e.defaultPrevented && !renaming) {
                if (onHandleError && (this.status.state === "conflict" || this.status.state === "error")) {
                    onHandleError(file);
                } else if (onClick) {
                    onClick(e);
                }
            }
        }*/

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
        class="wy-item wy-list-item ${classMap({
          "wy-item-trashed": file.is_trashed,
          "wy-item-hover": this.hasHover && !file.is_trashed && !this.isRenaming,
        })}"
        title=${file.name}>
        ${this.status.state === "error"
          ? html`<wy-icon name="alert-octagon" color="error" title=${ifDefined(this.status.text)}></wy-icon>`
          : this.status.state === "conflict"
          ? html`<wy-icon name="alert" color="yellow" title=${ifDefined(this.status.text)}></wy-icon>`
          : this.status.state === "pending"
          ? html`<wy-spinner ?nospin=${Boolean(this.status.progress)} .progress=${this.status.progress}></wy-spinner>`
          : html`<wy-icon .name=${icon} .overlayName=${provider} .overlayPath=${actionIcon} .size=${24} .kind=${file.kind} ext=${ext}></wy-icon>` }
        <div class="wy-item-body">
          ${this.isRenaming
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
                  ${ref(autofocusRef)} />
              `
            : html`
                <span title=${file.name + (this.status.text ? `: ${this.status.text}` : "")}
                  ><slot name="title"
                    >${this.title || file.name}${this.status.text
                      ? html`: <em>${this.status.text}</em>`
                      : nothing}</slot
                  ></span
                >
              `}
        </div>
        <div class="wy-item-actions">
          <slot name="actions">
            <wy-file-menu
              .file=${file}
              @edit-name=${(e: FileEditNameEventType) => this.dispatchEditName(e.detail.file)}
              @trash=${(e: FileTrashEventType) => this.dispatchTrash(e.detail.file)}
              @restore=${(e: FileRestoreEventType) => this.dispatchRestore(e.detail.file)}
              @delete-forever=${(e: FileDeleteForeverEventType) => this.dispatchDeleteForever(e.detail.file)}
              @subscribe=${(e: FileSubscribeEventType) => this.dispatchSubscribe(e.detail.file, e.detail.subscribe)}>
            </wy-file-menu>
          </slot>
        </div>
      </div>
    `;
  }
}
