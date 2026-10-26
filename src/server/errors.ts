export class ServiceError extends Error {
  constructor(
    public code: "not_found" | "invalid" | "conflict" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (what: string) => new ServiceError("not_found", `${what} no encontrado`);
export const invalid = (msg: string) => new ServiceError("invalid", msg);
