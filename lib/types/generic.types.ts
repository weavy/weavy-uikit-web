export type PlainObjectType = { [key: PropertyKey]: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = object> = new (...args: any[]) => T;

export type ValueOf<T> = T[keyof T];
