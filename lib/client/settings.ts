import { WeavyClient, WeavyType } from "./weavy";
import { Constructor } from "../types/generic.types";
import { WeavyComponentSettingProps } from "../types/component.types";

export interface WeavySettingsProps extends WeavyComponentSettingProps {}

// WeavyStyles mixin/decorator
export const WeavySettingsMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavySettings extends Base implements WeavySettingsProps {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);
    }

    // annotations
    _annotations?: WeavySettingsProps["annotations"];

    set annotations(annotations) {
      this._annotations = annotations;
      (this as this & WeavyType).updateContext();
    }

    get annotations() {
      return this._annotations ?? WeavyClient.defaults.annotations;
    }

    // enterToSend
    _enterToSend?: WeavySettingsProps["enterToSend"];

    set enterToSend(enterToSend) {
      this._enterToSend = enterToSend;
      (this as this & WeavyType).updateContext();
    }

    get enterToSend() {
      return this._enterToSend ?? WeavyClient.defaults.enterToSend;
    }

    // reactions
    _reactions?: WeavySettingsProps["reactions"];

    set reactions(reactions) {
      this._reactions = reactions;
      (this as this & WeavyType).updateContext();
    }

    get reactions() {
      return this._reactions ?? WeavyClient.defaults.reactions;
    }
  };
};
