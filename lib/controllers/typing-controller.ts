import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { RealtimeEventType, RealtimeTypingEventType } from "../types/realtime.types";
import type { TypingUserType, UserType } from "../types/users.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";

export class TypingController implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyContextType }, LitElement>;
  whenContext?: Promise<WeavyContextType>;
  resolveContext?: (value: WeavyContextType | PromiseLike<WeavyContextType>) => void;
  
  get weavyContext() {
    return this.context?.value;
  }

  private typingTimeout: number | null = null;
  
  // Inputs
  private _appId?: number;
  private _userId?: number;

  get appId() {
    return this._appId;
  }

  set appId(appId: number | undefined) {
    if (appId !== this._appId) {
      this.typingMembers = [];
      this.unregisterRealtime();
      this._appId = appId;
      this.registerRealtime();
    }
  }

  get userId() {
    return this._userId;
  }

  set userId(userId: number | undefined) {
    if (userId !== this._userId) {
      this.typingMembers = [];
      this.unregisterRealtime();
      this._userId = userId;
      this.registerRealtime();
    }
  }
 
  // Outputs
  typingMembers: Array<TypingUserType> = [];
  names: string[] = [];
  ellipsis: string = "";
  
  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
    this.setContext();
  }

  async setContext() {
    this.whenContext = new Promise((r) => this.resolveContext = r)
    await whenParentsDefined(this.host as LitElement);
    this.context = new ContextConsumer(this.host as LitElement, { context: weavyContextDefinition, subscribe: true });
  }

  hostUpdate(): void {
    if(this.context?.value) {
      this.resolveContext?.(this.context?.value);
    }
  }

  async registerRealtime() {
    if (this.appId && this._userId) {
      await this.whenContext;
      //console.log("typing subscribe", this.appId)
      this.weavyContext?.subscribe(`a${this.appId}`, "typing", this.handleRealtimeTyping);
      this.weavyContext?.subscribe(`a${this.appId}`, "message_created", this.handleRealtimeStopTyping);

    }
  }

  async unregisterRealtime() {
    if (this.appId && this.userId) {
      await this.whenContext;
      this.weavyContext?.unsubscribe(`a${this.appId}`, "typing", this.handleRealtimeTyping);
      this.weavyContext?.unsubscribe(`a${this.appId}`, "message_created", this.handleRealtimeStopTyping);
    }
  }

  handleRealtimeTyping = (realtimeEvent: RealtimeTypingEventType) => {
    if (realtimeEvent.entity.id === this.appId && realtimeEvent.actor.id !== this.userId) {
      this.setTypers(realtimeEvent.actor);
      this.updateTyping();
    }
  };

  handleRealtimeStopTyping = (realtimeEvent: RealtimeEventType) => {
    // remove typing indicator for message sender
    this.typingMembers.forEach((member, index) => {
      if (member.id === realtimeEvent.actor.id) {
        this.typingMembers.splice(index, 1);
      }
    });
    this.updateTyping();
  };

  private updateTyping() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    // discard typing events older than 5 seconds
    const now = Date.now();
    this.typingMembers.forEach((member, index) => {
      if (now - member.time > 5 * 1000) {
        this.typingMembers.splice(index, 1);
      }
    });

    if (this.typingMembers.length) {
      const now = Date.now();
      // use age of typing event to animate ellipsis...
      const dots =
        (Math.round(
          (now -
            Math.max.apply(
              null,
              this.typingMembers.map((member) => {
                return member.time;
              })
            )) /
            1000
        ) %
          3) +
        1;
  
      this.ellipsis = ".".repeat(dots); //+ (".").repeat(3 - dots);
  
      // merge names of people typing
      this.names = this.typingMembers.map((member) => member.display_name).sort();
  
      // schedule another call to updateTyping in 1 second
      this.typingTimeout = window.setTimeout(() => this.updateTyping(), 1000);
    } else {
      this.names = [];
    }
    
    this.host.requestUpdate();
  }

  private setTypers(actor: UserType) {
    // remove existing typing events by this user (can only type in one conversation at a time)
    this.typingMembers.forEach((member, index) => {
      if (member.id === actor.id) {
        this.typingMembers.splice(index, 1);
      }
    });

    // track time when we received this event
    const trackedActor = { ...actor, time: Date.now() }
    this.typingMembers.push(trackedActor);
  }
}