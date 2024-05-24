import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../../lib/contexts/weavy-context";

import { onlineManager } from "@tanstack/query-core";
import * as TanstackQueryDevtools from "@tanstack/query-devtools";
import type { DevToolsErrorType, DevtoolsButtonPosition, DevtoolsPosition } from "@tanstack/query-devtools";
import { whenParentsDefined } from "../../lib/utils/dom";

@customElement("tanstack-dev-tools")
export default class TanstackDevTools extends LitElement {
  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  protected weavyContext?: WeavyContextType;

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
  errorTypes: Array<DevToolsErrorType> = [];

  private containerRef: Ref<HTMLElement> = createRef();

  private devtools?: TanstackQueryDevtools.TanstackQueryDevtools;

  override async scheduleUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.scheduleUpdate();
  }

  override createRenderRoot() {
    return this;
  }

  override updated() {
    if (!this.devtools && this.containerRef.value && this.weavyContext) {
      this.devtools = new TanstackQueryDevtools.TanstackQueryDevtools({
        client: this.weavyContext.queryClient,
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
