import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { FileType, FilesResultType } from "../types/files.types";
import { getExtension, getIcon } from "../utils/files";
import { classMap } from "lit/directives/class-map.js";
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
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import filesCss from "../scss/all.scss";

import "./base/wy-icon";
import "./base/wy-dropdown";
import "./wy-empty";
import "./wy-file-menu";
import "./base/wy-spinner";
import { FileVersionSelectEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

/**
 * @fires {FileVersionSelectEventType} file-version-select
 */
@customElement("wy-file-versions")
@localized()
export class WyFileVersions extends WeavySubComponent {
  static override styles = filesCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  file!: FileType;

  @property({ attribute: false })
  activeVersion?: FileType;

  private fileVersionsQuery = new QueryController<FilesResultType>(this);

  private fileVersionRestoreMutation?: FileVersionMutationType;
  private fileVersionDeleteMutation?: FileVersionDeleteMutationType;

  selectVersion(versionFile: FileType) {
    this.activeVersion = versionFile;
    this.dispatchFileVersionSelect(versionFile);
  }

  dispatchFileVersionSelect(versionFile: FileType) {
    const event: FileVersionSelectEventType = new (CustomEvent as NamedEvent)("file-version-select", { detail: { versionFile } });
    return this.dispatchEvent(event);
  }

  handleRevert(versionFile: FileType) {
    void this.fileVersionRestoreMutation?.mutate({ versionFile });
    this.selectVersion(versionFile);
  }

  handleRemove(versionFile: FileType) {
    void this.fileVersionDeleteMutation?.mutate({ versionFile });

    if (this.activeVersion === versionFile) {
      this.activeVersion = this.file;
    }
  }

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
      return html`<wy-spinner overlay></wy-spinner>`;
    }

    return data?.data
      ? html`
          <div class="wy-list wy-versions">
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
                      <div
                        class="wy-item wy-list-item-lg wy-item-hover ${classMap({
                          "wy-active": versionFile.rev == this.activeVersion?.rev,
                        })}"
                        tabindex="0"
                        @click=${() => this.selectVersion(versionFile)}
                        @keydown=${clickOnEnterAndConsumeOnSpace}
                        @keyup=${clickOnSpace}
                      >
                        <wy-icon name=${versionIcon} size="48" kind=${versionFile.kind} ext=${ext}></wy-icon>
                        <div class="wy-item-body">
                          <div class="wy-item-title">${num}. ${versionFile.name}</div>
                          <div class="wy-item-text">
                            <time datetime=${versionFile.updated_at || versionFile.created_at} title=${dateFull}
                              >${dateFromNow}</time
                            >
                            · ${versionFile.updated_by?.name}</div
                          >
                        </div>

                        <wy-dropdown directionX="left">
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
                      </div>
                    `;
              }
            )}
          </div>
        `
      : nothing;
  }
}
