import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { FileType, FilesResultType } from "../types/files.types";
import { getExtension, getIcon } from "../utils/files";
import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import { repeat } from "lit/directives/repeat.js";
import {
  FileVersionDeleteMutationType,
  FileVersionMutationType,
  getFileVersionDeleteMutation,
  getFileVersionRestoreMutation,
  getFileVersionsKey,
} from "../data/file-versions";
import { openUrl } from "../utils/urls";
import { relativeTime } from "../utils/datetime";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { FileVersionSelectEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-progress-circular";
import "./wy-empty";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-versions": WyFileVersions;
  }
}

/**
 * File versions list for a file — displays available versions and actions (download, revert, remove).
 *
 * **Used sub components:**
 *
 * - [`<wy-item-list>`](./ui/wy-item.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-divider>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 *
 * @csspart wy-versions - Wrapper for the versions list.
 *
 * @fires {FileVersionSelectEventType} file-version-select - Emitted when a file version is selected.
 */
@customElement("wy-file-versions")
@localized()
export class WyFileVersions extends WeavySubAppComponent {
  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Source file whose version timeline should be displayed.
   */
  @property({ attribute: false })
  file!: FileType;

  /**
   * Currently selected version. Falls back to the latest when unset.
   */
  @property({ attribute: false })
  activeVersion?: FileType;

  /**
   * Query controller fetching the file versions list.
   * @internal
   */
  private fileVersionsQuery = new QueryController<FilesResultType>(this);

  /**
   * Mutation used when reverting to an older version.
   * @internal
   */
  private fileVersionRestoreMutation?: FileVersionMutationType;

  /**
   * Mutation used when removing a version.
   * @internal
   */
  private fileVersionDeleteMutation?: FileVersionDeleteMutationType;

  /**
   * Selects the provided version and emits `file-version-select`.
   *
   * @param versionFile - Version to select.
   */
  selectVersion(versionFile: FileType) {
    this.activeVersion = versionFile;
    this.dispatchFileVersionSelect(versionFile);
  }

  /**
   * Emit a `file-version-select` event with the chosen version.
   *
   * @internal
   * @param versionFile - Version to announce.
   * @returns Whether the event was not canceled.
   */
  dispatchFileVersionSelect(versionFile: FileType) {
    const event: FileVersionSelectEventType = new (CustomEvent as NamedEvent)("file-version-select", {
      detail: { versionFile },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Revert the file to the supplied version.
   *
   * @internal
   * @param versionFile - Version to restore.
   */
  handleRevert(versionFile: FileType) {
    void this.fileVersionRestoreMutation?.mutate({ versionFile });
    this.selectVersion(versionFile);
  }

  /**
   * Remove the supplied version and adjust the active selection if needed.
   *
   * @internal
   * @param versionFile - Version to delete.
   */
  handleRemove(versionFile: FileType) {
    void this.fileVersionDeleteMutation?.mutate({ versionFile });

    if (this.activeVersion === versionFile) {
      this.activeVersion = this.file;
    }
  }

  /**
   * Download the provided version via the browser.
   *
   * @internal
   * @param file - Version file to download.
   */
  triggerDownload(file: FileType) {
    openUrl(file.download_url, "_top", file.name, true);
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("file") || changedProperties.has("app")) &&
      this.weavy &&
      this.file &&
      this.app
    ) {
      await this.fileVersionsQuery.trackQuery(
        getApiOptions<FilesResultType>(
          this.weavy,
          getFileVersionsKey(this.app, this.file),
          `/api/files/${this.file.id}/versions`
        )
      );

      this.fileVersionRestoreMutation = getFileVersionRestoreMutation(this.weavy, this.app, this.file);
      this.fileVersionDeleteMutation = getFileVersionDeleteMutation(this.weavy, this.app, this.file);
    }
  }

  override render() {
    const { data, isPending } = this.fileVersionsQuery.result ?? { isPending: true };

    if (isPending) {
      return html`<wy-progress-circular indeterminate overlay></wy-progress-circular>`;
    }

    return data?.data
      ? html`
          <wy-item-list part="wy-versions">
            ${repeat(
              data.data,
              (versionFile) => versionFile.id,
              (versionFile: FileType, index) => {
                const versionIcon = getIcon(versionFile.name || "").icon;
                const num = data.data ? data.data.length - index : NaN;
                const ext = getExtension(versionFile.name);
                const modifiedAt = new Date(versionFile.updated_at || versionFile.created_at);
                const isExternal = Boolean(this.file.external_url);

                const dateFull = new Intl.DateTimeFormat(this.weavy?.locale, {
                  dateStyle: "full",
                  timeStyle: "short",
                }).format(modifiedAt);
                const dateFromNow = relativeTime(this.weavy?.locale, new Date(modifiedAt));

                return isExternal
                  ? html`
                      <wy-empty noNetwork>
                        <span slot="title">${msg("Versions are not available for external cloud files.")}</span>
                      </wy-empty>
                    `
                  : html`
                      <wy-item
                        size="lg"
                        interactive
                        ?selected=${versionFile.rev == this.activeVersion?.rev}
                        tabindex="0"
                        @click=${() => this.selectVersion(versionFile)}
                        @keydown=${clickOnEnterAndConsumeOnSpace}
                        @keyup=${clickOnSpace}
                      >
                        <wy-icon
                          slot="image"
                          name=${versionIcon}
                          size="48"
                          kind=${versionFile.kind}
                          ext=${ext}
                        ></wy-icon>
                        <span slot="title">${num}. ${versionFile.name}</span>
                        <span slot="text">
                          <time datetime=${versionFile.updated_at || versionFile.created_at} title=${dateFull}
                            >${dateFromNow}</time
                          >
                          ${versionFile.updated_by ? html`· ${versionFile.updated_by?.name}` : nothing}
                        </span>

                        <wy-dropdown slot="actions" directionX="left">
                          <wy-dropdown-item @click=${() => this.triggerDownload(versionFile)}>
                            <wy-icon name="download"></wy-icon>
                            ${msg("Download")}
                          </wy-dropdown-item>

                          ${index !== 0
                            ? html`
                                <wy-dropdown-divider></wy-dropdown-divider>
                                <wy-dropdown-item @click=${() => this.handleRevert(versionFile)}>
                                  <wy-icon name="restore"></wy-icon>
                                  ${"Revert"}
                                </wy-dropdown-item>
                                <wy-dropdown-item @click=${() => this.handleRemove(versionFile)}>
                                  <wy-icon name="delete"></wy-icon>
                                  ${msg("Remove", { desc: "Button action to remove" })}
                                </wy-dropdown-item>
                              `
                            : nothing}
                        </wy-dropdown>
                      </wy-item>
                    `;
              }
            )}
          </wy-item-list>
        `
      : nothing;
  }
}
