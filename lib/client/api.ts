import { WeavyClient, WeavyType } from "./weavy";
import { Constructor } from "../types/generic.types";
import { AppType, AppWithSourceMetadataType } from "../types/app.types";
import { getApp } from "../data/app";

export type { AppType, AppWithSourceMetadataType }

export interface WeavyApiProps {
  api: {
    apps: {
      getApp: (uid: string) => Promise<AppType>;
    }
  }
}

// WeavyApi mixin/decorator
export const WeavyApiMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyApi extends Base implements WeavyApiProps {
    api;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      const weavy = this as unknown as WeavyType

      this.api = {
        apps: {
          async getApp<TApp extends AppType>(uid: string) {
            return await getApp<TApp>(weavy, uid)
          }
        }
      };
    }

  };
};
