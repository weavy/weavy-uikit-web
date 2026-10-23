import { html, nothing, PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { FileType } from "../types/files.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { QueryController } from "../controllers/query-controller";
import { getDraftOptions, getFileDraftKey } from "../data/drafts";
import type { EditorDraftType } from "../types/editor.types";
import { isFileEditable } from "../utils/files";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-draft-badge": WyFileDraftBadge;
  }
}

/**
 * "Draft" badge shown next to a file name while the file has unsaved edits.
 *
 * The badge is only shown when the user can act on the draft, i.e. when the file is editable for them. A draft is
 * cached per file in the browser tab and can outlive the right to edit (revoked permission, file editing turned off),
 * and then it is better left unmentioned than advertised without a way to publish or discard it.
 *
 * Each badge observes the draft query of its own file, so file lists can drop one into every row and let the badge
 * appear and disappear as the editor saves or discards the draft, without the list tracking drafts itself.
 *
 * **Used sub components:**
 *
 * - [`<wy-badge>`](./ui/wy-badge.ts)
 *
 * @csspart wy-badge - The badge element.
 */
@localized()
@customElement("wy-file-draft-badge")
export class WyFileDraftBadge extends WeavySubAppComponent {
  static override styles = [hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * File whose draft is indicated.
   */
  @property({ type: Object })
  file?: FileType;

  /**
   * Id used for handling drafts.
   * @internal
   */
  draftKey?: string;

  /**
   * Query controller for getting the file draft.
   * @internal
   */
  private draftQuery = new QueryController<EditorDraftType>(this);

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("file")) && this.weavy) {
      // The key only depends on the file id, so a list reusing this element for another file retargets the query.
      const draftKey = this.file ? getFileDraftKey(this.file) : undefined;
      if (draftKey !== this.draftKey) {
        this.draftKey = draftKey;
        if (draftKey) {
          await this.draftQuery.trackQuery(getDraftOptions(this.weavy, draftKey));
        } else {
          this.draftQuery.untrackQuery();
        }
      }
    }
  }

  override render() {
    const { data: draftContent } = this.draftQuery.result;

    if (!draftContent || !isFileEditable(this.file, this.app, this.componentFeatures)) {
      return nothing;
    }

    return html`<wy-badge reveal>${msg("Draft")}</wy-badge>`;
  }
}
