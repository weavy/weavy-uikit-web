import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import type { FileOrderType, FileType, FileViewType } from "../types/files.types"
import { repeat } from "lit/directives/repeat.js";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import { renderFileCard } from "./wy-file-grid";
import { renderFileTable } from "./wy-file-table";
import "./wy-icon";
import "./wy-dropdown";
import "./wy-file-menu";
import allCss from "../scss/all"
import { hostScrollYStyles } from "../scss/host";

@customElement("wy-files-list")
@localized()
export class WyFilesList extends LitElement {
  static override styles = [
    allCss,
    hostScrollYStyles,
  ];

  protected exportParts = new ShadowPartsController(this);

  // Used in renderFileTable & renderFileCard
  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({ attribute: false })
  files?: FileType[];

  @property({ type: Number })
  dataUpdatedAt?: number;

  @property({ attribute: false })
  order: FileOrderType = { by: "name", descending: false };

  @property()
  view: FileViewType = "list";

  @property({ type: Number })
  isRenamingId?: number = NaN;

  dispatchFileOpen(file: FileType) {
    const event = new CustomEvent("file-open", { detail: { file } });
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

  override render() {
    if (this.files && this.files.length) {
      if (this.view === "grid") {
        return html`
          <div class="wy-grid wy-pane-group">
            ${repeat(
              this.files,
              (file) => file.id,
              (file) => renderFileCard.call(this, this.weavyContext, { file }, this.isRenamingId)
            )}
          </div>
        `;
      } else {
        return renderFileTable.call(this, this.weavyContext, this.files, this.order, this.isRenamingId);
      }
    }

    return nothing;
  }
}
