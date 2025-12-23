import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

import { type WeavyType, WeavyContext } from "../lib/contexts/weavy-context";

import { onlineManager } from "@tanstack/query-core";
import * as TanstackQueryDevtools from "@tanstack/query-devtools";
import type { DevtoolsButtonPosition, DevtoolsErrorType, DevtoolsPosition } from "@tanstack/query-devtools";
import { consume,  } from "@lit/context";
import { safari } from "../lib/utils/browser";

@customElement("tanstack-dev-tools")
export default class TanstackDevTools extends LitElement {
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy: WeavyType | undefined;

  /**
   * Set this true if you want the dev tools to default to being open
   */
  @property({
    type: Boolean,
  })
  initialIsOpen: boolean = false;

  /**
   * The position of the React Query logo to open and close the devtools panel.
   * 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   * Defaults to 'bottom-left'.
   */
  @property()
  buttonPosition: DevtoolsButtonPosition = "bottom-left";

  /**
   * The position of the React Query devtools panel.
   * 'top' | 'bottom' | 'left' | 'right'
   * Defaults to 'bottom'.
   */
  @property()
  position: DevtoolsPosition = "bottom";

  /**
   * Use this so you can define custom errors that can be shown in the devtools.
   */
  @property({ attribute: false })
  errorTypes: Array<DevtoolsErrorType> = [];

  private containerRef: Ref<HTMLElement> = createRef();

  private devtools?: TanstackQueryDevtools.TanstackQueryDevtools;

  override createRenderRoot() {
    return this;
  }

  override updated() {
    // Devtools crash Safari for some reason when using devtools.mount()
    if (!this.devtools && this.containerRef.value && this.weavy && !safari) {      
      
      this.devtools = new TanstackQueryDevtools.TanstackQueryDevtools({
        client: this.weavy.queryClient,
        queryFlavor: "Lit Query",
        version: "5",
        onlineManager,
        buttonPosition: this.buttonPosition,
        position: this.position,
        initialIsOpen: this.initialIsOpen,
        errorTypes: this.errorTypes,
      });
      
      console.log("Mounting Tanstack Query Devtools", this.devtools)
        this.devtools.mount(this.containerRef.value);
    }
  }

  override render() {
    return html` <div class="tsqd-parent-container" ${ref(this.containerRef)}></div> `;
  }

  override disconnectedCallback(): void {
    this.devtools?.unmount();
    super.disconnectedCallback();
  }
}
