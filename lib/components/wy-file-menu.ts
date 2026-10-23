import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { msg, localized, str } from "@lit/localize";
import { consume } from "@lit/context";
import { getIcon, isFileEditable } from "../utils/files";
import { type FileType } from "../types/files.types";
import { openUrl } from "../utils/urls";
import { toKebabCase } from "../utils/strings";
import { type ComponentFeaturePolicy, FeaturePolicyContext } from "../contexts/features-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { iconNamesType } from "../utils/icons";
import { Feature } from "../types/features.types";
import {
  FileCommentsEventType,
  FileDeleteForeverEventType,
  FileEditEventType,
  FileEditNameEventType,
  FileRestoreEventType,
  FileSaveEventType,
  FileSubscribeEventType,
  FileTrashEventType,
  FileVersionsEventType,
} from "../types/files.events";
import { NamedEvent } from "../types/generic.types";
import { hasAnyPermission } from "../utils/permission";
import { AppType, PermissionType } from "../types/app.types";
import { AppContext } from "../contexts/apps-context";
import { WeavyContext, WeavyType } from "../contexts/weavy-context";
import { UserContext, UserType } from "../contexts";
import { EditorDraftType } from "../types/editor.types";
import { QueryController } from "../controllers/query-controller";
import { getDraftOptions, getFileDraftKey, removeDraft } from "../data/drafts";

import "./ui/wy-icon";
import "./ui/wy-button";
import "./ui/wy-dropdown";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-menu": WyFileMenu;
  }
}

/**
 * File actions, with Publish and Discard while editing. Publish is disabled until the editor has produced a draft,
 * and Discard both drops the draft and leaves edit mode, so it doubles as the way to close an unchanged edit.
 *
 * In preview mode with an unsaved draft, the dropdown starts with Publish and Discard, which act on the draft
 * without opening the editor, and the toolbar has a single "Continue editing" button while the draft itself is the
 * viewed entry (`draftActive`); a stored version viewed alongside the draft gets no toolbar button. Without a draft,
 * editing starts from
 * the Edit item first in the dropdown instead, which is hidden while an older version (`oldVersionActive`) is viewed
 * since editing always starts from the current version. Comments are a toolbar button without a draft and move
 * into the dropdown while a draft exists, so the toolbar holds only "Continue editing" then.
 *
 * **Used sub components:**
 *
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-divider>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @slot - Additional file menu items
 *
 * @fires {FileSaveEventType} save - Emitted when file save is requested.
 * @fires {FileEditEventType} edit - Emitted when file edit mode change is requested.
 * @fires {FileEditNameEventType} edit-name - Emitted when rename mode should be activated.
 * @fires {FileSubscribeEventType} subscribe - Emitted when subscribe/unsubscribe is requested.
 * @fires {FileTrashEventType} trash - Emitted when a file should be moved to trash.
 * @fires {FileRestoreEventType} restore - Emitted when a trashed file should be restored.
 * @fires {FileDeleteForeverEventType} delete-forever - Emitted when a file should be permanently deleted.
 * @fires {FileCommentsEventType} comments - Emitted when file comments should be opened.
 * @fires {FileVersionsEventType} versions - Emitted when file versions should be opened.
 */
@customElement("wy-file-menu")
@localized()
export class WyFileMenu extends LitElement {
  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy: WeavyType | undefined;

  /**
   * @internal
   * Consumed feature policy controlling which actions are available.
   */
  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  protected componentFeatures?: ComponentFeaturePolicy | undefined;

  /**
   * The app data.
   * @internal
   */
  @consume({ context: AppContext, subscribe: true })
  @state()
  app: AppType | undefined;

  /**
   * Current user data.
   * @internal
   */
  @consume({ context: UserContext, subscribe: true })
  @state()
  user: UserType | undefined;

  /**
   * File to operate on when rendering menu actions.
   */
  @property({ type: Object })
  file?: FileType;

  /**
   * Render the dropdown using compact button styling.
   */
  @property({ type: Boolean })
  small: boolean = false;

  @property({ type: Boolean })
  hasEdit: boolean = false;

  @property({ type: Boolean })
  hasComments: boolean = false;

  @property({ type: Boolean })
  hasVersions: boolean = false;

  /**
   * Whether the subscribe/unsubscribe item may be shown. Defaults to true since the item is otherwise gated by
   * a `subscribe` listener; set to false for attachments, which cannot be subscribed to on their own.
   */
  @property({ type: Boolean })
  hasSubscribe: boolean = true;

  /**
   * Whether the rename item may be shown. Defaults to true since the item is otherwise gated by an `edit-name`
   * listener and the file rename feature; set to false for attachments, which inherit the features of the block
   * that opened them (e.g. file rename from the Files block) but are not renamable.
   */
  @property({ type: Boolean })
  hasRename: boolean = true;

  /**
   * Indicates edit mode if available.
   */
  @property({ type: Boolean })
  editActive: boolean = false;

  /**
   * Indicates edit mode if available.
   */
  @property({ type: Boolean })
  editNameActive: boolean = false;

  /**
   * Whether the unsaved draft is the viewed entry in preview mode. "Continue editing" is only offered while the
   * draft itself is on screen, not while a stored version is viewed alongside it.
   */
  @property({ type: Boolean })
  draftActive: boolean = false;

  /**
   * Whether an older stored version is shown instead of the current one. Editing always starts from the current
   * version, so the Edit item is hidden to avoid suggesting that the shown version would be edited.
   */
  @property({ type: Boolean })
  oldVersionActive: boolean = false;

  @property({ type: Boolean })
  commentsActive: boolean = false;

  @property({ type: Boolean })
  versionsActive: boolean = false;

  /**
   * Id used for handling drafts.
   * @internal
   */
  @state()
  draftKey?: string;

  /**
   * Query controller for getting file draft.
   * @internal
   */
  private draftQuery = new QueryController<EditorDraftType>(this);

  /**
   * Tracks which action events have listeners attached.
   */
  @property({ type: Object })
  hasEventListener: { [key: string]: boolean } = {
    save: false,
    edit: false,
    "edit-name": false,
    subscribe: false,
    trash: false,
    restore: false,
    "delete-forever": false,
  };

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    // Check if any event is listened to

    if (this.hasEventListener) {
      const propertyName = type as keyof typeof this.hasEventListener;
      if (Object.prototype.hasOwnProperty.call(this.hasEventListener, propertyName)) {
        //console.log(`Setting ${propertyName} to true`)
        Object.assign(this.hasEventListener, {
          [propertyName]: true,
        });
      }
    }
    super.addEventListener(type, listener, options);
  }

  /**
   * Open download URL for the current file.
   * @internal
   */
  protected triggerDownload() {
    this.file && openUrl(this.file.download_url, "_top", this.file.name, true);
  }

  /**
   * Open external provider URL for the current file.
   * @internal
   */
  protected triggerExternal() {
    this.file && openUrl(this.file.external_url, "_blank", this.file.name);
  }

  /**
   * Open application-specific URL for the current file.
   * @internal
   */
  protected triggerApplication() {
    this.file && openUrl(this.file.application_url, "_top", this.file.name);
  }

  /**
   * Emit an `save` event for requesting the current file to be saved.
   *
   * @internal
   * @returns Whether the event was not canceled.
   */
  protected dispatchSave() {
    const file = this.file;

    if (file) {
      const event: FileSaveEventType = new (CustomEvent as NamedEvent)("save", { detail: { file } });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit an `edit` event for requesting the current file to be edited.
   *
   * @internal
   * @param edit - Whether the file should be in edit mode.
   * @returns Whether the event was not canceled.
   */
  protected dispatchEdit(edit: boolean) {
    const file = this.file;

    if (file) {
      const event: FileEditEventType = new (CustomEvent as NamedEvent)("edit", { detail: { file, edit } });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit an `edit-name` event to enter rename mode for the current file.
   *
   * @internal
   * @returns Whether the event was not canceled.
   */
  protected dispatchEditName(editName: boolean) {
    const file = this.file;

    if (file) {
      const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", { detail: { file, editName } });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `subscribe` event toggling subscription state.
   *
   * @internal
   * @param subscribe - Desired subscription setting.
   */
  protected dispatchSubscribe(subscribe: boolean) {
    const file = this.file;

    if (file) {
      const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", {
        detail: {
          file,
          subscribe,
        },
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `trash` event for the current file.
   * @internal
   */
  protected dispatchTrash() {
    const file = this.file;

    if (file) {
      const event: FileTrashEventType = new (CustomEvent as NamedEvent)("trash", {
        detail: { file },
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `restore` event for the current file.
   * @internal
   */
  protected dispatchRestore() {
    const file = this.file;

    if (file) {
      const event: FileRestoreEventType = new (CustomEvent as NamedEvent)("restore", {
        detail: { file },
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `delete-forever` event for the current file.
   * @internal
   */
  protected dispatchDeleteForever() {
    const file = this.file;

    if (file) {
      const event: FileDeleteForeverEventType = new (CustomEvent as NamedEvent)("delete-forever", {
        detail: { file },
      });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `comments` event containing for showing or hiding file comments.
   *
   * @param show - Whether comments should be shown.
   * @returns Whether the event was not canceled.
   */
  protected dispatchComments(show: boolean) {
    const file = this.file;

    if (file) {
      const event: FileCommentsEventType = new (CustomEvent as NamedEvent)("comments", { detail: { file, show } });
      return this.dispatchEvent(event);
    }
    return true;
  }

  /**
   * Emit a `versions` event for showing or hiding file versions.
   *
   * @param show - Whether versions should be shown.
   * @returns Whether the event was not canceled.
   */
  protected dispatchVersions(show: boolean) {
    const file = this.file;

    if (file) {
      const event: FileVersionsEventType = new (CustomEvent as NamedEvent)("versions", { detail: { file, show } });
      return this.dispatchEvent(event);
    }
    return true;
  }

  protected toggleEdit() {
    if (!this.file) {
      return;
    }

    const active = !this.editActive;

    if (this.dispatchEdit(active)) {
      this.editActive = active;
    }
  }

  protected toggleEditName() {
    if (!this.file) {
      return;
    }

    const active = !this.editNameActive;

    if (this.dispatchEditName(active)) {
      this.editNameActive = active;
    }
  }

  protected toggleComments() {
    if (!this.file) {
      return;
    }

    const active = !this.commentsActive;

    if (this.dispatchComments(active)) {
      this.commentsActive = active;
    }
  }

  protected toggleVersions() {
    if (!this.file) {
      return;
    }

    const active = !this.versionsActive;

    if (this.dispatchVersions(active)) {
      this.versionsActive = active;
    }
  }

  /**
   * Removes any draft for the current file.
   */
  removeDraft() {
    if (this.weavy && this.draftKey) {
      void removeDraft(this.weavy, this.draftKey);
    }
  }

  isNotTemp() {
    return this.file && this.file.id >= 1;
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("user") || changedProperties.has("file")) &&
      this.weavy
    ) {
      this.draftKey = this.file ? getFileDraftKey(this.file) : undefined;
    }

    if ((changedProperties.has("weavy") || changedProperties.has("draftKey")) && this.weavy) {
      if (this.draftKey) {
        await this.draftQuery.trackQuery(getDraftOptions(this.weavy, this.draftKey));
      } else {
        this.draftQuery.untrackQuery();
      }
    }
  }

  override render() {
    if (!this.file) {
      return nothing;
    }

    const { data: draftData } = this.draftQuery.result;

    const { icon } = getIcon(this.file.name);

    const isNotTemp = this.isNotTemp();

    const fileProvider = this.file.provider;

    const hasModifyPermission = hasAnyPermission([PermissionType.Create, PermissionType.Admin], this.app?.permissions);
    const isEditable = isFileEditable(this.file, this.app, this.componentFeatures);
    // A cached draft only counts when the user can act on it; otherwise the toolbar and dropdown behave as if there
    // were none, so a read-only view never offers or implies draft actions.
    const draftContent = isEditable ? draftData : undefined;

    return html`
      ${isNotTemp && this.hasEdit && hasModifyPermission && isEditable
        ? html`
            ${this.editActive
              ? html`
                  <wy-button
                    part="wy-save"
                    color="primary"
                    ?disabled=${!draftContent}
                    @click=${() => {
                      this.dispatchSave();
                    }}
                  >
                    ${msg("Publish")}
                  </wy-button>
                  <wy-button
                    @click=${() => {
                      this.removeDraft();
                      this.toggleEdit();
                    }}
                  >
                    ${msg("Discard", { desc: "Button action to discard" })}
                  </wy-button>
                `
              : draftContent && this.draftActive
                ? html`
                    <wy-button color="primary" @click=${() => this.toggleEdit()}>
                      ${msg("Continue editing")}
                    </wy-button>
                  `
                : nothing}
          `
        : nothing}
      ${isNotTemp &&
      !this.editActive &&
      !draftContent &&
      this.componentFeatures?.allowsFeature(Feature.Comments) &&
      this.hasComments &&
      !this.file.is_trashed
        ? html`
            <wy-button
              slot="actions"
              kind="icon"
              ?active=${this.commentsActive}
              @click=${() => {
                this.toggleComments();
              }}
              title=${msg("Comments")}
            >
              <wy-icon-stack>
                ${this.file.comments?.count && this.file.comments?.count > 0
                  ? html`<wy-icon name="comment" state ?active=${!this.commentsActive}></wy-icon>
                      <wy-icon name="comment" layer state ?active=${this.commentsActive}></wy-icon>`
                  : html`<wy-icon name="comment-outline" state ?active=${!this.commentsActive}></wy-icon>
                      <wy-icon name="comment" layer state ?active=${this.commentsActive}></wy-icon>`}
              </wy-icon-stack>
            </wy-button>
          `
        : nothing}

      ${!this.editActive
        ? html`
            <wy-dropdown directionX="left" ?small=${this.small}>
              ${isNotTemp && this.file.is_trashed
                ? html`
                    ${this.hasEventListener["restore"] && hasModifyPermission
                      ? html`
                          <wy-dropdown-item @click=${() => this.dispatchRestore()}>
                            <wy-icon name="delete-restore"></wy-icon>
                            ${msg("Restore")}
                          </wy-dropdown-item>
                        `
                      : nothing}
                    ${this.hasEventListener["restore"] && this.hasEventListener["delete-forever"] && hasModifyPermission
                      ? html` <wy-dropdown-divider></wy-dropdown-divider> `
                      : nothing}
                    ${this.hasEventListener["delete-forever"] && hasModifyPermission
                      ? html`
                          <wy-dropdown-item @click=${() => this.dispatchDeleteForever()}>
                            <wy-icon name="delete-forever"></wy-icon>
                            ${msg("Delete")}
                          </wy-dropdown-item>
                        `
                      : nothing}
                  `
                : nothing}
              ${!this.file.is_trashed
                ? html`
                    ${isNotTemp &&
                    !(this.hasEdit && draftContent) &&
                    !this.oldVersionActive &&
                    this.hasEventListener["edit"] &&
                    hasModifyPermission &&
                    isEditable
                      ? html`
                          <wy-dropdown-item @click=${() => this.dispatchEdit(true)}>
                            <wy-icon name="pencil"></wy-icon>
                            ${msg("Edit")}
                          </wy-dropdown-item>
                        `
                      : nothing}
                    ${isNotTemp && draftContent && hasModifyPermission && isEditable
                      ? html`
                          <wy-dropdown-item @click=${() => this.dispatchSave()}>
                            <wy-icon name="check"></wy-icon>
                            ${msg("Publish")}
                          </wy-dropdown-item>
                          <wy-dropdown-item @click=${() => this.removeDraft()}>
                            <wy-icon name="close"></wy-icon>
                            ${msg("Discard", { desc: "Button action to discard" })}
                          </wy-dropdown-item>
                          <wy-dropdown-divider></wy-dropdown-divider>
                        `
                      : nothing}
                    ${this.file.external_url
                      ? html`
                          <wy-dropdown-item @click=${() => this.triggerExternal()}>
                            <wy-icon name=${icon}></wy-icon>
                            ${msg(str`Open in ${fileProvider}`)}
                          </wy-dropdown-item>
                        `
                      : html`
                          ${this.componentFeatures?.allowsFeature(Feature.WebDAV) &&
                          this.file.application_url &&
                          hasModifyPermission
                            ? html`
                                <wy-dropdown-item @click=${() => this.triggerApplication()}>
                                  <wy-icon
                                    name=${this.file.provider ? toKebabCase<iconNamesType>(this.file.provider) : icon}
                                  ></wy-icon>
                                  ${msg("Edit")}
                                </wy-dropdown-item>
                              `
                            : nothing}
                          <wy-dropdown-item @click=${() => this.triggerDownload()}>
                            <wy-icon name="download"></wy-icon>
                            ${msg("Download")}
                          </wy-dropdown-item>
                        `}
                    ${isNotTemp
                      ? html`
                          ${draftContent && this.componentFeatures?.allowsFeature(Feature.Comments) && this.hasComments
                            ? html`
                                <wy-dropdown-item
                                  ?active=${this.commentsActive}
                                  @click=${() => {
                                    this.toggleComments();
                                  }}
                                >
                                  <wy-icon name=${this.file.comments?.count ? "comment" : "comment-outline"}></wy-icon>
                                  ${msg("Comments")}
                                </wy-dropdown-item>
                              `
                            : nothing}
                          ${this.componentFeatures?.allowsFeature(Feature.Versions) && this.hasVersions
                            ? html`
                                <wy-dropdown-item
                                  ?active=${this.versionsActive}
                                  @click=${() => {
                                    this.toggleVersions();
                                  }}
                                >
                                  <wy-icon name="backup-restore"></wy-icon>
                                  ${msg("Versions")}
                                </wy-dropdown-item>
                              `
                            : nothing}
                          ${this.hasRename && this.hasEventListener["edit-name"] && hasModifyPermission && this.componentFeatures?.allowsFeature(Feature.FileRename)
                            ? html`
                                <wy-dropdown-item @click=${() => this.dispatchEditName(true)}>
                                  <wy-icon name="textbox"></wy-icon>
                                  ${msg("Rename")}
                                </wy-dropdown-item>
                              `
                            : nothing}
                          ${this.hasSubscribe && this.hasEventListener["subscribe"]
                            ? this.file.is_subscribed
                              ? html`
                                  <wy-dropdown-item @click=${() => this.dispatchSubscribe(false)}>
                                    <wy-icon name="bell-off"></wy-icon>
                                    ${msg("Unsubscribe")}
                                  </wy-dropdown-item>
                                `
                              : html`
                                  <wy-dropdown-item @click=${() => this.dispatchSubscribe(true)}>
                                    <wy-icon name="bell"></wy-icon>
                                    ${msg("Subscribe")}
                                  </wy-dropdown-item>
                                `
                            : nothing}
                          ${this.hasEventListener["trash"] && hasModifyPermission
                            ? html`
                                <wy-dropdown-divider></wy-dropdown-divider>
                                <wy-dropdown-item @click=${() => this.dispatchTrash()}>
                                  <wy-icon name="delete"></wy-icon>
                                  ${msg("Trash")}
                                </wy-dropdown-item>
                              `
                            : nothing}
                        `
                      : nothing}
                  `
                : nothing}
              <slot></slot>
            </wy-dropdown>
          `
        : nothing}
    `;
  }
}
