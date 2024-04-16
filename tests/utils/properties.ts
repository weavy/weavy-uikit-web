// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testReadOnly(obj: any, property: any) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line no-self-assign
    obj[property] = obj[property];
  };
}
