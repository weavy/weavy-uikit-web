import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { RealtimeEventType, RealtimeTypingEventType } from "../types/realtime.types";
import type { TypingUserType, UserType } from "../types/users.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { TypingEventType } from "../types/typing.events";
import { NamedEvent } from "../types/generic.types";
import { type ComponentFeaturePolicy, Feature, FeaturePolicyContext } from "../contexts/features-context";

export class TypingController implements ReactiveController {
  host: ReactiveControllerHost & LitElement;

  // Weavy context
  weavyContext?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  whenWeavyContext?: Promise<WeavyType>;
  resolveWeavyContext?: (value: WeavyType | PromiseLike<WeavyType>) => void;

  get weavy() {
    return this.weavyContext?.value;
  }

  // Feature context
  componentFeaturesContext?: ContextConsumer<{ __context__: ComponentFeaturePolicy }, LitElement>;
  whenComponentFeaturesContext?: Promise<ComponentFeaturePolicy>;
  resolveComponentFeaturesContext?: (value: ComponentFeaturePolicy | PromiseLike<ComponentFeaturePolicy>) => void;

  private _componentFeatures?: ComponentFeaturePolicy;
  get componentFeatures() {
    return this._componentFeatures;
  }

  private registrationRequested: boolean = false;
  private typingTimeout: number | null = null;
  private discardTime = 5 * 1000;

  // Inputs
  private _appId?: number;
  private _userId?: number;

  get appId() {
    return this._appId;
  }

  set appId(appId: number | undefined) {
    if (appId !== this._appId) {
      this.typingMembers = [];
      void this.unregisterRealtime();
      this._appId = appId;
      void this.registerRealtime();
    }
  }

  get userId() {
    return this._userId;
  }

  set userId(userId: number | undefined) {
    if (userId !== this._userId) {
      this.typingMembers = [];
      void this.unregisterRealtime();
      this._userId = userId;
      void this.registerRealtime();
    }
  }

  // Outputs
  typingMembers: Array<TypingUserType> = [];
  names: string[] = [];
  ellipsis: string = "";

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host as ReactiveControllerHost & LitElement;
    void this.setContexts();
  }

  async setContexts() {
    this.whenWeavyContext = new Promise((r) => (this.resolveWeavyContext = r));
    this.whenComponentFeaturesContext = new Promise((r) => (this.resolveComponentFeaturesContext = r));
    await whenParentsDefined(this.host as LitElement);
    this.weavyContext = new ContextConsumer(this.host as LitElement, { context: WeavyContext, subscribe: true });
    this.componentFeaturesContext = new ContextConsumer(this.host as LitElement, {
      context: FeaturePolicyContext,
      subscribe: true,
    });
  }

  hostUpdate(): void {
    if (this.weavyContext?.value) {
      this.resolveWeavyContext?.(this.weavyContext?.value);
    }

    const typingFeatureHasChanged =
      this.componentFeaturesContext &&
      this.componentFeaturesContext.value?.allowsFeature(Feature.Typing) !==
        this._componentFeatures?.allowsFeature(Feature.Typing);

    if (typingFeatureHasChanged) {
      this._componentFeatures = this.componentFeaturesContext?.value;

      if (this.componentFeaturesContext?.value) {
        this.resolveComponentFeaturesContext?.(this.componentFeaturesContext.value);
      }

      if (typingFeatureHasChanged) {
        void this.unregisterRealtime(true);
        void this.registerRealtime();
      }
    }
  }

  async registerRealtime() {
    if (!this.registrationRequested && this.appId && this._userId) {
      this.registrationRequested = true;
      await Promise.all([this.whenWeavyContext, this.whenComponentFeaturesContext]);
      if (this.componentFeatures?.allowsFeature(Feature.Typing)) {
        //console.log("typing subscribe", this.appId)
        void this.weavy?.subscribe(`a${this.appId}`, "typing", this.handleRealtimeTyping);
        void this.weavy?.subscribe(`a${this.appId}`, "message_created", this.handleRealtimeStopTyping);
      }
      this.registrationRequested = false;
    }
  }

  async unregisterRealtime(skipAwait: boolean = false) {
    if (!this.registrationRequested && this.appId && this.userId) {
      !skipAwait && await this.whenWeavyContext;
      void this.weavy?.unsubscribe(`a${this.appId}`, "typing", this.handleRealtimeTyping);
      void this.weavy?.unsubscribe(`a${this.appId}`, "message_created", this.handleRealtimeStopTyping);
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

  /**
   * @fires typing
   */
  private updateTyping() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    // discard typing events older than 5 seconds
    const now = Date.now();
    this.typingMembers.forEach((member, index) => {
      if (now - member.time > this.discardTime) {
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
      this.names = this.typingMembers.map((member) => member.name).sort();

      // schedule another call to updateTyping in 1 second
      this.typingTimeout = window.setTimeout(() => this.updateTyping(), 1000);
    } else {
      this.names = [];
    }

    this.host.requestUpdate();

    const typingEvent: TypingEventType = new (CustomEvent as NamedEvent)("typing", {
      bubbles: true,
      composed: false,
      detail: { count: this.typingMembers.length },
    });
    this.host.dispatchEvent(typingEvent);
  }

  private setTypers(actor: UserType) {
    // remove existing typing events by this user (can only type in one conversation at a time)
    this.typingMembers.forEach((member, index) => {
      if (member.id === actor.id) {
        this.typingMembers.splice(index, 1);
      }
    });

    // track time when we received this event
    const trackedActor = { ...actor, time: Date.now() };
    this.typingMembers.push(trackedActor);
  }

  hostDisconnected(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    this.typingMembers.length = 0;
    this.names.length = 0;

    if (this.weavy) {
      void this.unregisterRealtime(true);
    }
  }
}
