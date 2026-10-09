import type { ApiError as ApiErrorBody } from "@contextlayer/shared";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorBody["code"],
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}
