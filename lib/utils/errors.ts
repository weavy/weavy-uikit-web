export class DestroyError extends Error {
  override name = "DestroyError";

  constructor() {
    super("Instance destroyed");
  }
}

/**
 * Error for an HTTP response that was not `ok`.
 *
 * Carries the status so callers can tell a missing resource apart from a server or transport problem, for instance to
 * decide whether retrying the request can possibly help.
 */
export class HttpError extends Error {
  override name = "HttpError";

  /**
   * The HTTP status code of the response that failed.
   */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
