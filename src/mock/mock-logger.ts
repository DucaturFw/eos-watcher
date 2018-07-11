import types, { ILogger } from "../types";
import { injectable, inject } from "inversify";

export interface IMockLog {
  message: string
  args: any[]
}

@injectable()
export default class MockLogger implements ILogger {
  channels!: { 
    [channel: string]: IMockLog[]
  }

  private storeLog(channel: string, log: IMockLog) {
    if (this.channels[channel]) {
      this.channels[channel] = []
    }
    
    this.channels[channel].push(log)
  }

  debug(message: string, ...args: any[]): void {
    this.storeLog("debug", { message, args });
  }
  log(message: string, ...args: any[]): void {
    this.storeLog("log", { message, args });
  }
  info(message: string, ...args: any[]): void {
    this.storeLog("info", { message, args });
  }
  warning(message: string, ...args: any[]): void {
    this.storeLog("warning", { message, args });
  }
  error(message: string, ...args: any[]): void {
    this.storeLog("error", { message, args });
  }
  fatal(message: string, ...args: any[]): void {
    this.storeLog("fatal", { message, args });
  }
}
