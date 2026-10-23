import { html, nothing } from "lit";
import { localized, msg, str } from "@lit/localize";
import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileOrderByType, FileOrderType, FilesResultType, FileType } from "../types/files.types";
import type {
  FileDeleteForeverEventType,
  FileEditEventType,
  FileEditNameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
} from "../types/files.events";
import { repeat } from "lit/directives/repeat.js";
import { type WeavyType } from "../contexts/weavy-context";
import { inputConsume, clickOnSpace, clickOnEnterAndConsumeOnSpace } from "../utils/keyboard";
import { createRef, ref, RefOrCallback } from "lit/directives/ref.js";
import { autoFocusRef, autoScrollRef, isModifiedClick } from "../utils/dom";
import { partMap } from "../utils/directives/shadow-part-map";
import { customElement, property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { WeavySubTypeComponent } from "../classes/weavy-sub-type-component";
import { NamedEvent } from "../types/generic.types";
import { OrderEventType } from "../types/lists.events";
import { openUrl } from "../utils/urls";
import { Feature } from "../types/features.types";
import type { InfiniteData, InfiniteQueryObserverResult } from "@tanstack/query-core";
import { getFlatInfiniteResultData } from "../utils/query-cache";

export type FileOrderHeaderType = { by: FileOrderByType | undefined; title: string; col: string }[];

import hostContentsCss from "../scss/host-contents.scss";

import inputCss from "../scss/components/input.scss";
import tableCss from "../scss/components/table.scss";
import fileTableCss from "../scss/components/file-table.scss";
import pagerCss from "../scss/components/pager.scss";

import "./wy-file-menu";
import "./wy-file-draft-badge";
import "./ui/wy-icon";
import "./ui/wy-button";
import "./ui/wy-badge";
import { ActionType } from "../types/action.types";

declare global {
  interface HTMLElementTagNameMap {
    "wy-files-table": WyFilesTable;
  }
}

/**
 * Table view for file lists.
 *
 * **Used sub components:**
 *
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
 * - [`<wy-file-draft-badge>`](./wy-file-draft-badge.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @csspart wy-table - Table root element
 * @csspart wy-table-interactive - Modifier for hoverable rows
 * @csspart wy-tr - Table rows
 * @csspart wy-th - Table header cells
 * @csspart wy-col-icon - Cells that contain icons/actions
 * @csspart wy-col-icon-content - Content in icon/action cells
 * @csspart wy-col-name - Cells that contain name
 * @csspart wy-col-time - Cells that contain time
 * @csspart wy-col-kind - Cells that contain kind
 * @csspart wy-col-size - Cells that contain size
 * @csspart wy-sort-link - Sortable table header cell
 * @csspart wy-input - Input field for file rename.
 * @csspart wy-highlight - Modifier for highlighted row
 * @csspart wy-trashed - Modifier for trashed row.
 * @csspart wy-badge - Badge used for comment counts
 * @csspart wy-pager - Pager anchor for infinite scrolling detection.
 * @csspart wy-pager-overlay - Modifier for overlaying pager.
 * @csspart wy-pager-top - Modifier for pager placed in the top.
 * @csspart wy-pager-bottom - Modifier for pager placed in the bottom.
 *
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an entity.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
 */
@customElement("wy-files-table")
@localized()
export class WyFilesTable extends WeavySubTypeComponent {
  static override styles = [inputCss, tableCss, fileTableCss, pagerCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Infinite query result backing the table view.
   *
   * @internal
   */
  @property({ attribute: false })
  infiniteQueryResult?: InfiniteQueryObserverResult<InfiniteData<FilesResultType, unknown>>;

  /**
   * Active sort order for the table.
   */
  @property({ attribute: false })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * File id that is selected.
   */
  @property({ type: Number })
  selectedId?: number = NaN;

  /**
   * Current file id in rename mode.
   *
   * @internal
   */
  @state()
  isRenamingId?: number = NaN;

  /**
   * File id that should be highlighted and scrolled into view.
   *
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
   * Emit an `order` event with the provided sort order.
   *
   * @param order - Order to apply.
   * @returns Whether the event was not canceled.
   */
  dispatchOrder(order: FileOrderType) {
    const event: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(event);
  }

  /**
   * Render the complete file table layout.
   *
   * @param files - Files to render.
   * @param order - Current table order.
   * @param isRenamingId - File id in rename mode.
   * @param highlightId - File id to highlight.
   * @param highlightRef - Reference for scrolling highlighted rows.
   */
  renderFileTable(files: FileType[], order?: FileOrderType, isRenamingId?: number, highlightId?: number) {
    return files && files.length
      ? html`
          <table part="wy-table wy-table-interactive">
            <thead>${this.renderFileTableHeaders.call(this, order)}</thead>
            <tbody>
              ${repeat(
                files,
                (file) => file.id,
                (file) => this.renderFileTableRow.call(this, this.weavy, { file }, isRenamingId, highlightId),
              )}
              ${files.length
                ? html`<tr
                    part="wy-pager wy-pager-overlay wy-pager-top wy-pager-overlay-top"
                    ${ref(this.previousPagerRef)}
                  ></tr>`
                : nothing}
              ${files.length
                ? html`<tr part="wy-pager wy-pager-overlay wy-pager-bottom" ${ref(this.nextPagerRef)}></tr>`
                : nothing}
            </tbody>
          </table>
        `
      : nothing;
  }

  /**
   * Render table header cells with sorting affordances.
   *
   * @param order - Current sort order.
   */
  renderFileTableHeaders(order?: FileOrderType) {
    const headers: FileOrderHeaderType = [
      { col: "icon", by: undefined, title: "" }, // File icon
      { col: "name", by: "name", title: msg("Name") },
      { col: "icon", by: undefined, title: "" }, // Comments icon
      { col: "time", by: "updated_at", title: msg("Modified") },
      { col: "kind", by: undefined, title: msg("Kind") },
      { col: "size", by: "size", title: msg("Size") },
      { col: "icon", by: undefined, title: "" }, // Menu
    ];

    return html`
      <tr>
        ${headers.map((header) => {
          if (header.title) {
            const active = header.by === order?.by;
            const onHeaderClick = (e: Event) => {
              e.preventDefault();
              header.by && this.dispatchOrder({ by: header.by, descending: active && !order?.descending });
            };
            return html` <th part="wy-th ${`wy-col-${header.col}`}">
              ${header.by
                ? html`<div
                    part="wy-sort-link"
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
          } else {
            return html`<th part="wy-th wy-col-icon"></th>`;
          }
        })}
      </tr>
    `;
  }

  /**
   * Render a single file table row.
   *
   * @param weavy - Current Weavy context.
   * @param row - Row data containing the file.
   * @param isRenamingId - File id in rename mode.
   * @param highlightId - File id to highlight.
   */
  renderFileTableRow(
    weavy: WeavyType | undefined,
    { file }: { file: FileType },
    isRenamingId?: number,
    highlightId?: number,
  ) {
    const fileSize = !file.provider || file.size > 0 ? fileSizeAsString(file.size) : nothing;
    const fileChangedAt = file.updated_at || file.created_at;
    const fileDateFull = new Intl.DateTimeFormat(weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
      new Date(fileChangedAt),
    );
    const fileDateShort = new Intl.DateTimeFormat(weavy?.locale, { dateStyle: "short" }).format(
      new Date(fileChangedAt),
    );
    const isRenaming = Boolean(
      this.componentFeatures?.allowsFeature(Feature.FileRename) && isRenamingId && isRenamingId === file.id,
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

    const highlight = Boolean(highlightId && highlightId === file.id);

    return html`
      <tr
        part=${partMap({
          "wy-tr": true,
          "wy-highlight": highlight,
          "wy-trashed": file.is_trashed,
          "wy-selected": isSelected,
        })}
        data-id=${file.id}
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
        ${highlight ? ref(autoScrollRef({ block: "center", behavior: "instant" })) : nothing}
      >
        <td part="wy-td wy-col-icon"
          ><wy-icon
            part="wy-col-icon-content"
            name=${icon}
            .overlayName=${provider}
            size="24"
            kind=${file.kind}
            ext=${ext}
          ></wy-icon
        ></td>
        <td part="wy-td wy-col-name">
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
            : html`${file.name}<wy-file-draft-badge .file=${file}></wy-file-draft-badge>`}
        </td>
        <td part="wy-td wy-col-icon"
          >${this.componentFeatures?.allowsFeature(Feature.Comments) && file.comments?.count
            ? html`<wy-button
                part="wy-col-icon-content"
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
            : nothing}</td
        >
        <td part="wy-td wy-col-time"
          ><time datetime="${fileChangedAt}" title=${fileDateFull}>${fileDateShort}</time></td
        >
        <td part="wy-td wy-col-kind">${file.kind}</td>
        <td part="wy-td wy-col-size">${fileSize}</td>
        <td part="wy-td wy-col-icon">
          <wy-file-menu
            part="wy-col-icon-content"
            .file=${file}
            @edit=${(e: FileEditEventType) => this.dispatchAction({ action: ActionType.Edit, file: e.detail.file })}
            @edit-name=${(e: FileEditNameEventType) =>
              this.dispatchAction({
                action: ActionType.EditName,
                file: e.detail.editName ? e.detail.file : null,
              })}
            @trash=${(e: FileTrashEventType) => this.dispatchAction({ action: ActionType.Trash, file: e.detail.file })}
            @restore=${(e: FileRestoreEventType) =>
              this.dispatchAction({ action: ActionType.Restore, file: e.detail.file })}
            @delete-forever=${(e: FileDeleteForeverEventType) =>
              this.dispatchAction({ action: ActionType.DeleteForever, file: e.detail.file })}
            @subscribe=${(e: FileSubscribeEventType) =>
              this.dispatchAction({
                action: e.detail.subscribe ? ActionType.Subscribe : ActionType.Unsubscribe,
                file: e.detail.file,
              })}
          >
          </wy-file-menu>
        </td>
      </tr>
    `;
  }

  override render() {
    const { data } = this.infiniteQueryResult || {};
    const files = getFlatInfiniteResultData(data);

    if (files && files.length) {
      return this.renderFileTable.call(this, files, this.order, this.isRenamingId, this.highlightId);
    }

    return nothing;
  }
}
