export class DestroyError extends Error {
  override name = "DestroyError";

  constructor() {
    super("Instance destroyed");
  }
}
