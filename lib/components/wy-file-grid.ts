import { html, nothing, PropertyValueMap } from "lit";
import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace, inputConsume } from "../utils/keyboard";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { autofocusRef, isModifiedClick } from "../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";
import { checkImageLoad, imageLoaded } from "../utils/images";
import { partMap } from "../utils/directives/shadow-part-map";
import { localized, msg, str } from "@lit/localize";
import { openUrl } from "../utils/urls";

import type { FileOrderType, FileType } from "../types/files.types";
import type {
  FileDeleteForeverEventType,
  FileEditNameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
  FileOpenEventType,
  FileRenameEventType,
} from "../types/files.events";
import { customElement, property, state } from "lit/decorators.js";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { repeat } from "lit/directives/repeat.js";
import { NamedEvent } from "../types/generic.types";
import { OrderEventType } from "../types/lists.events";

import inputCss from "../scss/components/input.scss";
import gridCss from "../scss/components/grid.scss";
import cardCss from "../scss/components/card.scss";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./wy-file-menu";
import "./ui/wy-button";
import "./ui/wy-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-grid": WyFileGrid;
  }
}

/**
 * Grid view renderer for files (card view).
 *
 * **Used sub components:**
 *
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @csspart wy-grid - Card grid layout
 * @csspart wy-card - Card root container
 * @csspart wy-trashed - Modifier for trashed cards
 * @csspart wy-card-hover - Hoverable card modifier
 * @csspart wy-highlight - Highlighted card modifier
 * @csspart wy-card-actions - Container for per-card actions
 * @csspart wy-card-image - Thumbnail image area
 * @csspart wy-card-image-top - Modifier for image top area
 * @csspart wy-card-icon - Icon area for non-image files
 * @csspart wy-card-title - Card title area
 * @csspart wy-card-text - Text in the card
 * @csspart wy-card-button-icon - Title action / badge
 * @csspart wy-badge - Badge used for comment counts
 *
 * @fires {FileOpenEventType} file-open - Emitted when a file should be opened in preview.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
 * @fires {FileEditNameEventType} edit-name - Emitted when rename mode is activated.
 * @fires {FileRenameEventType} rename - Emitted when a file is renamed.
 * @fires {FileTrashEventType} trash - Emitted when a file is trashed.
 * @fires {FileRestoreEventType} restore - Emitted when a file is restored.
 * @fires {FileDeleteForeverEventType} delete-forever - Emitted when a file is permanently deleted.
 * @fires {FileSubscribeEventType} subscribe - Emitted when subscribe state is toggled.
 */
@customElement("wy-file-grid")
@localized()
export class WyFileGrid extends WeavySubComponent {
  static override styles = [inputCss, gridCss, cardCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Files to display in the grid.
   */
  @property({ attribute: false })
  files?: FileType[];

  /**
   * File id currently being renamed.
   * @internal
   */
  @state()
  isRenamingId?: number = NaN;

  /**
   * File id that should be scrolled into view and highlighted.
   * @internal
   */
  @state()
  highlightId?: number = NaN;

  /**
   * Scroll target for a highlighted file card.
   * @internal
   */
  private highlightRef: Ref<HTMLElement> = createRef();

  constructor() {
    super();
    this.addEventListener("edit-name", (e) => {
      this.isRenamingId = (e as FileEditNameEventType).detail.file.id;
    });
    this.addEventListener("rename", () => {
      this.isRenamingId = NaN;
    });
  }

  /**
   * Emit a `file-open` event requesting preview for the given file.
   *
   * @param fileId - Identifier of the file to open.
   * @param tab - Optional preview tab to activate.
   * @returns Whether the event was not canceled.
   */
  dispatchFileOpen(fileId: number, tab?: "comments" | "versions") {
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId, tab } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit an `order` event with the selected sort order.
   *
   * @param order - Order to apply.
   * @returns Whether the event was not canceled.
   */
  dispatchOrder(order: FileOrderType) {
    const event: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit an `edit-name` event to enter rename mode for the given file.
   *
   * @param file - File that should be renamed.
   * @returns Whether the event was not canceled.
   */
  dispatchEditName(file: FileType) {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `rename` event containing the updated file name.
   *
   * @param file - File being renamed.
   * @param name - New filename.
   * @returns Whether the event was not canceled.
   */
  dispatchRename(file: FileType, name: string) {
    const event: FileRenameEventType = new (CustomEvent as NamedEvent)("rename", { detail: { file, name } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `trash` event to move the file to the recycle bin.
   *
   * @param file - File to trash.
   * @returns Whether the event was not canceled.
   */
  dispatchTrash(file: FileType) {
    const event: FileTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `restore` event to recover a trashed file.
   *
   * @param file - File to restore.
   * @returns Whether the event was not canceled.
   */
  dispatchRestore(file: FileType) {
    const event: FileRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `delete-forever` event to permanently remove a file.
   *
   * @param file - File to delete.
   * @returns Whether the event was not canceled.
   */
  dispatchDeleteForever(file: FileType) {
    const event: FileDeleteForeverEventType = new (CustomEvent as NamedEvent)("delete-forever", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `subscribe` event toggling file subscription.
   *
   * @param file - File to subscribe or unsubscribe.
   * @param subscribe - Desired subscription state.
   * @returns Whether the event was not canceled.
   */
  dispatchSubscribe(file: FileType, subscribe: boolean) {
    const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { file, subscribe } });
    return this.dispatchEvent(event);
  }

  override render() {
    if (this.files && this.files.length) {
      return html`
        <div part="wy-grid">
          ${repeat(
            this.files,
            (file) => file.id,
            (file) => {
              const fileSize = file.size && file.size > 0 ? fileSizeAsString(file.size) : nothing;
              const fileChangedAt = file.updated_at || file.created_at;
              const fileDate = new Intl.DateTimeFormat(this.weavy?.locale, {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(fileChangedAt));
              const isRenaming = Boolean(this.isRenamingId && this.isRenamingId === file.id);

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

              const highlight = Boolean(this.highlightId && this.highlightId === file.id);

              return html`
                <div
                  part=${partMap({
                    "wy-card": true,
                    "wy-trashed": file.is_trashed,
                    "wy-card-hover": !file.is_trashed && !isRenaming,
                    "wy-highlight": highlight,
                  })}
                  title="${file.name} • ${fileSize} • ${fileDate}"
                  tabindex="0"
                  @click=${(e: MouseEvent) => {
                    if (isModifiedClick(e)) {
                      e.stopPropagation();
                      e.preventDefault();
                      openUrl(file.download_url ?? file.external_url, "_blank");
                    }
                    !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(file.id);
                  }}
                  @keydown=${clickOnEnterAndConsumeOnSpace}
                  @keyup=${clickOnSpace}
                  ${highlight && this.highlightRef ? ref(this.highlightRef) : nothing}
                >
                  <div part="wy-card-actions">
                    <wy-file-menu
                      small
                      .file=${file}
                      @edit-name=${(e: FileEditNameEventType) => this.dispatchEditName(e.detail.file)}
                      @trash=${(e: FileTrashEventType) => this.dispatchTrash(e.detail.file)}
                      @restore=${(e: FileRestoreEventType) => this.dispatchRestore(e.detail.file)}
                      @delete-forever=${(e: FileDeleteForeverEventType) => this.dispatchDeleteForever(e.detail.file)}
                      @subscribe=${(e: FileSubscribeEventType) =>
                        this.dispatchSubscribe(e.detail.file, e.detail.subscribe)}
                    ></wy-file-menu>
                  </div>
                  ${!file.is_trashed && file.thumbnail_url
                    ? html`
                        <img
                          part="wy-card-image ${partMap({ "wy-card-image-top": file.kind !== "image" })}"
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
                        <div part="wy-card-icon ">
                          <wy-icon
                            name=${icon}
                            .overlayName=${provider}
                            size="96"
                            kind=${file.kind}
                            ext=${ext}
                          ></wy-icon>
                        </div>
                      `}
                  ${isRenaming
                    ? html`
                        <input
                          type="text"
                          name="filename"
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
                    : html`<div part="wy-card-title">
                        <div part="wy-card-text">${file.name}</div> ${file.comments?.count
                          ? html`<wy-button
                              part="wy-card-button-icon"
                              small
                              color="none"
                              kind="inline"
                              @click=${(e: Event) => {
                                if (!e.defaultPrevented && !file.is_trashed) {
                                  (e.target as HTMLElement).blur();
                                  this.dispatchFileOpen(file.id, "comments");
                                  e.stopPropagation();
                                }
                              }}
                              title=${msg(str`${file.comments.count} comments`)}
                            >
                              <wy-badge count=${file.comments.count}></wy-badge>
                            </wy-button>`
                          : nothing}
                      </div>`}
                </div>
              `;
            }
          )}
        </div>
      `;
    }

    return nothing;
  }

  protected override updated(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("highlightId") && this.highlightId) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
