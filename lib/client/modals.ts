import { WeavyContextBase, type WeavyContextType } from "./weavy";
import { defer } from "../utils/dom";
import { weavyContextDefinition } from "../contexts/weavy-context";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { LitElement } from "lit";

import WyPortal from "../components/wy-portal";

import { Constructor } from "../types/generic.types";
import type { WeavyOptions } from "../types/weavy.types";

export interface WeavyModalsProps extends WeavyOptions {
  modalParent: WeavyOptions["modalParent"];
  modalRoot: HTMLElement | DocumentFragment | undefined;
}

// WeavyModals mixin/decorator
export const WeavyModalsMixin = <TBase extends Constructor<WeavyContextBase>>(Base: TBase) => {
  return class WeavyModals extends Base implements WeavyModalsProps {
    // MODALS

    modalParent = WeavyContextBase.defaults.modalParent;

    _modalPortal?: WyPortal;
    _modalContextProvider?: ContextProvider<typeof weavyContextDefinition>;

    get modalRoot() {
      return this.host !== document.documentElement
        ? (this.host as LitElement).renderRoot || this.host
        : this._modalPortal?.renderRoot;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      // Root node for modal portal

      defer(async () => {
        await this.whenUrl();

        if (this.isDestroyed) {
          return;
        }

        if (this.modalParent && !this._modalPortal) {
          // Make a wy-portal with styles and context
          this._modalPortal = new WyPortal();
        } else {
          console.info(this.weavyId, "Modal parent is disabled");
        }

        if (document && this._modalPortal) {
          const modalParentElement = this.modalParent && document.querySelector(this.modalParent);

          if (modalParentElement && !modalParentElement.contains(this._modalPortal)) {
            modalParentElement.append(this._modalPortal);
            if (this.host !== modalParentElement && !this.host.contains(modalParentElement)) {
              // Make the modalParent a context provider as well if needed
              this._modalContextProvider = new ContextProvider(this._modalPortal, {
                context: weavyContextDefinition,
                initialValue: this as unknown as WeavyContextType,
              });
            }
          }
        }
      });
    }

    override destroy() {
      super.destroy();

      this._modalContextProvider?.detachListeners();
      this._modalPortal?.remove();
    }
  };
};
