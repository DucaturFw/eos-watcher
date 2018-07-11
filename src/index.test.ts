import "reflect-metadata";
import axios, { AxiosInstance } from "axios";
import r, { Connection } from "rethinkdb";
import { describe, it, before, beforeEach } from "mocha";
import { assert } from "chai";
import types, { IOptions, ILogger, IChainApi, IState } from "./types";
import { Container } from "inversify";
import MockLogger from "./mock/mock-logger";
import ChainApi from "./chain-api";
import RethinkState from "./rethink-state";
// import Eos from "eosjs";

describe("Eos Watcher", () => {
  // process.env.CHAIN_ENDPOINT = '127.0.0.1:8888'
  let request: AxiosInstance;
  let container: Container;
  let options: IOptions;
  let connection: Connection;

  before(async () => {
    container = new Container();
    container.bind<ILogger>(types.Logger).to(MockLogger);
    container.bind<IChainApi>(types.ChainApi).to(ChainApi);
    container.bind<IState>(types.State).to(RethinkState);
    container.bind<IOptions>(types.Options).toConstantValue({
      state: {
        rethinkHost: "localhost",
        rethinkPort: 28015,
        rethinkDatabase: "eos-test",
        rethinkTable: "balances"
      },
      chainApi: {
        endpoint: "localhost:8888"
      },
      logger: {
        debug: true,
        log: true,
        info: true,
        warning: true,
        error: true,
        fatal: true
      }
    });

    request = axios.create({
      baseURL: `http://${container.get<IOptions>(types.Options).chainApi
        .endpoint}/v1`,
      timeout: 200
    });
  });

  before(async () => {
    // Check blockchain availability
    await request.post(`/chain/get_info`, {});
    let options = container.get<IOptions>(types.Options);

    // Check rethink availability
    connection = await r.connect({
      host: options.state!.rethinkHost,
      port: options.state!.rethinkPort
    });
  });

  after(async () => {
    connection.close();
    container.get<IChainApi>(types.ChainApi).close();
    container.get<IState>(types.ChainApi).close();
  });

  it("should pass", async () => {});
});
