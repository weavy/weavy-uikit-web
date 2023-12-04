import { customElement, property } from "lit/decorators.js";
import WyConversation from "src/components/wy-conversation";
import { ThemeController } from "./controllers/theme-controller";
import { PropertyValues } from "lit";
import colorModes from "./scss/colormodes.scss";
import { QueryController } from "./controllers/query-controller";
import { ConversationType } from "./types/app.types";
import { getApiOptions } from "./data/api";
import { WeavyContextProps } from "./types/weavy.types";

@customElement("wy-chat")
export default class WyChat extends WyConversation {
  static override styles = [...WyConversation.styles, colorModes];

  @property()
  uid?: string;

  private conversationQuery = new QueryController<ConversationType>(this);

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if ((changedProperties.has("weavyContext") || changedProperties.has("uid")) && this.weavyContext) {
      if (this.uid) {
        this.conversationQuery.trackQuery(getApiOptions<ConversationType>(this.weavyContext, ["apps", this.uid]));

      } else {
        this.conversationQuery.untrackQuery();
      }
    }

    if (!this.conversationQuery.result?.isPending) {
      this.conversation = this.conversationQuery.result?.data;
    }

    super.willUpdate(changedProperties);
  }

  constructor() {
    super();
    new ThemeController(this, WyChat.styles);
  }
}
