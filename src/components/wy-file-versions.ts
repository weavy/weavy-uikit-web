import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";

import "./wy-icon";
import "./wy-dropdown";
import "./wy-file-menu";
import "./wy-spinner";

import filesCss from "../scss/all.scss";
import type { FileType } from "../types/files.types";
import { getExtension, getIcon } from "../utils/files";
import { classMap } from "lit/directives/class-map.js";
import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { repeat } from "lit/directives/repeat.js";
import type { AppType } from "../types/app.types";
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
import { type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import "./wy-empty";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "src/utils/keyboard";

@customElement("wy-file-versions")
@localized()
export class WyFileVersions extends LitElement {
  static override styles = filesCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  file!: FileType;

  @property({ attribute: false })
  activeVersion?: FileType;

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @state()
  availableFeatures?: FeaturesListType = [];

  private fileVersionsQuery = new QueryController<FileType[]>(this);

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
    console.debug("reverting file version", versionFile.version);
    this.fileVersionRestoreMutation?.mutate({ versionFile });
    this.selectVersion(versionFile);
  }

  handleRemove(versionFile: FileType) {
    console.debug("removing file version", versionFile.version);
    this.fileVersionDeleteMutation?.mutate({ versionFile });
    if (this.activeVersion === versionFile) {
      this.activeVersion = this.file;
    }
  }

  triggerDownload(file: FileType) {
    openUrl(file.download_url, "_top", file.name, true);
  }

  override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if ((changedProperties.has("weavyContext") || changedProperties.has("file")) && this.weavyContext) {
      this.fileVersionsQuery.trackQuery(
        getApiOptions<FileType[]>(
          this.weavyContext,
          getFileVersionsKey(this.app, this.file),
          `files/${this.file.id}/versions`
        )
      );
    }

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("app") || changedProperties.has("file")) &&
      this.weavyContext &&
      this.app &&
      this.file
    ) {
      this.fileVersionRestoreMutation = getFileVersionRestoreMutation(this.weavyContext, this.app, this.file);
      this.fileVersionDeleteMutation = getFileVersionDeleteMutation(this.weavyContext, this.app, this.file);
    }
  }

  override render() {
    const { data, isPending } = this.fileVersionsQuery.result;

    if (isPending) {
      return html`<wy-spinner overlay></wy-spinner>`;
    }

    return data
      ? html`
          <div class="wy-list wy-versions">
            ${repeat(
              data,
              (versionFile) => versionFile.id,
              (versionFile: FileType, index) => {
                const versionIcon = getIcon(versionFile.name || "").icon;
                const num = data.length - index;
                const ext = getExtension(versionFile.name);
                const modifiedAt = new Date(versionFile.modified_at || versionFile.created_at);
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
                            <time datetime=${versionFile.modified_at || versionFile.created_at} title=${dateFull}
                              >${dateFromNow}</time
                            >
                            · ${versionFile.modified_by?.display_name}</div
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
