import { WeavyContextOptionsType } from "../types/weavy.types";
import { WeavyContext } from "./weavy-context";

import colorModes from "../scss/colormodes";
import { adoptGlobalStyles } from "../utils/styles";

export interface WeavyStylesProps {}

// WeavyStyles mixin/decorator
export const WeavyStylesMixin = (base: typeof WeavyContext) => {
  return class WeavyStyles extends base implements WeavyStylesProps {
    constructor(options: WeavyContextOptionsType) {
      super(options);

      adoptGlobalStyles([colorModes]);
    }
  };
};
