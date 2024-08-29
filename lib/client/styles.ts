import { WeavyContextBase } from "./weavy";
import { adoptGlobalStyles } from "../utils/styles";
import { Constructor } from "../types/generic.types";

import colorModes from "../scss/color-modes.scss";
import definitionStyles from "../scss/definitions.scss";

export interface WeavyStylesProps {}

// WeavyStyles mixin/decorator
export const WeavyStylesMixin = <TBase extends Constructor<WeavyContextBase>>(Base: TBase) => {
  return class WeavyStyles extends Base implements WeavyStylesProps {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      adoptGlobalStyles([definitionStyles, colorModes]);
    }
  };
};
