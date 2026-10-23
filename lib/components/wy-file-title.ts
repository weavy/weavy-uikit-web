import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { FileType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { AccessType, PermissionType } from "../types/app.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { localized } from "@lit/localize";
import { NamedEvent } from "../types/generic.types";
import { FileEditNameEventType, FileRenameEventType } from "../types/files.events";
import { hasAnyPermission } from "../utils/permission";
import { Feature } from "../types/features.types";

import inputCss from "../scss/components/input.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-file-item";
import "./wy-file-draft-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-title": WyFileTitle;
  }
}

/**
 * File list item showing file icon, name and actions.
 *
 * **Used sub components:**
 *
 * - [`<wy-file-item>`](./wy-file-item.ts)
 * - [`<wy-file-draft-badge>`](./wy-file-draft-badge.ts)
 *
 * @slot title - Custom title content for the item.
 * @slot actions - Actions slot (e.g. buttons / menus).
 *
 * @fires {FileEditEventType} edit - Emitted when file edit mode change is requested.
 * @fires {FileEditNameEventType} edit-name - Emitted when rename mode is activated.
 * @fires {FileRenameEventType} rename - Emitted when a file is renamed.
 */
@localized()
@customElement("wy-file-title")
export class WyFileTitle extends WeavySubAppComponent {
  static override styles = [inputCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * File data displayed in the list item.
   */
  @property({ type: Object })
  file?: FileType;

  /**
   * Indicates if edit name mode is available.
   *
   * @attr
   */
  @property({ type: Boolean })
  hasEditName: boolean = false;

  /**
   * Puts the current file in edit mode if available.
   *
   * @attr
   */
  @property({ type: Boolean })
  editName: boolean = false;

  /**
   * Render the item with rounded corners.
   */
  @property({ type: Boolean })
  rounded: boolean = false;

  /**
   * Whether the unsaved draft of the file is shown or edited. A "Draft" badge is then displayed next to the name
   * once a draft exists, so the title says what is on screen rather than only hinting at unsaved changes.
   */
  @property({ type: Boolean })
  draft: boolean = false;

  /**
   * Emit an `edit-name` event to enter rename mode for the given file.
   *
   * @param file - File that should be renamed.
   * @returns Whether the event was not canceled.
   */
  dispatchEditName(file: FileType, editName: boolean) {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", { detail: { file, editName } });
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

  override render() {
    const file = this.file;
    if (!file) return nothing;

    //const isMarkdown = file?.media_type === "text/markdown";

    const hasModifyPermission = hasAnyPermission([PermissionType.Create, PermissionType.Admin], this.app?.permissions);

    const hasRenameFeature = this.componentFeatures?.allowsFeature(Feature.FileRename) ?? false;

    const isRenaming =
      hasModifyPermission && hasRenameFeature && this.app?.access === AccessType.Write && !file.is_trashed && this.editName;

    return html`
      <wy-file-item
        ?rounded=${this.rounded}
        .file=${file}
        slot="title"
        .hasEditName=${this.hasEditName && this.app?.access === AccessType.Write}
        .isRenaming=${isRenaming}
        @edit-name=${(e: FileEditNameEventType) => {
          this.dispatchEditName(e.detail.file, e.detail.editName);
          this.editName = e.detail.editName;
        }}
        @rename=${(e: FileRenameEventType) => {
          this.dispatchRename(e.detail.file, e.detail.name);
          this.editName = false;
        }}
      >
        ${this.draft ? html`<wy-file-draft-badge slot="actions" .file=${file}></wy-file-draft-badge>` : nothing}
        <slot name="actions" slot="actions"></slot>
      </wy-file-item>
    `;
  }
}
