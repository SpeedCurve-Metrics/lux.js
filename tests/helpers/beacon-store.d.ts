export default class BeaconStore {
  id: string;
  static open(): Promise<BeaconStore>;
  put(
    timestamp: number,
    useragent: string,
    url: string,
    pagelabel: string,
    pathname: string
  ): Promise<void>;
  countAll(): Promise<number>;
  findAll(): Promise<Beacon[]>;
  findByUrl(url: string): Promise<Beacon[]>;
  findByPathname(pathname: string): Promise<Beacon[]>;
  deleteAll(): Promise<void>;
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
