import { LitElement, html, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { localized, msg, str } from "@lit/localize";

import chatCss from "../scss/all.scss";
import { RealtimeEventType, RealtimeTypingEventType } from "src/types/realtime.types";
import { UserType } from "src/types/users.types";
import { WeavyContextProps } from "src/types/weavy.types";

@customElement("wy-typing")
@localized()
export default class WyTyping extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: true, type: Number })
  appId!: number;

  @property({ attribute: true, type: Number })
  userId!: number;

  @state()
  activeTypers: Array<UserType & { time: number }> = [];

  @state()
  text: string = "";

  @state()
  typingTimeout: number | null = null;

  handleRealtimeTyping = (realtimeEvent: RealtimeTypingEventType) => {
    if (realtimeEvent.entity.id === this.appId && realtimeEvent.actor.id !== this.userId) {
      this.setTypers(realtimeEvent.actor);
      this.updateTyping();
    }
  };

  handleRealtimeStopTyping = (realtimeEvent: RealtimeEventType) => {
    const typers = this.activeTypers;

    // remove typing indicator for message sender
    typers.forEach((item, index) => {
      if (item.id === realtimeEvent.actor.id) {
        typers.splice(index, 1);
      }
    });
    this.updateTyping();
  };

  private updateTyping() {
    const typers = this.activeTypers;
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    // discard typing events older than 5 seconds
    const now = Date.now();
    typers.forEach((item, index) => {
      if (now - item.time > 5 * 1000) {
        typers.splice(index, 1);
      }
    });

    if (typers.length) {
      // use age of typing event to animate ellipsis...
      const dots =
        (Math.round(
          (now -
            Math.max.apply(
              null,
              typers.map((x) => {
                return x.time;
              })
            )) /
            1000
        ) %
          3) +
        1;

      const ellipsis = ".".repeat(dots); //+ (".").repeat(3 - dots);

      // merge names of people typing
      const names = typers.map((item) => item.display_name).sort();

      // TODO: Replace with translation friendly string template
      let typingText = "";

      if (names.length === 1) {
        // Single person typing
        const name = names[0]
        typingText = msg(str`${name} is typing${ellipsis}`, { desc: "A is typing..." });
      } else {
        // Multiple typing
        const nameList = new Intl.ListFormat(this.weavyContext?.locale, { style: 'long', type: 'conjunction' }).format(names);
        typingText = msg(str`${nameList} are typing${ellipsis}`, {
          desc: "A, B and C are typing...",
        });
      }

      // update gui
      this.text = typingText;

      // schedule another call to updateTyping in 1 second
      this.typingTimeout = window.setTimeout(() => this.updateTyping(), 1000);
    } else {
      this.text = "";
    }
  }

  private setTypers(actor: UserType) {
    const typers = this.activeTypers;
    // remove existing typing events by this user (can only type in one conversation at a time)
    typers.forEach((item, index) => {
      if (item.id === actor.id) {
        typers.splice(index, 1);
      }
    });

    // track time when we received this event
    const trackedActor = { ...actor, time: Date.now() }
    typers.push(trackedActor);
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>): void {
    if ((changedProperties.has("weavyContext") || changedProperties.has("appId") || changedProperties.has("userId")) && this.weavyContext) {
      this.activeTypers = [];

      if (changedProperties.get("appId") && changedProperties.get("appId") !== this.appId) {
        this.weavyContext.unsubscribe(`a${this.appId}`, "typing", this.handleRealtimeTyping);
        this.weavyContext.unsubscribe(`a${this.appId}`, "message_created", this.handleRealtimeStopTyping);
      }

      // realtime
      this.weavyContext.subscribe(`a${this.appId}`, "typing", this.handleRealtimeTyping);
      this.weavyContext.subscribe(`a${this.appId}`, "message_created", this.handleRealtimeStopTyping);
    }
  }

  override render() {
    return this.text ? html`<span>${this.text}</span>` : html`<slot></slot>`;
  }
}
