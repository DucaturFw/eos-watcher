import types, { ILogger } from "./types";
import { injectable, inject } from "inversify";
import signale from "signale";

@injectable()
export default class DebugLogger implements ILogger {
  options: {
    debug: boolean;
    log: boolean;
    info: boolean;
    warning: boolean;
    error: boolean;
    fatal: boolean;
  };

  constructor(@inject(types.Options) opts: { logger: any }) {
    const { debug, log, info, warning, error, fatal } = opts.logger;
    this.options = {
      debug,
      log,
      info,
      warning,
      error,
      fatal
    };
  }

  debug(message: string, ...args: any[]): void {
    if (this.options.debug) {
      signale.debug(message, ...args);
    }
  }
  log(message: string, ...args: any[]): void {
    if (this.options.log) {
      signale.note(message, ...args);
    }
  }
  info(message: string, ...args: any[]): void {
    if (this.options.info) {
      signale.info(message, ...args);
    }
  }
  warning(message: string, ...args: any[]): void {
    if (this.options.warning) {
      signale.warn(message, ...args);
    }
  }
  error(message: string, ...args: any[]): void {
    if (this.options.error) {
      signale.error(message, ...args);
    }
  }
  fatal(message: string, ...args: any[]): void {
    if (this.options.fatal) {
      signale.fatal(message, ...args);
    }
  }
}
