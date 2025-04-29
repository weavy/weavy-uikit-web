import { WeavyClient } from "./weavy";
import { adoptGlobalStyles } from "../utils/styles";
import { Constructor } from "../types/generic.types";

import colorModes from "../scss/color-modes.scss";
import definitionStyles from "../scss/definitions.scss";

export interface WeavyStylesProps {}

// WeavyStyles mixin/decorator
export const WeavyStylesMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyStyles extends Base implements WeavyStylesProps {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);

      adoptGlobalStyles([definitionStyles, colorModes]);
    }
  };
};
