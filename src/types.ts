export interface IHolder {
  name: string;
  balances?: IBalance[];
}

export interface IBalance {
  symbol: string;
  amount: number;
}

export interface IService {
  setup(): Promise<void>;
  close(): Promise<void>;
}

export interface IApp extends IService {
  run(): Promise<void>;
  loop(symbol: string): Promise<boolean>;
}

export interface IChainApi extends IService {
  holders(symbol: string): Promise<string[]>;
  balances(holders: string[] | IHolder[]): Promise<IHolder[]>;
  balance(holder: string | IHolder): Promise<IHolder>;
}

export interface IState extends IService {
  holders(symbol: string): Promise<IHolder[]>;
  balances(holder: IHolder | string): Promise<IBalance[]>;
  update(holders: IHolder[]): Promise<void>;
  clear(): Promise<void>;
}

export interface IOptions {
  app?: Partial<{
    sleepDuration: number;
    symbol: string;
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
