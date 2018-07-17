import "reflect-metadata";
import axios, { AxiosInstance } from "axios";
import { describe, it, before, beforeEach } from "mocha";
import { assert } from "chai";
import types, {
  IOptions,
  ILogger,
  IChainApi,
  IState,
  IBalance,
  IApp
} from "./types";
import { Container } from "inversify";
import MockLogger from "./mock/mock-logger";
import ChainApi from "./chain-api";
import RethinkState from "./rethink-state";
import { start, createContract, EosProject } from "eosic";
import * as path from "path";
import Eos from "eosjs";
import deep from "deep-equal";
import App from "./app";

describe("Eos Watcher", async () => {
  // process.env.CHAIN_ENDPOINT = '127.0.0.1:8888'
  let request: AxiosInstance;
  let container: Container;
  let eos: Eos;
  let token: any;
  let tokenAccount: string;
  let project: EosProject;

  function options(): IOptions {
    return container.get<IOptions>(types.Options);
  }

  function chain(): IChainApi {
    return container.get<IChainApi>(types.ChainApi);
  }

  function state(): IState {
    return container.get<IState>(types.State);
  }

  function app(): IApp {
    return container.get<IApp>(types.App);
  }

  before(async () => {
    // run dev eos blockchain
    project = await start({
      cwd: path.resolve("./node_modules/eoscontracts"),
      logs: false
    });

    const [pub, wif] = [
      "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV",
      "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3"
    ];

    eos = new Eos({
      keyProvider: wif
    });
    await Promise.all(
      Array(5)
        .fill(0)
        .map((_, index) => `account${index + 1}`)
        .map(acc =>
          eos.newaccount({
            creator: "eosio",
            name: acc,
            owner: pub,
            active: pub
          })
        )
    );

    const { account, contract } = await createContract(
      pub,
      eos,
      "ducaturtoken",
      {
        cwd: path.resolve("../eoscontracts")
      }
    );
    token = contract;
    tokenAccount = account;

    container = new Container();
    container.bind<IOptions>(types.Options).toConstantValue({
      global: {
        symbol: "TST"
      },
      app: {},
      state: {
        rethinkHost: "localhost",
        rethinkPort: 28015,
        rethinkDatabase: "eostest",
        rethinkTable: "balances",
        clear: true
      },
      chainApi: {
        endpoint: "localhost:8888",
        tokenContract: tokenAccount
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
    container
      .bind<ILogger>(types.Logger)
      .to(MockLogger)
      .inSingletonScope();
    container
      .bind<IChainApi>(types.ChainApi)
      .to(ChainApi)
      .inSingletonScope();
    container
      .bind<IState>(types.State)
      .to(RethinkState)
      .inSingletonScope();
    container
      .bind<IApp>(types.App)
      .to(App)
      .inSingletonScope();

    await chain().setup();
    await state().setup();
  });

  after(async () => {
    await container.get<IChainApi>(types.ChainApi)!.close();
    await container.get<IState>(types.State)!.close();
    await project.stop();
  });

  describe("syncs with the blockchain", async () => {
    it("should be empty at begin", async () => {
      assert.isEmpty(
        await chain().holders(),
        JSON.stringify(await chain().holders(), null, 2)
      );
    });
    it("should get minter as initial holder", async () => {
      // blockchain call to create token
      await token.create("eosio", `1000000.0000 TST`, {
        authorization: ["eosio", tokenAccount]
      });
      await token.issue("eosio", `1000000.0000 TST`, "memo", {
        authorization: ["eosio", tokenAccount]
      });

      assert.lengthOf(
        await chain().holders(),
        1,
        "length of holders isn't exact one"
      );

      const holders = await chain().holders();
      assert.equal(holders[0], "eosio");
    });

    it("should have exact 1M balance at eosio", async () => {
      const balances = await chain().balances(["eosio"]);
      assert.equal(1e6, balances[0].amount);
    });

    it("should add another holder", async () => {
      await token.transfer("eosio", "account1", "1000.0000 TST", "account1-1", {
        authorization: ["eosio"]
      });

      assert.lengthOf(await chain().holders(), 2);
    });

    it("should change balances after transfer", async () => {
      const balancesBefore = await chain().balances(["eosio", "account1"]);
      await token.transfer("eosio", "account1", "1000.0000 TST", "account1-2", {
        authorization: ["eosio"]
      });
      const balancesAfter = await chain().balances(["eosio", "account1"]);
      assert.notEqual(balancesAfter, balancesBefore);

      assert.equal(1e6 - 2e3, balancesAfter[0].amount);
      assert.equal(2e3, balancesAfter[1].amount);
    });

    it("it should be null at begin", async () => {
      const balances = await state().balances();
      assert.lengthOf(
        balances,
        0,
        "unxpected balances: " + JSON.stringify(balances)
      );
    });

    it("should allow to update persistent state", async () => {
      const chainBalances = await chain().balances(await chain().holders());

      await state().update(chainBalances);
      const stateBalances = await state().balances();

      assert.isTrue(
        deep(
          stateBalances.map(state => {
            delete (state as any).id;
            return state;
          }),
          await chain().balances(await chain().holders())
        )
      );
    });
    it("should update balance", async () => {
      // state before changes
      const stateBalancesBefore = (await state().balances()).reduce(
        (balances, state) => {
          balances[state.holder] = state.amount;
          return balances;
        },
        {} as { [holder: string]: number }
      );

      // make transaction
      await token.transfer("eosio", "account1", "1000.0000 TST", "account1-3", {
        authorization: ["eosio"]
      });

      // update state
      const chainBalances = await chain().balances(await chain().holders());
      await state().update(chainBalances);

      const stateBalancesAfter = (await state().balances()).reduce(
        (balances, state) => {
          balances[state.holder] = state.amount;
          return balances;
        },
        {} as { [holder: string]: number }
      );

      assert.equal(
        stateBalancesAfter["account1"],
        stateBalancesBefore["account1"] + 1000
      );

      assert.equal(
        stateBalancesAfter["eosio"],
        stateBalancesBefore["eosio"] - 1000
      );
    });

    it("should update state in app loop", async () => {
      const stateBalancesBefore = (await state().balances()).reduce(
        (balances, state) => {
          balances[state.holder] = state.amount;
          return balances;
        },
        {} as { [holder: string]: number }
      );
      await token.transfer("eosio", "account1", "1000.0000 TST", "account1-4", {
        authorization: ["eosio"]
      });

      await app().loop();

      const stateBalancesAfter = (await state().balances()).reduce(
        (balances, state) => {
          balances[state.holder] = state.amount;
          return balances;
        },
        {} as { [holder: string]: number }
      );

      assert.equal(
        stateBalancesAfter["account1"],
        stateBalancesBefore["account1"] + 1000
      );

      assert.equal(
        stateBalancesAfter["eosio"],
        stateBalancesBefore["eosio"] - 1000
      );
    });

    it("should insert new holder", async () => {
      const stateHoldersBefore = await state().balances();
      assert.notInclude(
        stateHoldersBefore.map(balance => balance.holder),
        "account2"
      );
      await token.transfer("eosio", "account2", "1000.0000 TST", "account2-1", {
        authorization: ["eosio"]
      });
      await app().loop();
      const stateHoldersAfter = await state().balances();
      assert.include(
        stateHoldersAfter.map(balance => balance.holder),
        "account2"
      );
    });
  });
});
