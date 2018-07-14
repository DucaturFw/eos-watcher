import { injectable, inject } from "inversify";
import types, { IApp, IOptions, ILogger, IChainApi, IState } from "./types";

export interface IAppOptions {
  sleepDuration: number;
}

@injectable()
export default class App implements IApp {
  options: IAppOptions;
  logger: ILogger;
  api: IChainApi;
  state: IState;

  constructor(
    @inject(types.Options) opts: { app: any },
    @inject(types.Logger) logger: ILogger,
    @inject(types.ChainApi) api: IChainApi,
    @inject(types.State) state: IState
  ) {
    this.options = {
      sleepDuration: 500,
      ...opts.app
    };

    this.logger = logger;
    this.api = api;
    this.state = state;
  }
  async setup() {
    this.logger.log("Start setup eos watcher application");
    await this.api.setup();
    await this.state.setup();
  }
  async close() {
    this.logger.log("Closing eos watcher application...");
    await this.api.close();
    await this.state.close();
    process.exit();
  }

  async loop(): Promise<boolean> {
    const holders = await this.api.holders();
    JSON.stringify(holders, null, 2)
      .split("\n")
      .forEach(line => this.logger.debug(line));
    const balances = await this.api.balances(holders);
    JSON.stringify(balances, null, 2)
      .split("\n")
      .forEach(line => this.logger.debug(line));
    await this.state.update(balances);
    return true;
  }

  async run() {
    try {
      this.logger.log("Running eos watcher application...");
      await this.setup();

      while (await this.loop()) {
        await new Promise(resolve =>
          setTimeout(resolve, this.options.sleepDuration)
        );
      }
    } catch (e) {
      this.logger.fatal(e);
    }
  }
}
