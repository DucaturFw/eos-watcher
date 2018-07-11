export type IHolder = string;

export interface IBalance {
  holder: IHolder;
  symbol: string;
  amount: number;
}

export interface IService {
  setup(): Promise<void>;
  close(): Promise<void>;
}

export interface IApp extends IService {
  run(): Promise<void>;
}

export interface IChainApi extends IService {
  holders(symbol: string): Promise<IHolder[]>;
  balances(symbol: string, holders: IHolder[]): Promise<IBalance[]>;
}

export interface IState extends IService {
  holders(symbol: string): Promise<IHolder[]>;
  balances(symbol: string): Promise<IBalance[]>;
  update(balances: IBalance[]): Promise<void>;
}

export interface IOptions {
  app?: Partial<{
    sleepDuration: number;
  }>;

  state?: Partial<{
    rethinkHost: string;
    rethinkPort: number;
    rethinkDatabase: string;
    rethinkTable: string;

    clear: boolean;
  }>;

  chainApi?: any;
  logger?: any;
}

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warning(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  fatal(message: string, ...args: any[]): void;
}

export default {
  App: Symbol("App"),
  Options: Symbol("AppOptions"),
  Logger: Symbol("Logger"),
  ChainApi: Symbol("ChainApi"),
  State: Symbol("State")
};
