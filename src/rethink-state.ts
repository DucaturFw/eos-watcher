import r, { Connection } from "rethinkdb";
import types, { IState, ILogger, IHolder, IBalance } from "./types";
import { injectable, inject } from "inversify";
import deep from "deep-equal";

export interface IRethinkStateOptions {
  rethinkHost: string;
  rethinkPort: number;
  rethinkDatabase: string;
  rethinkTable: string;
}
export interface IBalanceTable {
  [holderAndBalance: string]: IBalance;
}

@injectable()
export default class RethinkState implements IState {
  options: IRethinkStateOptions;
  logger: ILogger;
  connection?: Connection;

  private reduceArrayToTable(array: IBalance[]) {
    return array.reduce<IBalanceTable>(this.reduceArrayToTableFunc, {});
  }
  private reduceArrayToTableFunc(table: IBalanceTable, balance: IBalance) {
    table[balance.holder + balance.symbol] = balance;
    return table;
  }

  private get db() {
    return r.db(this.options.rethinkDatabase);
  }

  private get table() {
    return this.db.table(this.options.rethinkTable);
  }

  private get balancesByAmount() {
    return this.table.orderBy("amount");
  }

  private get balanceHolders() {
    return this.table.getField("holder");
  }

  constructor(
    @inject(types.Logger) logger: ILogger,
    @inject(types.Options) opts: { state: any }
  ) {
    const providenOptions = opts.state;
    this.logger = logger;
    this.options = {
      rethinkHost: "localhost",
      rethinkPort: 28015,
      rethinkDatabase: "eos",
      rethinkTable: "balances",
      ...providenOptions
    };
  }

  async holders(symbol: string): Promise<string[]> {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }
    const cursor = await this.balanceHolders
      .filter(r.row("symbol").eq(symbol))
      .run(this.connection);
    return (await cursor.toArray()) as string[];
  }

  async balances(symbol: string): Promise<IBalance[]> {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }
    return (await this.balancesByAmount
      .filter(r.row("symbol").eq(symbol))
      .run(this.connection)).toArray();
  }

  async update(balances: IBalance[]) {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }

    let a = await this.table.run(this.connection);
    let b = await a.toArray<IBalance>();
    this.logger.debug(JSON.stringify(b, null, 2));
    let state = b
      .map((item: any) => {
        delete item.id;
        return item;
      })
      .reduce(this.reduceArrayToTableFunc, {} as IBalanceTable);
    let providenState = this.reduceArrayToTable(balances);

    this.logger.debug(state);

    for (let key in state) {
      if (!providenState[key]) {
        //assert
        throw new Error("WTF? Where is holder? :)");
      }

      if (!deep(state[key], providenState[key])) {
        this.logger.info(`Update holder ${state[key].holder} balance`);
        await this.table
          .filter({
            holder: providenState[key].holder,
            symbol: providenState[key].symbol
          })
          .update(providenState[key])
          .run(this.connection);
      }

      delete providenState[key];
    }

    this.logger.info(`Insert ${Object.keys(providenState).length} balances`);
    await this.table.insert(Object.values(providenState)).run(this.connection);
  }

  async setup() {
    this.connection = await r.connect({
      host: this.options.rethinkHost,
      port: this.options.rethinkPort
    });

    await this.checkOrCreateDatabase(this.options.rethinkDatabase);
    await this.dropTable(
      this.options.rethinkDatabase,
      this.options.rethinkTable
    );
    await this.checkOrCreateTable(
      this.options.rethinkDatabase,
      this.options.rethinkTable
    );
  }

  private async dropTable(db: string, table: string) {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }

    const availableTables = await r
      .db(db)
      .tableList()
      .run(this.connection);

    if (availableTables.indexOf(table) !== -1) {
      await r
        .db(db)
        .tableDrop(table)
        .run(this.connection);
    }
  }

  private async checkOrCreateTable(db: string, table: string) {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }

    const availableTables = await r
      .db(db)
      .tableList()
      .run(this.connection);
    if (availableTables.indexOf(table) === -1) {
      await r
        .db(db)
        .tableCreate(table)
        .run(this.connection);
    }
  }

  private async checkOrCreateDatabase(db: string) {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }

    const availableDbs = await r.dbList().run(this.connection);
    this.logger.debug("available databases: " + availableDbs);
    if (availableDbs.indexOf(db) === -1) {
      await r.dbCreate(db).run(this.connection);
    }
  }

  async close() {
    if (this.connection) {
      return this.connection.close();
    }
  }
}
