export enum PollStatus {
  IDLE = 'IDLE',
  POLLING = 'POLLING',
  ERROR = 'ERROR',
}

export type NodeConfig = {
  name: string;
  nodeURL: string;
  listKey?: string;
};
