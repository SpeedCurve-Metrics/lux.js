export default class BeaconStore {
  static open(): Promise<BeaconStore>;
  put(
    timestamp: number,
    useragent: string,
    url: string,
    pagelabel: string,
    pathname: string
  ): Promise<void>;
  findAll(): Promise<Beacon[]>;
  findByPathname(pathname: string): Promise<Beacon[]>;
  deleteByPathname(pathname: string): Promise<void>;
  dropTable(): Promise<void>;
  createTable(): Promise<void>;
}

interface Beacon {
  id: number;
  timestamp: number;
  useragent: string;
  url: string;
  pagelabel: string;
  pathname: string;
}
