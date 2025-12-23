import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { getExtension, getIcon, handleSelectFilename } from "../utils/files";
import type { FileActionType, FileStatusType, FileType } from "../types/files.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { inputConsume } from "../utils/keyboard";
import { ref } from "lit/directives/ref.js";
import { autofocusRef } from "../utils/dom";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import {
  FileDeleteForeverEventType,
  FileEditNameEventType,
  FileRenameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
} from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

import inputCss from "../scss/components/input.scss";

import "./ui/wy-icon";
import "./ui/wy-item";
import "./wy-file-menu";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-item": WyFileItem;
  }
}

/**
 * File list item showing file icon, name and actions.
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
 *
 * @slot title - Custom title content for the item.
 * @slot actions - Actions slot (e.g. buttons / menus).
 *
 * @csspart wy-input - Input used when renaming a file.
 *
 * @fires {FileEditNameEventType} edit-name - Emitted when rename mode is requested.
 * @fires {FileRenameEventType} rename - Emitted when a file rename is confirmed.
 * @fires {FileTrashEventType} trash - Emitted when a file is trashed.
 * @fires {FileRestoreEventType} restore - Emitted when a file is restored.
 * @fires {FileDeleteForeverEventType} delete-forever - Emitted when a file is permanently deleted.
 * @fires {FileSubscribeEventType} subscribe - Emitted when subscribe state is toggled.
 */
@customElement("wy-file-item")
export class WyFileItem extends LitElement {
  static override styles = [inputCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * File data displayed in the list item.
   */
  @property({ type: Object })
  file?: FileType;

  /**
   * Current status metadata for the file item.
   */
  @property({ type: Object })
  status: FileStatusType = {
    state: "ok",
  };

  /**
   * Enable interactive hover/focus styling.
   */
  @property({ type: Boolean })
  interactive: boolean = false;

  /**
   * Render the item with rounded corners.
   */
  @property({ type: Boolean })
  rounded: boolean = false;

  /**
   * Optional action type used for contextual handling.
   */
  @property()
  actionType?: FileActionType;

  /**
   * Track whether the filename is currently being edited.
   *
   * @internal
   */
  @state()
  isRenaming: boolean = false;

  /**
   * Emit an `edit-name` event requesting rename mode for the provided file.
   *
   * @param file - File that should enter rename mode.
   * @returns Whether the event was not canceled.
   */
  dispatchEditName(file: FileType) {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `rename` event with a new filename.
   *
   * @param file - File being renamed.
   * @param name - New filename to apply.
   * @returns Whether the event was not canceled.
   */
  dispatchRename(file: FileType, name: string) {
    const event: FileRenameEventType = new (CustomEvent as NamedEvent)("rename", { detail: { file, name } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `trash` event to move the file to the recycle bin.
   *
   * @param file - File slated for trashing.
   * @returns Whether the event was not canceled.
   */
  dispatchTrash(file: FileType) {
    const event: FileTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `restore` event to recover the provided file.
   *
   * @param file - File to restore from trash.
   * @returns Whether the event was not canceled.
   */
  dispatchRestore(file: FileType) {
    const event: FileRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `delete-forever` event to permanently remove the file.
   *
   * @param file - File targeted for permanent deletion.
   * @returns Whether the event was not canceled.
   */
  dispatchDeleteForever(file: FileType) {
    const event: FileDeleteForeverEventType = new (CustomEvent as NamedEvent)("delete-forever", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `subscribe` event toggling subscription for the file.
   *
   * @param file - File whose subscription changes.
   * @param subscribe - Desired subscription state.
   * @returns Whether the event was not canceled.
   */
  dispatchSubscribe(file: FileType, subscribe: boolean) {
    const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { file, subscribe } });
    return this.dispatchEvent(event);
  }

  override render() {
    const file = this.file;
    if (!file) return nothing;

    const { icon } = getIcon(file.name);
    const ext = getExtension(file.name);

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
      <wy-item
        ?rounded=${this.rounded}
        ?interactive=${this.interactive && !file.is_trashed && !this.isRenaming}
        ?trashed=${file.is_trashed}
        title=${file.name}
        size="sm"
      >
        ${this.status.state === "error"
          ? html`<wy-icon
              slot="image"
              name="alert-octagon"
              color="error"
              title=${ifDefined(this.status.text)}
            ></wy-icon>`
          : this.status.state === "conflict"
          ? html`<wy-icon slot="image" name="alert" color="yellow" title=${ifDefined(this.status.text)}></wy-icon>`
          : html`<wy-icon slot="image" .name=${icon} .size=${24} .kind=${file.kind} ext=${ext}></wy-icon>`}
        ${this.isRenaming
          ? html`
              <input
                slot="title"
                type="text"
                maxlength="256"
                part="wy-input"
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
          : html`
              <span slot="title" title=${file.name + (this.status.text ? `: ${this.status.text}` : "")}>
                <slot name="title"
                  >${this.title || file.name}${this.status.text ? html`: <em>${this.status.text}</em>` : nothing}</slot
                >
              </span>
            `}

        <slot slot="actions" name="actions">
          <wy-file-menu
            .file=${file}
            @edit-name=${(e: FileEditNameEventType) => this.dispatchEditName(e.detail.file)}
            @trash=${(e: FileTrashEventType) => this.dispatchTrash(e.detail.file)}
            @restore=${(e: FileRestoreEventType) => this.dispatchRestore(e.detail.file)}
            @delete-forever=${(e: FileDeleteForeverEventType) => this.dispatchDeleteForever(e.detail.file)}
            @subscribe=${(e: FileSubscribeEventType) => this.dispatchSubscribe(e.detail.file, e.detail.subscribe)}
          >
          </wy-file-menu>
        </slot>
      </wy-item>
    `;
  }
}
