import type { Refusal, RefusalCode } from "./types.ts";

/** Thrown inside command handlers to refuse a command; caught by applyCommand. */
export class CommandRefused extends Error {
  constructor(
    readonly code: RefusalCode,
    message: string,
  ) {
    super(message);
    this.name = "CommandRefused";
  }

  toRefusal(): Refusal {
    return { code: this.code, message: this.message };
  }
}

export function refuse(code: RefusalCode, message: string): never {
  throw new CommandRefused(code, message);
}
