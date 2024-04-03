import { WeavyContext, type WeavyContextType } from "./weavy-context";
import { WeavyContextOptionsType } from "../types/weavy.types";
import { defer } from "../utils/dom";
import { modalController } from "lit-modal-portal";
import { weavyContextDefinition } from "./context-definition";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";

import WeavyPortal from "../components/wy-portal";

export interface WeavyModalsProps {}

// WeavyModals mixin/decorator
export const WeavyModalsMixin = (base: typeof WeavyContext) => {
  return class WeavyModals extends base implements WeavyModalsProps {
    // MODALS

    _modalPortal?: WeavyPortal;
    _modalContextProvider?: ContextProvider<typeof weavyContextDefinition>;

    constructor(options: WeavyContextOptionsType) {
      super(options);

      // Root node for modal portal

      defer(async () => {
        await this.whenUrl();

        if (this.isDestroyed) {
          return;
        }

        if (modalController.host && modalController.host instanceof WeavyPortal) {
          this._modalPortal = modalController.host as WeavyPortal;
        } else {
          this._modalPortal = new WeavyPortal();
        }

        this._modalPortal.connectedContexts.add(this);

        if (document) {
          const modalRoot: HTMLElement =
            (this.modalParent && document.querySelector(this.modalParent)) || document.documentElement;

          if (!modalRoot.contains(this._modalPortal)) {
            modalRoot.append(this._modalPortal);
            if (!this.host.contains(modalRoot)) {
              // Make the modal root a provider as well if needed
              this._modalContextProvider = new ContextProvider(modalRoot, {
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

      if (this._modalPortal) {
        this._modalPortal.connectedContexts.delete(this);
        if (!this._modalPortal.connectedContexts.size) {
          this._modalPortal?.remove();
        }
      }
    }
  };
};
