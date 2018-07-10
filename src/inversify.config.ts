import { Container } from "inversify";
import types, { IApp, IOptions, ILogger, IChainApi, IState } from "./types";
import App from "./app";
import ChainApi from "./chain-api";
import DebugLogger from "./debug-logger";

import { config } from "dotenv";
import RethinkState from "./rethink-state";
config();

const container = new Container();
container.bind<ILogger>(types.Logger).to(DebugLogger);
container.bind<IApp>(types.App).to(App);
container.bind<IChainApi>(types.ChainApi).to(ChainApi);
container.bind<IState>(types.State).to(RethinkState);
container.bind<IOptions>(types.AppOptions).toConstantValue({
  app: {
    sleepDuration: parseInt(process.env.SLEEP_DURATION || "5000")
  },

  state: {
    rethinkHost: process.env.RETHINKDB_HOST || "localhost",
    rethinkPort: parseInt(process.env.RETHINKDB_POST || "28015"),
    rethinkDatabase: process.env.RETHINKDB_DB || "eos",
    rethinkTable: process.env.RETHINKDB_TABLE || "balances"
  },

  chainApi: {
    endpoint:
      process.env.CHAIN_ENDPOINT ||
      [
        "dolphin.eosblocksmith.io:8888",
        "komododragon.eosbp.mixbytes.io:8888",
        "jungle.dutcheos.io:80",
        "node1.eosgreen.io:8888",
        "node.eosvenezuela.io:8888",
        "peer.test.alohaeos.com:8888"
      ].join(","),
    tokenContract: process.env.TOKEN_CONTRACT || "ducaturtoken"
  },

  logger: (process.env.DEBUG || "info,warning,error,fatal").split(",").reduce((
    acc,
    channel
  ) => {
    acc[channel] = true;
    return acc;
  },
  {} as { [channel: string]: boolean })
});

export default container;
