import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
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
import { WeavyContextProps } from "../types/weavy.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-icon";
import "./wy-dropdown";
import "./wy-empty";
import "./wy-file-menu";
import "./wy-spinner";

import filesCss from "../scss/all";

@customElement("wy-file-versions")
@localized()
export class WyFileVersions extends BlockConsumerMixin(LitElement) {
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
    const event = new CustomEvent("file-version-select", { detail: { versionFile } });
    return this.dispatchEvent(event);
  }

  handleRevert(versionFile: FileType) {
    this.fileVersionRestoreMutation?.mutate({ versionFile });
    this.selectVersion(versionFile);
  }

  handleRemove(versionFile: FileType) {
    this.fileVersionDeleteMutation?.mutate({ versionFile });
    if (this.activeVersion === versionFile) {
      this.activeVersion = this.file;
    }
  }

  triggerDownload(file: FileType) {
    openUrl(file.download_url, "_top", file.name, true);
  }

  override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("file") || changedProperties.has("app")) &&
      this.weavyContext &&
      this.file &&
      this.app
    ) {
      this.fileVersionsQuery.trackQuery(
        getApiOptions<FilesResultType>(
          this.weavyContext,
          getFileVersionsKey(this.app, this.file),
          `/api/files/${this.file.id}/versions`
        )
      );

      this.fileVersionRestoreMutation = getFileVersionRestoreMutation(this.weavyContext, this.app, this.file);
      this.fileVersionDeleteMutation = getFileVersionDeleteMutation(this.weavyContext, this.app, this.file);
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
                const num = data.data!.length - index;
                const ext = getExtension(versionFile.name);
                const modifiedAt = new Date(versionFile.updated_at || versionFile.created_at);
                const isExternal = Boolean(this.file.external_url);

                const dateFull = new Intl.DateTimeFormat(this.weavyContext?.locale, {
                  dateStyle: "full",
                  timeStyle: "short",
                }).format(modifiedAt);
                const dateFromNow = relativeTime(this.weavyContext?.locale, new Date(modifiedAt));

                return isExternal
                  ? html`
                      <wy-empty noNetwork>
                        <span slot="title">${msg("Versions are not available for external cloud files.")}</span>
                      </wy-empty>
                    `
                  : html`
                      <div
                        class="wy-item wy-item-hover wy-item-lg ${classMap({
                          "wy-active": versionFile.version == this.activeVersion?.version,
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
                            · ${versionFile.updated_by?.display_name}</div
                          >
                        </div>

                        <wy-dropdown directionX="left">
                          <wy-dropdown-item @click=${() => this.triggerDownload(versionFile)}>
                            <wy-icon name="download"></wy-icon>
                            ${msg("Download")}
                          </wy-dropdown-item>

                          ${versionFile.version !== this.file.version
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
