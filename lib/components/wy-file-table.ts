import { html, nothing, PropertyValueMap } from "lit";
import { localized, msg, str } from "@lit/localize";
import { fileSizeAsString, getExtension, getIcon, getProvider, handleSelectFilename } from "../utils/files";
import type { FileOrderByType, FileOrderType, FileType } from "../types/files.types";
import type {
  FileDeleteForeverEventType,
  FileEditNameEventType,
  FileOpenEventType,
  FileRenameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
} from "../types/files.events";
import { repeat } from "lit/directives/repeat.js";
import { type WeavyType } from "../contexts/weavy-context";
import { inputConsume, clickOnSpace, clickOnEnterAndConsumeOnSpace } from "../utils/keyboard";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { autofocusRef, isModifiedClick } from "../utils/dom";
import { partMap } from "../utils/directives/shadow-part-map";
import { customElement, property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { NamedEvent } from "../types/generic.types";
import { OrderEventType } from "../types/lists.events";
import { openUrl } from "../utils/urls";

export type FileOrderHeaderType = { by: FileOrderByType | undefined; title: string; col: string }[];

import hostContentsCss from "../scss/host-contents.scss";

import inputCss from "../scss/components/input.scss";
import tableCss from "../scss/components/table.scss";
import fileTableCss from "../scss/components/file-table.scss";

import "./wy-file-menu";
import "./ui/wy-icon";
import "./ui/wy-button";
import "./ui/wy-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-table": WyFileTable;
  }
}

/**
 * Table view for file lists.
 *
 * **Used sub components:**
 *
 * - [`<wy-file-menu>`](./wy-file-menu.ts)
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
@customElement("wy-file-table")
@localized()
export class WyFileTable extends WeavySubComponent {
  static override styles = [inputCss, tableCss, fileTableCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Files rendered in the table view.
   */
  @property({ attribute: false })
  files?: FileType[];

  /**
   * Active sort order for the table.
   */
  @property({ attribute: false })
  order: FileOrderType = { by: "name", descending: false };

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
   * Scroll target used for highlighted rows.
   *
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
   * Emit a `file-open` event requesting preview for the supplied file.
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
   * Emit an `edit-name` event to enter rename mode for the specified file.
   *
   * @param file - File that should be renamed.
   * @returns Whether the event was not canceled.
   */
  dispatchEditName(file: FileType) {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", { detail: { file } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `rename` event carrying the updated filename.
   *
   * @param file - File being renamed.
   * @param name - New filename value.
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
   * Emit a `subscribe` event toggling subscription state for the file.
   *
   * @param file - File whose subscription changes.
   * @param subscribe - Desired subscription state.
   * @returns Whether the event was not canceled.
   */
  dispatchSubscribe(file: FileType, subscribe: boolean) {
    const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { file, subscribe } });
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
  renderFileTable(
    files: FileType[],
    order?: FileOrderType,
    isRenamingId?: number,
    highlightId?: number,
    highlightRef?: Ref
  ) {
    return files && files.length
      ? html`
          <table part="wy-table wy-table-interactive">
            <thead>${this.renderFileTableHeaders.call(this, order)}</thead>
            <tbody>
              ${repeat(
                files,
                (file) => file.id,
                (file) =>
                  this.renderFileTableRow.call(this, this.weavy, { file }, isRenamingId, highlightId, highlightRef)
              )}
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
   * @param highlightRef - Reference for scrolling highlighted rows.
   */
  renderFileTableRow(
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

    const highlight = Boolean(highlightId && highlightId === file.id);

    return html`
      <tr
        part=${partMap({ "wy-tr": true, "wy-highlight": highlight, "wy-trashed": file.is_trashed })}
        @click=${(e: MouseEvent) => {
          if (isModifiedClick(e)) {
            e.stopPropagation();
            e.preventDefault();
            openUrl(file.download_url ?? file.external_url, "_blank");
          }

          !e.defaultPrevented && !file.is_trashed && this.dispatchFileOpen(file.id);
        }}
        ${highlight && highlightRef ? ref(highlightRef) : nothing}
      >
        <td part="wy-td wy-col-icon"
          ><wy-icon part="wy-col-icon-content" name=${icon} .overlayName=${provider} size="24" kind=${file.kind} ext=${ext}></wy-icon
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
                  ${ref(autofocusRef)}
                />
              `
            : html`${file.name}`}
        </td>
        <td part="wy-td wy-col-icon"
          >${file.comments?.count
            ? html`<wy-button
                part="wy-col-icon-content"
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
            @edit-name=${(e: FileEditNameEventType) => this.dispatchEditName(e.detail.file)}
            @trash=${(e: FileTrashEventType) => this.dispatchTrash(e.detail.file)}
            @restore=${(e: FileRestoreEventType) => this.dispatchRestore(e.detail.file)}
            @delete-forever=${(e: FileDeleteForeverEventType) => this.dispatchDeleteForever(e.detail.file)}
            @subscribe=${(e: FileSubscribeEventType) => this.dispatchSubscribe(e.detail.file, e.detail.subscribe)}
          >
          </wy-file-menu>
        </td>
      </tr>
    `;
  }

  override render() {
    if (this.files && this.files.length) {
      return this.renderFileTable.call(
        this,
        this.files,
        this.order,
        this.isRenamingId,
        this.highlightId,
        this.highlightRef
      );
    }

    return nothing;
  }

  protected override updated(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("highlightId") && this.highlightId) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
