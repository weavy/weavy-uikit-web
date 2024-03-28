import { WeavyContext, type WeavyContextType } from "./weavy-context";
import { WeavyContextOptionsType } from "../types/weavy.types";
import { defer } from "../utils/dom";
import { modalController } from "lit-modal-portal";
import { weavyContextDefinition } from "./context-definition";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";

import WeavyPortal from "../components/wy-portal";

export interface WeavyModalsProps {}

// WeavyModals mixin/decorator
export const WeavyModals = (base: typeof WeavyContext) => {
  return class WeavyModals extends base implements WeavyModalsProps {
    // MODALS
    constructor(options: WeavyContextOptionsType) {
      super(options);

      // Root node for modal portal

      defer(async () => {
        if (this.isDestroyed) {
          return;
        }

        if (modalController.host && modalController.host instanceof WeavyPortal) {
          this.#modalPortal = modalController.host as WeavyPortal;
        } else {
          this.#modalPortal = new WeavyPortal();
        }

        this.#modalPortal.connectedContexts.add(this);

        if (document) {
          const modalRoot: HTMLElement =
            (this.modalParent && document.querySelector(this.modalParent)) || document.documentElement;

          if (!modalRoot.contains(this.#modalPortal)) {
            modalRoot.append(this.#modalPortal);
            if (!this.host.contains(modalRoot)) {
              // Make the modal root a provider as well if needed
              this.#modalContextProvider = new ContextProvider(modalRoot, {
                context: weavyContextDefinition,
                initialValue: this as unknown as WeavyContextType,
              });
            }
          }
        }
      });
    }

    #modalPortal?: WeavyPortal;
    #modalContextProvider?: ContextProvider<typeof weavyContextDefinition>;

    override destroy() {
      super.destroy();

      this.#modalContextProvider?.detachListeners();

      if (this.#modalPortal) {
        this.#modalPortal.connectedContexts.delete(this);
        if (!this.#modalPortal.connectedContexts.size) {
          this.#modalPortal?.remove();
        }
      }
    }
  };
};
