import { html, nothing } from "lit";
import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace, inputConsume } from "../utils/keyboard";
import { createRef, ref, RefOrCallback } from "lit/directives/ref.js";
import { autoFocusRef, autoScrollRef, isModifiedClick } from "../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";
import { checkImageLoad, imageLoaded } from "../utils/images";
import { partMap } from "../utils/directives/shadow-part-map";
import { localized, msg, str } from "@lit/localize";
import { openUrl } from "../utils/urls";

import type { FileOrderType, FilesResultType } from "../types/files.types";
import type {
  FileDeleteForeverEventType,
  FileEditNameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
  FileEditEventType,
} from "../types/files.events";
import { customElement, property, state } from "lit/decorators.js";
import { WeavySubTypeComponent } from "../classes/weavy-sub-type-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { repeat } from "lit/directives/repeat.js";
import { range } from "lit/directives/range.js";
import { NamedEvent } from "../types/generic.types";
import { OrderEventType } from "../types/lists.events";
import { Feature } from "../types/features.types";
import type { InfiniteData, InfiniteQueryObserverResult } from "@tanstack/query-core";
import { getFlatInfiniteResultData } from "../utils/query-cache";
import { ActionType } from "../types/action.types";

import inputCss from "../scss/components/input.scss";
import gridCss from "../scss/components/grid.scss";
import cardCss from "../scss/components/card.scss";
import pagerCss from "../scss/components/pager.scss";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./wy-file-menu";
import "./wy-file-draft-badge";
import "./ui/wy-button";
import "./ui/wy-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-files-grid": WyFilesGrid;
  }
}

/**
 * Grid view renderer for files (card view).
 *
 * **Used sub components:**
 *
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
 * - [`<wy-file-draft-badge>`](./wy-file-draft-badge.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @csspart wy-grid - Card grid layout
 * @csspart wy-card - Card root container
 * @csspart wy-trashed - Modifier for trashed cards
 * @csspart wy-card-interactive - Hoverable card modifier
 * @csspart wy-highlight - Highlighted card modifier
 * @csspart wy-card-actions - Container for per-card actions
 * @csspart wy-card-image - Thumbnail image area
 * @csspart wy-card-image-top - Modifier for image top area
 * @csspart wy-card-icon - Icon area for non-image files
 * @csspart wy-card-title - Card title area
 * @csspart wy-card-text - Text in the card
 * @csspart wy-card-button-icon - Title action / badge
 * @csspart wy-badge - Badge used for comment counts
 * @csspart wy-pager - Pager anchor for infinite scrolling detection.
 * @csspart wy-pager-overlay - Modifier for overlaying pager.
 * @csspart wy-pager-top - Modifier for pager placed in the top.
 * @csspart wy-pager-bottom - Modifier for pager placed in the bottom.
 *
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an entity.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
 */
@customElement("wy-files-grid")
@localized()
export class WyFilesGrid extends WeavySubTypeComponent {
  static override styles = [inputCss, gridCss, cardCss, pagerCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Infinite query result backing the file grid.
   *
   * @internal
   */
  @property({ attribute: false })
  infiniteQueryResult?: InfiniteQueryObserverResult<InfiniteData<FilesResultType, unknown>>;

  /**
   * File id that is selected.
   *
   */
  @property({ type: Number })
  selectedId?: number = NaN;

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
   * Reference to the pager element for loading previous items.
   */
  previousPagerRef: RefOrCallback<Element> = createRef();

  /**
   * Reference to the pager element for loading next items.
   */
  nextPagerRef: RefOrCallback<Element> = createRef();

  constructor() {
    super();
    this.addEventListener("wy-action", (e) => {
      if (e.detail.action === ActionType.EditName) {
        this.isRenamingId = e.detail.file ? e.detail.file.id : NaN;
      } else if (e.detail.action === ActionType.Rename) {
        this.isRenamingId = NaN;
      }
    });
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

  override render() {
    const { data } = this.infiniteQueryResult || {};
    const files = getFlatInfiniteResultData(data);

    if (files && files.length) {
      // We may need to fill the grid with placeholders when using reverse infinite scroll to avoid jumping in the layout.
      const previousCount = Math.max((data?.pages[0]?.start ?? NaN) - 1, 0);

      return html`
        <div part="wy-grid">
          ${previousCount
            ? html`
                ${repeat(
                  range(1, previousCount),
                  (i) => i,
                  (i) => html`<div data-id=${i}></div>`,
                )}
                <div ${ref(this.previousPagerRef)} part="wy-pager wy-pager-top" data-count=${previousCount}></div>
              `
            : nothing}
          ${repeat(
            files,
            (file) => file.id,
            (file) => {
              const fileSize = !file.provider || file.size > 0 ? fileSizeAsString(file.size) : nothing;
              const fileChangedAt = file.updated_at || file.created_at;
              const fileDate = new Intl.DateTimeFormat(this.weavy?.locale, {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(fileChangedAt));

              const isRenaming = Boolean(
                this.componentFeatures?.allowsFeature(Feature.FileRename) &&
                this.isRenamingId &&
                this.isRenamingId === file.id,
              );

              const isSelected = this.selectedId === file.id;

              const { icon } = getIcon(file.name);
              const ext = getExtension(file.name);
              const provider = getProvider(file.provider);

              const handleRename = (e: Event) => {
                e.stopImmediatePropagation();

                const renameTarget = e.target as HTMLInputElement;
                if (
                  this.componentFeatures?.allowsFeature(Feature.FileRename) &&
                  renameTarget.value &&
                  renameTarget.value !== file.name
                ) {
                  this.dispatchAction({ action: ActionType.Rename, file: { ...file, name: renameTarget.value } });
                } else {
                  this.dispatchAction({ action: ActionType.EditName, file: null });
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
                    "wy-card-interactive": !file.is_trashed && !isRenaming,
                    "wy-highlight": highlight,
                    "wy-selected": isSelected,
                  })}
                  data-id=${file.id}
                  title="${file.name} • ${fileSize} • ${fileDate}"
                  tabindex="0"
                  @click=${(e: MouseEvent) => {
                    if (file.is_trashed) {
                      return;
                    }

                    if (isModifiedClick(e)) {
                      if (!e.defaultPrevented && this.dispatchAction({ action: ActionType.Open, file })) {
                        e.stopPropagation();
                        e.preventDefault();
                        openUrl(file.download_url ?? file.external_url, "_blank");
                      }
                    } else {
                      !e.defaultPrevented && this.dispatchAction({ action: ActionType.Select, file });
                    }
                  }}
                  @keydown=${clickOnEnterAndConsumeOnSpace}
                  @keyup=${clickOnSpace}
                  ${highlight ? ref(autoScrollRef({ block: "center", behavior: "instant" })) : nothing}
                >
                  <div part="wy-card-actions">
                    <wy-file-draft-badge .file=${file}></wy-file-draft-badge>
                    <wy-file-menu
                      small
                      .file=${file}
                      @edit=${(e: FileEditEventType) =>
                        this.dispatchAction({ action: ActionType.Edit, file: e.detail.file })}
                      @edit-name=${(e: FileEditNameEventType) =>
                        this.dispatchAction({
                          action: ActionType.EditName,
                          file: e.detail.editName ? e.detail.file : null,
                        })}
                      @trash=${(e: FileTrashEventType) =>
                        this.dispatchAction({ action: ActionType.Trash, file: e.detail.file })}
                      @restore=${(e: FileRestoreEventType) =>
                        this.dispatchAction({ action: ActionType.Restore, file: e.detail.file })}
                      @delete-forever=${(e: FileDeleteForeverEventType) =>
                        this.dispatchAction({ action: ActionType.DeleteForever, file: e.detail.file })}
                      @subscribe=${(e: FileSubscribeEventType) =>
                        this.dispatchAction({
                          action: e.detail.subscribe ? ActionType.Subscribe : ActionType.Unsubscribe,
                          file: e.detail.file,
                        })}
                    ></wy-file-menu>
                  </div>
                  ${!file.is_trashed && file.thumbnail_url
                    ? html`
                        <img
                          part="wy-card-image ${partMap({ "wy-card-image-top": file.kind !== "image" })}"
                          width=${ifDefined(file.width)}
                          height=${ifDefined(file.height)}
                          style=${ifDefined(
                            file.width && file.height
                              ? `aspect-ratio: auto ${file.width} / ${file.height};`
                              : undefined,
                          )}
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
                          ${ref(autoFocusRef())}
                        />
                      `
                    : html`<div part="wy-card-title">
                        <div part="wy-card-text">${file.name}</div> ${this.componentFeatures?.allowsFeature(
                          Feature.Comments,
                        ) && file.comments?.count
                          ? html`<wy-button
                              part="wy-card-button-icon"
                              small
                              color="none"
                              kind="inline"
                              @click=${(e: Event) => {
                                if (!e.defaultPrevented && !file.is_trashed) {
                                  (e.target as HTMLElement).blur();
                                  this.dispatchAction({ action: ActionType.Comment, file });
                                  e.stopPropagation();
                                }
                              }}
                              title=${msg(str`${file.comments.count} comments`)}
                            >
                              <wy-badge>${file.comments.count}</wy-badge>
                            </wy-button>`
                          : nothing}
                      </div>`}
                </div>
              `;
            },
          )}
          <div ${ref(this.nextPagerRef)} part="wy-pager wy-pager-overlay wy-pager-bottom"></div>
        </div>
      `;
    }

    return nothing;
  }
}
