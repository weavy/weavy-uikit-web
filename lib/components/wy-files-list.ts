import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import type { FileOpenEventType, FileOrderType, FileType, FileViewType } from "../types/files.types";
import { repeat } from "lit/directives/repeat.js";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { createRef, Ref } from "lit/directives/ref.js";

import { EntityTypes } from "../types/app.types";
import { getEntityChainMatch, hasEntityChildType } from "../utils/notifications";

import { renderFileCard } from "./wy-file-grid";
import { renderFileTable } from "./wy-file-table";

import allCss from "../scss/all";
import { hostScrollYStyles } from "../scss/host";

// wy-file-grid
import gridCss from "../scss/wrappers/grid";
import cardCss from "../scss/wrappers/card";

// wy-file-table

import "./wy-icon";
import "./wy-dropdown";
import "./wy-file-menu";

@customElement("wy-files-list")
@localized()
export class WyFilesList extends BlockConsumerMixin(LitElement) {
  static override styles = [allCss, hostScrollYStyles, gridCss, cardCss];

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  files?: FileType[];

  @property({ type: Number })
  dataUpdatedAt?: number;

  @property({ attribute: false })
  order: FileOrderType = { by: "name", descending: false };

  @property()
  view: FileViewType = "list";

  @state()
  isRenamingId?: number = NaN;

  @state()
  highlightId?: number = NaN;

  @state()
  highlightComment: boolean = false;

  private highlightRef: Ref<HTMLElement> = createRef();

  dispatchFileOpen(fileId: number, tab?: "comments" | "versions") {
    const event: FileOpenEventType = new CustomEvent("file-open", { detail: { fileId, tab } });
    return this.dispatchEvent(event);
  }

  dispatchOrder(order: FileOrderType) {
    const event = new CustomEvent("order", { detail: { order } });
    return this.dispatchEvent(event);
  }

  dispatchEditName(file: FileType) {
    const event = new CustomEvent("edit-name", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchRename(file: FileType, name: string) {
    const event = new CustomEvent("rename", { detail: { file, name } });
    return this.dispatchEvent(event);
  }

  dispatchTrash(file: FileType) {
    const event = new CustomEvent("trash", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchRestore(file: FileType) {
    const event = new CustomEvent("restore", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchDeleteForever(file: FileType) {
    const event = new CustomEvent("delete-forever", { detail: { file } });
    return this.dispatchEvent(event);
  }

  dispatchSubscribe(file: FileType, subscribe: boolean) {
    const event = new CustomEvent("subscribe", { detail: { file, subscribe } });
    return this.dispatchEvent(event);
  }

  constructor() {
    super();
    this.addEventListener("edit-name", (e) => {
      this.isRenamingId = (e as CustomEvent).detail.file.id;
    });
    this.addEventListener("rename", () => {
      this.isRenamingId = NaN;
    });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("link")) {
      this.highlightId = this.link && getEntityChainMatch(this.link, EntityTypes.File)?.id;
      this.highlightComment = this.link && this.highlightId
        ? hasEntityChildType(this.link, EntityTypes.File, { id: this.highlightId }, EntityTypes.Comment)
        : false;
    }

    if (changedProperties.has("highlightComment") && this.highlightComment && this.highlightId) {
      this.dispatchFileOpen(this.highlightId, "comments");
    }
  }

  override render() {
    if (this.files && this.files.length) {
      if (this.view === "grid") {
        return html`
          <div part="wy-grid">
            ${repeat(
              this.files,
              (file) => file.id,
              (file) => renderFileCard.call(this, file, this.isRenamingId, this.highlightId, this.highlightRef)
            )}
          </div>
        `;
      } else {
        return renderFileTable.call(this, this.files, this.order, this.isRenamingId, this.highlightId, this.highlightRef);
      }
    }

    return nothing;
  }

  protected override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("highlightId") && this.highlightId) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
