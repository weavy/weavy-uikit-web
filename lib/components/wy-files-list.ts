import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import type { FileOrderType, FileType, FileViewType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import { repeat } from "lit/directives/repeat.js";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { createRef, Ref } from "lit/directives/ref.js";
import { EntityTypeString } from "../types/app.types";
import { getEntityChainMatch, hasEntityChildType } from "../utils/notifications";

import allCss from "../scss/all.scss";
import hostScrollYStyles from "../scss/host-scroll-y.scss";

// wy-file-grid
import gridCss from "../scss/components/grid.scss";
import cardCss from "../scss/components/card.scss";

import { renderFileTable } from "./wy-file-table";
import { renderFileCard } from "./wy-file-grid";
import "./base/wy-icon";
import "./base/wy-dropdown";
import "./wy-file-menu";
import { NamedEvent } from "../types/generic.types";

@customElement("wy-files-list")
@localized()
export class WyFilesList extends WeavyComponentConsumerMixin(LitElement) {
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
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId, tab } });
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
      this.highlightId = this.link && getEntityChainMatch(this.link, EntityTypeString.File)?.id;
      this.highlightComment = this.link && this.highlightId
        ? hasEntityChildType(this.link, EntityTypeString.File, { id: this.highlightId }, EntityTypeString.Comment)
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
          <slot name="end"></slot>
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
