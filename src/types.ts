export type IHolder = string;
export interface IBalance {
  holder: IHolder;
  amount: number;
}

export interface IService {
  setup(): Promise<void>;
  close(): Promise<void>;
}

export interface IApp extends IService {
  run(): Promise<void>;
  loop(): Promise<boolean>;
}

export interface IChainApi extends IService {
  holders(): Promise<IHolder[]>;
  balances(holders: IHolder[]): Promise<IBalance[]>;
}

export interface IState extends IService {
  balances(): Promise<IBalance[]>;
  update(balances: IBalance[]): Promise<void>;
  clear(): Promise<void>;
}

export interface IOptions {
  global?: Partial<{
    symbol: string;
    ignoreHolders: string[];
  }>;

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

  symbols?: string[];
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
