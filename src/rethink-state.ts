import r, { Connection } from "rethinkdb";
import types, { IState, ILogger, IHolder, IBalance } from "./types";
import { injectable, inject } from "inversify";
import deep from "deep-equal";

export interface IRethinkStateOptions {
  rethinkHost: string;
  rethinkPort: number;
  rethinkDatabase: string;
  rethinkTable: string;
  clear: boolean;
}
export interface IBalanceTable {
  [holderAndBalance: string]: IBalance;
}

@injectable()
export default class RethinkState implements IState {
  options: IRethinkStateOptions;
  logger: ILogger;
  connection?: Connection;

  private get db() {
    return r.db(this.options.rethinkDatabase);
  }

  private get table() {
    return this.db.table(this.options.rethinkTable);
  }

  private get balancesByAmount() {
    return this.table.orderBy("amount");
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
      clear: false,
      ...providenOptions
    };
  }

  async holders(): Promise<string[]> {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }

    const cursor = await this.table.getField("holder").run(this.connection);
    return cursor.toArray();
  }

  async balances(): Promise<IBalance[]> {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }
    return (await this.balancesByAmount.run(this.connection)).toArray();
  }

  async update(balances: IBalance[]) {
    if (!this.connection) {
      throw new Error("rethink is unavailable");
    }

    this.logger.debug(
      `write balances in ${this.options.rethinkDatabase}::${this.options
        .rethinkTable}`
    );

    const result = await this.table
      .insert(balances, {
        conflict: "update"
      })
      .run(this.connection);

    this.logger.info(
      `Replaced: ${result.replaced}, Inserted: ${result.inserted}`
    );
  }

  async clear() {
    await this.dropTable(
      this.options.rethinkDatabase,
      this.options.rethinkTable
    );
    await this.checkOrCreateTable(
      this.options.rethinkDatabase,
      this.options.rethinkTable
    );
  }

  async setup() {
    this.connection = await r.connect({
      host: this.options.rethinkHost,
      port: this.options.rethinkPort
    });

    await this.checkOrCreateDatabase(this.options.rethinkDatabase);

    if (this.options.clear) {
      await this.dropTable(
        this.options.rethinkDatabase,
        this.options.rethinkTable
      );
    }
    await this.checkOrCreateTable(
      this.options.rethinkDatabase,
      this.options.rethinkTable,
      {
        primary_key: "holder"
      }
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

  private async checkOrCreateTable(
    db: string,
    table: string,
    opts?: r.TableOptions
  ) {
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
        .tableCreate(table, opts)
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
