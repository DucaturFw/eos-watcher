import axios, { AxiosInstance } from "axios";
import types, { IChainApi, IHolder, IBalance, ILogger } from "./types";
import { injectable, inject } from "inversify";
import Eos from 'eosjs'
const eos = new Eos({})

export interface IChainApiOptions {
  timeout: number;
  endpoint: string;
  maxConnections: number;
  tokenContract: string;
  tableRowsLimit: number;
}

export interface ITableRequest {
  scope: string
  code: string,
  table: string,
  json?: boolean,
  lower_bound?: number,
  upper_bound?: number,
  limit?: number
}

export interface ITableResponse { 
  rows: IHolder[],
  more: boolean
}

@injectable()
export default class ChainApi implements IChainApi {
  options: IChainApiOptions;
  nodes!: string[];
  axios: AxiosInstance;
  logger: ILogger;
  constructor(
    @inject(types.Options) opts: { chainApi: any },
    @inject(types.Logger) logger: ILogger) {
      this.logger = logger;
      this.options = {
        timeout: 1000,
        endpoint: "localhost:8888",
        maxConnections: 10,
        tableRowsLimit: 9999,
        tokenContract: 'ducaturtoken',
        ...opts.chainApi
      };

      this.nodes = this.options.endpoint.split(",");
      this.axios = axios.create({
        timeout: this.options.timeout
      });
  }

  holders(symbol: string, opts? : Partial<ITableRequest>): Promise<IHolder[]> {
    return this.apiRequest<ITableResponse, ITableRequest>('get_table_rows', {
      code: this.options.tokenContract,
      scope: symbol,
      table: "holders",
      limit: this.options.tableRowsLimit,
      ...opts
    }).then(responce => {
      return responce.rows.map(name => eos.fc.fromBuffer('name', name))
    })
  }

  balances(symbol: string, holders: IHolder[], opts? : Partial<ITableRequest>): Promise<IBalance[]> {
    return Promise.all(holders.map(holder => this.balance(symbol, holder, opts)))
  }

  balance(symbol: string, holder : IHolder, opts? : Partial<ITableRequest>) : Promise<IBalance> {
    return this.apiRequest<ITableResponse, ITableRequest>('get_table_rows', {
      code: this.options.tokenContract,
      scope: holder,
      table: "accounts",
      limit: this.options.tableRowsLimit,
      ...opts
    })
    .then(responce => {
      return responce.rows.map(name => eos.fc.fromBuffer('asset', name) as string)
    })
    .then(assets => assets.find(asset => asset.endsWith(symbol)) as string)
    .then(asset => ({
      holder,
      symbol,
      amount: parseFloat(asset)
    }))
  }

  async setup() {
  }
  async close() {
  }

  private randomNodes(num: number): string[] {
    const shuffled = this.nodes.slice(0);
    shuffled.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
  }

  private apiRequest<TResponse, TRequest>(action : string, data : TRequest, api :string = 'chain') : Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      const nodes = this.randomNodes(this.options.maxConnections)
      let errors : Error[] = []

      nodes.map(endpoint => {
        this.logger.debug(`Calling ${endpoint} for ${action} data with: ${JSON.stringify(data)}`)
        return this.axios
          .post<TResponse>(`http://${endpoint}/v1/${api}/${action}`, data)
          .then(response => resolve(response.data))
          .catch((error : Error) => {
            this.logger.warning(`Error from ${endpoint}: ` + error)
            errors.push(error);
            if (errors.length === nodes.length) {
              reject(new Error(errors.join('\n')))
            } 
          })
      })

    });
  }
}
