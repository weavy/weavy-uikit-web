import { LitElement, type PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { type WeavyContextType, weavyContextDefinition } from "../client/context-definition";

import chatCss from "../scss/all";
import { consume } from "@lit/context";
import { localized, msg } from "@lit/localize";

import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import type {
  ConfluenceContentResultType,
  ConfluenceContentType,
  ConfluencePageProps,
  ConfluenceResourceResultType,
  ConfluenceResourceType,
} from "../types/confluence.types";
import type { UserType } from "../types/users.types";
import type { WeavyContextProps } from "../types/weavy.types";

import "./wy-empty";
import "./wy-icon";
import "./wy-spinner";

@customElement("wy-confluence-picker")
@localized()
export default class WyConfluencePicker extends LitElement {
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({
    attribute: false,
  })
  user!: UserType;

  @state()
  unauthorized: boolean = false;

  @state()
  cloudHost?: string;

  @state()
  cloudId?: string;

  @state()
  spaceKey?: string;

  @state()
  spaceId?: string;

  private dispatchSubmit(url: string, id: string, title: string) {
    if (this.cloudHost && this.spaceKey) {
      const submitEvent = new CustomEvent<ConfluencePageProps>("submit", {
        detail: { url, id, title, hostname: this.cloudHost, spaceKey: this.spaceKey },
      });
      this.dispatchEvent(submitEvent);
    }
  }

  private dispatchUnauthorized() {
    const unauthorizedEvent = new CustomEvent("unauthorized");
    return this.dispatchEvent(unauthorizedEvent);
  }

  handleResourceClick(e: MouseEvent, resource: ConfluenceResourceType) {
    e.preventDefault();

    const url = new URL(resource.url);
    this.cloudId = resource.id;
    this.cloudHost = url.hostname;
  }

  handleSpaceClick(e: MouseEvent, id: string | undefined, key: string | undefined) {
    e.preventDefault();

    this.spaceKey = key;
    this.spaceId = id;

    this.confluenceQuery.result?.refetch();
  }

  handlePageClick(e: MouseEvent, url: string, id: string, title: string) {
    e.preventDefault();
    this.dispatchSubmit(url, id, title);
  }

  private confluenceQuery = new QueryController<ConfluenceContentResultType>(this);
  private confluenceResourceQuery = new QueryController<ConfluenceResourceResultType>(this);

  onMessage = async (e: MessageEvent) => {    
    switch (e.data.name) {
      case "confluence-signed-in":
        this.unauthorized = false;
        this.confluenceResourceQuery.result?.refetch();
        break;
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("message", this.onMessage);
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>): void {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.confluenceResourceQuery.trackQuery(
        getApiOptions<ConfluenceResourceResultType>(
          this.weavyContext,
          ["confluence", "resources"],
          "/confluence/resources"
        )
      );
    }

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("cloudId") || changedProperties.has("spaceId")) &&
      this.weavyContext &&
      this.cloudId
    ) {
      this.confluenceQuery.trackQuery(
        getApiOptions<ConfluenceContentResultType>(
          this.weavyContext,
          ["confluence", this.cloudId, "spaces", this.spaceId != null ? this.spaceId + "/pages" : undefined],
          `/confluence/${this.cloudId}/spaces/${this.spaceId != null ? this.spaceId + "/pages" : ""}`
        )
      );
    }
  }

  override render() {
    if (!this.weavyContext?.confluenceAuthenticationUrl) {
      return nothing;
    }

    const { data: confluenceData, isPending: isConfluencePending } = this.confluenceQuery?.result || {};
    const { data: resourceData, isPending: isResourcesPending } = this.confluenceResourceQuery?.result || {};

    if(this.unauthorized){
      return html`<wy-empty><button class="wy-button wy-button-primary" @click=${this.dispatchUnauthorized}>Sign in</button></wy-empty>`;
    } else {
      return html`
      <div class="wy-scroll-y">
        <div class="wy-pane-group">
          ${this.spaceKey
            ? html`
                <a
                  href="#"
                  class="wy-item-body"
                  @click=${(e: MouseEvent) => this.handleSpaceClick(e, undefined, undefined)}
                >
                  <wy-icon name="back"></wy-icon> ${msg("Back")}
                </a>
              `
            : nothing}
          ${isResourcesPending || isConfluencePending ? html` <wy-spinner overlay></wy-spinner> ` : nothing}
          ${!this.cloudId && !isResourcesPending && resourceData
            ? html`
                <h5>${msg("Select a Confluence site")}</h5>
                <div class="wy-list wy-list-bordered">
                  ${repeat(
                    resourceData.resources,
                    (r: ConfluenceResourceType) => r.id,
                    (r: ConfluenceResourceType) => {
                      return html`
                        <a
                          href="#"
                          class="wy-item wy-item-lg wy-item-hover"
                          title=${r.name}
                          @click=${(e: MouseEvent) => this.handleResourceClick(e, r)}
                        >
                          <wy-icon name="earth" size="48"></wy-icon>
                          <div class="wy-item-body ">
                            <div class="wy-item-title">${r.name}</div>
                          </div>
                        </a>
                      `;
                    }
                  )}
                </div>
              `
            : nothing}
          ${this.cloudId && !isConfluencePending && confluenceData
            ? html`
                <div class="wy-list wy-list-bordered">
                  ${repeat(
                    confluenceData.results,
                    (content: ConfluenceContentType) => content.id,
                    (content: ConfluenceContentType) => {
                      return !this.spaceKey
                        ? html`
                            <a
                              href="#"
                              class="wy-item wy-item-lg wy-item-hover"
                              title=${content.name}
                              @click=${(e: MouseEvent) => this.handleSpaceClick(e, content.id, content.key)}
                            >
                              <wy-icon name="confluence" color="native" size="48"></wy-icon>
                              <div class="wy-item-body ">
                                <div class="wy-item-title">${content.name}</div>
                              </div>
                            </a>
                          `
                        : html`
                            <a
                              href="#"
                              class="wy-item wy-item-lg wy-item-hover"
                              title=${content.title}
                              @click=${(e: MouseEvent) =>
                                this.handlePageClick(e, content._links.webui, content.id, content.title)}
                            >
                              <wy-icon name="file" size="48"></wy-icon>
                              <div class="wy-item-body ">
                                <div class="wy-item-title">${content.title}</div>
                              </div>
                            </a>
                          `;
                    }
                  )}
                </div>
              `
            : nothing}
          
        </div>
      </div>
    `;
    }

  
  }

  protected override updated(_changedProperties: PropertyValueMap<this & WeavyContextProps>): void {    
    if (!this.unauthorized &&  this.confluenceResourceQuery.result && !this.confluenceResourceQuery.result.isPending && this.confluenceResourceQuery.result.data?.resources == undefined) {      
        this.unauthorized = true;              
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("message", this.onMessage);
  }
}
