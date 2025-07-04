/** Generic Plain Object type, e.g. {} */
export type PlainObjectType<TValue = unknown> = { [key: PropertyKey]: TValue };

/** Generic constructor type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Gets all the values from an object/enum as a combined type
 * @see https://github.com/microsoft/TypeScript/issues/37642
 **/
export type ValueOf<T> = T[keyof T];

/** Generic type for JSON serializable objects */
export type JsonType = boolean | number | string | null | { [key: PropertyKey]: JsonType } | Array<JsonType>;

/**
 * Sets all properties as nullable for type T
 * @see https://typeofnan.dev/making-every-object-property-nullable-in-typescript/
 * @see https://github.com/microsoft/TypeScript/issues/39522
 **/
export type Nullable<T> = { [K in keyof T]: T[K] | null };

/**
 * Strong string typing for the event type (event name) instead of any string.
 * @example
 * const customEvent = new (CustomEvent as NamedEvent)(name, options)
 */
export type NamedEvent = new <
  T,
  TName extends string = CustomEvent<T>["type"],
  TBubbles extends CustomEventInit<T>["bubbles"] = CustomEventInit<T>["bubbles"],
  TCancelable extends CustomEventInit<T>["cancelable"] = CustomEventInit<T>["cancelable"],
  TComposed extends CustomEventInit<T>["composed"] = CustomEventInit<T>["composed"],
  TEventInit extends CustomEventInit<T> & {
    bubbles?: TBubbles;
    cancelable?: TCancelable;
    composed?: TComposed;
  } = object,
>(
  type: TName,
  eventInitDict?: TEventInit
) => CustomEvent<T> & {
    type: TName;
    bubbles: (TBubbles extends boolean ? TBubbles : true);
    cancelable: TCancelable;
    composed: TComposed;
  };
