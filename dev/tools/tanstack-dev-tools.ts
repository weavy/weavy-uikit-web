import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../../src/client/context-definition";

import { onlineManager } from "@tanstack/query-core";
import * as TanstackQueryDevtools from "@tanstack/query-devtools";
import type { DevToolsErrorType, DevtoolsButtonPosition, DevtoolsPosition } from "@tanstack/query-devtools";
import { falsyBoolean } from "../../src/converters/falsy-boolean";

@customElement("tanstack-dev-tools")
export default class TanstackDevTools extends LitElement {
  @consume({ context: weavyContextDefinition, subscribe: true })
  @property({ attribute: false })
  context?: WeavyContext;

  /**
   * Set this true if you want the dev tools to default to being open
   */
  @property({
    converter: falsyBoolean,
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
  errorTypes: Array<DevToolsErrorType> = [];

  private containerRef: Ref<HTMLElement> = createRef();

  private devtools?: TanstackQueryDevtools.TanstackQueryDevtools;

  override createRenderRoot() {
    return this;
  }

  override updated() {
    if (!this.devtools && this.containerRef.value && this.context) {
      this.devtools = new TanstackQueryDevtools.TanstackQueryDevtools({
        client: this.context.queryClient,
        queryFlavor: "Lit Query",
        version: "5",
        onlineManager,
        buttonPosition: this.buttonPosition,
        position: this.position,
        initialIsOpen: this.initialIsOpen,
        errorTypes: this.errorTypes,
      });

      //console.log("Mounting Tanstack Query Devtools", this.devtools)
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
