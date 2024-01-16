/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlainObjectType } from "../types/generic.types";
import { eqObjects } from "./objects";
//console.debug("events.js");
type Constructor = new (...args: any[]) => {};

type EventHandlerType = {
  events: string;
  selector?: string | PlainObjectType | undefined | null;
  handler: (...params: any[]) => any;
  originalHandler?: (...params: any[]) => any;
};

/**
 * @class WeavyEvents
 * @classdesc
 * Event handling with event propagation and before and after phases.
 *
 * The event system provides event-chaining with a bubbling mechanism that propagates all the way from the emitting child trigger to the root instance.
 * @note
 * Each weavy instance has an event handler instance exposed as `weavy.events`. So references to `.triggerEvent()` in this documentation would translate to `weavy.events.triggerEvent()`.
 * For convenience the `.on()`, `.one()` and `.off()` functions are exposed directly on the weavy instance as `weavy.on()`, `weavy.one()` and `weavy.off()`.
 * They are also exposed as child object functions on spaces and apps as `space.on()` and `app.on()` etc.
 *
 * All events in the client have three phases; before, on and after. Each event phase is a prefix to the event name.
 * - The before:event-name is triggered in an early stage of the event cycle and is a good point to modify event data or cancel the event.
 * - The on:event-name is the normal trigger point for the event. It does not need to be prefixed when registering an event listener, you can simply use the event-name when you register a listener. This is the phase you normally use to register event listeners.
 * - The after:event-name is triggered when everything is processed. This is a good point to execute code that is dependent on that all other listers have been executed.
 *
 * In each phase, the event is propagated to objects in the hierarchy, much like bubbling in the DOM.
 * The event chain always contains at least the triggering object and the root, but may have more objects in between.
 * This means that the root will receive all events regardless of which child-object that was triggering event, but the child objects will only receive the events that they triggered themselves or any of their child objects triggered.
 * - The event chain starts at the root in the before: phase and works it's way towards the triggering child object. This gives all parent-listeners a chance to modify event data or cancel the event before it reaches the triggering child object.
 * - In the on: phase the event chain starts at the trigger and goes up to the weavy instance, like rings on the water.
 * - Finally, the after: phase goes back from the weavy instance and ends up at the triggering child-object at last.
 *
 * Cancelling an event by calling `event.stopPropagation()` will stop any propagation and cause all the following phases for the event to be cancelled.
 */
export const MixinWeavyEvents = <TBase extends Constructor>(Base: TBase) =>
  class WeavyEvents extends Base {
    #eventHandlers: EventHandlerType[] = [];

    #eventParent: any;

    get eventParent() {
      return this.#eventParent;
    }

    set eventParent(parentTarget) {
      if (parentTarget?.eventChildren) {
        /*if (!(parentTarget instanceof WeavyEvents)) {
        throw new Error(
          "Error connecting WeavyEvents targets; parent is not instance of WeavyEvents"
        );
      } else {*/
        parentTarget.eventChildren.add(this);
        //}
      }

      this.#eventParent = parentTarget;
    }

    #eventChildren = new Set();

    get eventChildren() {
      return this.#eventChildren;
    }

    /**
     * @constructor
     * @hideconstructor
     */
    constructor(...params: any[]) {
      super(...params);
    }

    /**
     * Saves a single event handler.
     *
     * @internal
     * @function
     * @param {string} event - One or more events. Multiple events are currently not registered individually.
     * @param {string|Object} [selector] - Optional refinement selector
     * @param {function} handler - The handler function. may be wrapped for once-handlers
     * @param {function} originalHandler - The original non-wrapped event handler.
     */
    #registerEventHandler(
      events: string,
      selector: string | PlainObjectType | undefined | null,
      handler: () => void,
      originalHandler: () => void
    ) {
      this.#eventHandlers.push({
        events: events,
        selector: selector,
        handler: handler,
        originalHandler: originalHandler,
      });
    }

    /**
     * Returns the event handler or wrapped event handler. The arguments must match the registered event handler.
     *
     * @internal
     * @function
     * @param {string} events - The events registered
     * @param {string|Object} [selector] - The optional selector for the handler.
     * @param {function} handler - The registered handler
     * @param {function} [originalHandler] - The original registered handler
     */
    #getEventHandler(events: string, selector: string | object, handler: () => void, originalHandler?: () => void) {
      const getHandler = {
        events: events,
        selector: selector,
        handler: handler,
        originalHandler: originalHandler || handler,
      };
      const eventHandler = this.#eventHandlers
        .filter((eventHandler) => {
          // Check if all arguments match
          return eqObjects(getHandler, eventHandler, true);
        })
        .pop();

      return eventHandler && eventHandler.handler;
    }

    /**
     * Unregister an event handler. Arguments must match the registered event handler.
     *
     * @internal
     * @function
     * @param {string} event - The events registered
     * @param {function} handler - The registered handler
     * @param {string|Object} [selector] - The optional selector for the handler.
     * @returns {boolean} - True if any handler was removed
     */
    #unregisterEventHandler(
      events: string,
      selector: string | object | undefined | null,
      handler: (() => void) | null | undefined,
      originalHandler: () => void
    ) {
      const removeHandler = {
        events: events,
        selector: selector,
        handler: handler,
        originalHandler: originalHandler,
      };
      let handlerRemoved = false;

      this.#eventHandlers.forEach((eventHandler, eventHandlerIndex) => {
        // Check if all arguments match
        if (eqObjects(removeHandler, eventHandler, true)) {
          handlerRemoved = true;
          this.#eventHandlers.splice(eventHandlerIndex, 1);
        }
      });

      return handlerRemoved;
    }

    /**
     * Triggers any local event handlers registered. Each handler may modify the data and return it or return false to cancel the event chain. .stopPropagation() and .preventDefault() may also be used.
     *
     * @example
     * weavyEvents.on("myevent", function(e, data) { ... })
     *
     * triggerHandler(this, "myevent", { key: 1 })
     *
     * @internal
     * @function
     * @param {any} eventName - The name of the event. Event names without prefix will also trigger handlers with the "on:" prefix.
     * @param {any} data - Any data to pass to the handler
     * @param {any} ...additionalData - Any extra data
     */
    #triggerHandler(eventName: string, data: any, ...additionalData: any[]) {
      //var event = new CustomEvent(eventName, { cancelable: true });
      let isCancelled = false;
      //TODO: Handle stopImmediatePropagation using wrapper function

      this.#eventHandlers.forEach((eventHandler) => {
        eventHandler.events.split(" ").forEach((eventHandlerName) => {
          // Normalize on:
          eventHandlerName =
            eventHandlerName.indexOf("on:") === 0 ? eventHandlerName.split("on:")[1] : eventHandlerName;
          if (eventName === eventHandlerName) {
            if (!eventHandler.selector || eqObjects(eventHandler.selector as PlainObjectType, data, true)) {
              // Trigger the handler
              //console.log("handler found",eventName, eventHandler.selector)
              const returnData = eventHandler.handler(data, ...additionalData);
              if (returnData) {
                data = returnData;
              } else if (returnData === false) {
                isCancelled = true;
              }
            }
          }
        });
      });

      return isCancelled ? false : data;
    }

    /**
     * Extracts and normalizes all parts of the events arguments.
     *
     * @internal
     * @function
     * @param {Array.<Object>} eventArguments - The function argument list: `[context], events, [selector], handler`
     * @returns {Object}
     * @property {string} events - Event names with added namespace for local events.
     * @property {string|Object} selector - The optional selector.
     * @property {function} handler - The handler function
     * @
     */
    #getEventArguments(eventArguments: any[]) {
      const handler = typeof eventArguments[1] === "function" ? eventArguments[1] : eventArguments[2];
      const selector = typeof eventArguments[1] === "function" ? null : eventArguments[1];
      const events = eventArguments[0];

      return { events, selector, handler };
    }

    /**
     * Registers one or several event listeners. All event listeners are managed and automatically unregistered on destroy.
     *
     * When listening to weavy events, you may also listen to `before:` and `after:` events by simply adding the prefix to a weavy event.
     * Event handlers listening to weavy events may return modified data that is returned to the trigger. The data is passed on to the next event in the trigger event chain. If an event handler calls `event.stopPropagation()` or `return false`, the event chain will be stopped and the value is returned.
     *
     * @example <caption>Instance event</caption>
     * myInstance.on("before:options", function(options) { ... })
     * myInstance.on("options", function(options) { ... })
     * myInstance.on("after:options", function(options) { ... })
     *
     * @category eventhandling
     * @function
     * @name WeavyEvents#on
     * @param {string} events - One or several event names separated by spaces. You may provide any namespaces in the names or use the general namespace parameter instead.
     * @param {string|Object} [selector] - Only applicable if the context supports selectors, for instance jQuery.on().
     * @param {function} handler - The listener. The first argument is always the event, followed by any data arguments provided by the trigger.
     */
    on(...argumentsArray: any[]) {
      const args = this.#getEventArguments(argumentsArray);
      const once = argumentsArray[3];

      if (once) {
        const attachedHandler = (...attachedArguments: any[]) => {
          try {
            args.handler.apply(this, attachedArguments);
          } catch (e) {
            try {
              args.handler();
            } catch (e) {
              console.warn("Could not invoke one handler:", e);
            }
          }
          this.#unregisterEventHandler(args.events, args.selector, null, args.handler);
        };

        this.#registerEventHandler(args.events, args.selector, attachedHandler, args.handler);
      } else {
        this.#registerEventHandler(args.events, args.selector, args.handler, args.handler);
      }
    }

    /**
     * Registers one or several event listeners that are executed once. All event listeners are managed and automatically unregistered on destroy.
     *
     * Similar to {@link WeavyEvents#on}.
     *
     * @category eventhandling
     * @function
     * @name WeavyEvents#one
     * @param {string} events - One or several event names separated by spaces. You may provide any namespaces in the names or use the general namespace parameter instead.
     * @param {string|Object} [selector] - Only applicable if the context supports selectors, for instance jQuery.on().
     * @param {Function} handler - The listener. The first argument is always the event, followed by any data arguments provided by the trigger.
     */
    one(events: any, selector: any, handler: any) {
      this.on(events, selector, handler, true);
    }

    /**
     * Unregisters event listeners. The arguments must match the arguments provided on registration using .on() or .one().
     *
     * @category eventhandling
     * @function
     * @name WeavyEvents#off
     * @param {string} events - One or several event names separated by spaces. You may provide any namespaces in the names or use the general namespace parameter instead.
     * @param {string} [selector] - Only applicable if the context supports selectors, for instance jQuery.on().
     * @param {function} handler - The listener. The first argument is always the event, followed by any data arguments provided by the trigger.
     * @returns {boolean} Was the handler removed?
     */
    off(...argumentsArray: any[]) {
      const args = this.#getEventArguments(argumentsArray);
      const offHandler = this.#getEventHandler(args.events, args.selector, args.handler);

      return this.#unregisterEventHandler(args.events, args.selector, offHandler, args.handler);
    }

    /**
     * Clears all registered eventhandlers
     *
     * @category eventhandling
     * @function
     * @name WeavyEvents#clear
     */
    clearEventHandlers() {
      this.#eventHandlers.length = 0; // Empty the array without having to remove each reference
    }

    /**
     * Trigger a custom event. Events are per default triggered on the weavy instance using the weavy namespace.
     *
     * The trigger has an event chain that adds `before:` and `after:` events automatically for all events except when any custom `prefix:` is specified. This way you may customize the eventchain by specifying `before:`, `on:` and `after:` in your event name to fire them one at the time. The `on:` prefix will then be removed from the name when the event is fired.
     *
     * Eventhandlers listening to the event may return modified data that is returned by the trigger event. The data is passed on to the next event in the trigger event chain. If an event handler calls `event.stopPropagation()` or `return false`, the event chain will be stopped and the value is returned.
     *
     * @example
     * // Normal triggering
     * weavyEvents.triggerEvent("myevent");
     *
     * // Will trigger the following events on the root instance
     * // 1. before:myevent.event.weavy
     * // 2. myevent.event.weavy
     * // 3. after:myevent.event.weavy
     *
     * @example
     * // Custom triggering, one at the time
     * weavyEvents.triggerEvent("before:myevent");
     * weavyEvents.triggerEvent("on:myevent");
     * weavyEvents.triggerEvent("after:myevent");
     *
     * @example
     * // Advanced triggering with data handling
     *
     * function doSomething() {
     *     // Will trigger the events sequentially and check the response data in between
     *
     *     var myTriggerData = { counter: 123, label: "my label" };
     *
     *     // Custom triggering, one at the time
     *
     *     // 1. Trigger before: and save the response data back to myTriggerData
     *     myTriggerData = weavyEvents.triggerEvent("before:myevent", myTriggerData);
     *
     *     if (myTriggerData === false) {
     *         console.warn("before:myevent was cancelled by event.stopPropagation() or return false");
     *         return;
     *     }
     *
     *     // ...
     *
     *     // 2. Continue with on: and save the response data back to myTriggerData
     *     myTriggerData = weavyEvents.triggerEvent("on:myevent", myTriggerData);
     *
     *     if (myTriggerData === false) {
     *         console.warn("on:myevent was cancelled by event.stopPropagation() or return false");
     *         return;
     *     }
     *
     *     // ...
     *
     *     // 3. At last trigger after: and save the response data back to myTriggerData
     *     myTriggerData = weavyEvents.triggerEvent("after:myevent", myTriggerData);
     *
     *     if (myTriggerData === false) {
     *         console.warn("after:myevent was cancelled by event.stopPropagation() or return false");
     *         return;
     *     }
     *
     *     console.log("myevent was fully executed", myTriggerData);
     *     return myTriggerData;
     * }
     *
     * @category eventhandling
     * @function
     * @name WeavyEvents#triggerEvent
     * @param {string} name - The name of the event.
     * @param {(Array/Object/JSON)} [data] - Data may be an array or plain object with data or a JSON encoded string.
     * @param {any} ...additionalData - Any raw extra data
     * @returns {data} The data passed to the event trigger including any modifications by event handlers. Returns false if the event is cancelled.
     */
    triggerEvent(name: string, data: any, ...additionalData: any[]) {
      const hasPrefix = /^(before|on|after):/.test(name);
      const prefix = hasPrefix ? name.split(":")[0] : "";

      /*if (this instanceof HTMLElement && this.isConnected) {
      console.warn(
        "Triggering event on DOM Node may cause unexpected bubbling:",
        '"' + name + '"',
        "<" +
          this.nodeName.toLowerCase() +
          (this.id ? ' id="' + this.id + '" />' : " />")
      );
    }*/

      name = name.replace(/^(before|on|after):/, "");

      // Triggers additional before:* and after:* events
      const beforeEventName = "before:" + name;
      const eventName = name;
      const afterEventName = "after:" + name;

      if (data && typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.warn("Could not parse event data", name, data);
        }
      }

      //console.debug("trigger", name);
      let result;

      // Defined prefix. before: on: after: custom:
      if (hasPrefix) {
        if (prefix === "before" || prefix === "after") {
          if (this.#eventParent) {
            result = this.#eventParent.triggerEvent(
              prefix === "before" ? beforeEventName : afterEventName,
              data,
              ...additionalData
            );
            data = result || result === false ? result : data;
            if (data === false) {
              return data;
            }
          }

          result = this.#triggerHandler(
            prefix === "before" ? beforeEventName : afterEventName,
            data,
            ...additionalData
          );
          data = result || result === false ? result : data;
          if (data === false) {
            return data;
          }
        } else if (prefix === "on") {
          result = this.#triggerHandler(eventName, data, ...additionalData);
          data = result || result === false ? result : data;
          if (data === false) {
            return data;
          }

          if (this.#eventParent) {
            result = this.#eventParent.triggerEvent("on:" + eventName, data, ...additionalData);
            data = result || result === false ? result : data;
            if (data === false) {
              return data;
            }
          }
        }
      } else {
        // Before
        if (this.#eventParent) {
          result = this.#eventParent.triggerEvent(beforeEventName, data, ...additionalData);
          data = result || result === false ? result : data;
          if (data === false) {
            return data;
          }
        }

        result = this.#triggerHandler(beforeEventName, data, ...additionalData);
        data = result || result === false ? result : data;
        if (data === false) {
          return data;
        }

        // On
        // eventChain from target

        result = this.#triggerHandler(eventName, data, ...additionalData);
        data = result || result === false ? result : data;
        if (data === false) {
          return data;
        }

        if (this.#eventParent) {
          result = this.#eventParent.triggerEvent("on:" + eventName, data, ...additionalData);
          data = result || result === false ? result : data;
          if (data === false) {
            return data;
          }
        }

        // After

        if (this.#eventParent) {
          result = this.#eventParent.triggerEvent(afterEventName, data, ...additionalData);
          data = result || result === false ? result : data;
          if (data === false) {
            return data;
          }
        }

        result = this.#triggerHandler(afterEventName, data, ...additionalData);
        data = result || result === false ? result : data;
      }

      return data;
    }
  };

export default MixinWeavyEvents(class {});
