import { ReactiveController, ReactiveControllerHost } from "lit";

export type ResizeCondition = { target: HTMLElement; name: string; condition: (entry: ResizeObserverEntry) => boolean };

export class ResizeController implements ReactiveController {
  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
  }

  host: ReactiveControllerHost;
  observers: ResizeCondition[] = [];
  conditions: { [key: string]: boolean } = {};

  resizer: ResizeObserver = new ResizeObserver((entries) => {
    let hasChanged = false;
    for (const entry of entries) {
      this.observers.forEach((observe) => {
        if (entry.target === observe.target) {
          const prevCondition = this.conditions[observe.name];
          const currentCondition = observe.condition(entry);
          if (prevCondition !== currentCondition) {
            this.conditions[observe.name] = currentCondition;
            hasChanged = true;
          }
        }
      });
    }

    if (hasChanged) {
      this.host.requestUpdate();
    }
  });

  public observe(resizeCondition: ResizeCondition) {
    this.resizer.observe(resizeCondition.target);
    this.observers.push(resizeCondition);
  }

  hostDisconnected() {
    // Clear the observer when the host is disconnected
    this.conditions = {};
    this.observers.length = 0;
    this.resizer.disconnect();
  }
}
