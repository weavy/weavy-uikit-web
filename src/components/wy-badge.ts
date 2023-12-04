import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import chatCss from "../scss/all.scss";
import { QueryController } from "src/controllers/query-controller";
import { BadgeType } from "src/types/badge.types";
import { getApiOptions } from "src/data/api";
import { WeavyContextProps } from "src/types/weavy.types";

@customElement("wy-badge")
export default class WyBadge extends LitElement {
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false, type: Boolean })
  private: boolean = true;

  @property({ attribute: false, type: Boolean })
  rooms: boolean = true;

  badgeQuery = new QueryController<BadgeType>(this);

  override async updated(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.badgeQuery.trackQuery(getApiOptions(this.weavyContext, ["conversations", "badge"]));
  
      this.weavyContext.subscribe(null, "message_created", this.handleBadgeRefresh);
      this.weavyContext.subscribe(null, "conversation_marked", this.handleBadgeRefresh);
    }
  }

  private handleBadgeRefresh = () => {
    setTimeout(() => this.badgeQuery.result.refetch(), 500);
  };

  override render() {
    const { data, isPending } = this.badgeQuery.result ?? {};
    const badge = data ? (this.private ? data.private : 0) + (this.rooms ? data.rooms : 0) : 0;

    return html`
      ${!isPending && badge > 0 ? html` <span class="wy-badge wy-badge-danger">${badge}</span> ` : nothing}
    `;
  }
}
