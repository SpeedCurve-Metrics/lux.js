import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLE_NAME = "beacons";

export default class BeaconStore {
  connection;
  id = "";

  static async open() {
    return open({
      filename: path.join(__dirname, "..", "..", "beacon-store.db"),
      driver: sqlite3.Database,
    }).then((connection) => new BeaconStore(connection));
  }

  constructor(connection) {
    this.connection = connection;
    this.id = randomUUID();
  }

  async put(timestamp, useragent, url, pagelabel, pathname) {
    return this.connection.run(
      `INSERT INTO ${TABLE_NAME} (prefix, timestamp, useragent, url, pagelabel, pathname) VALUES (?, ?, ?, ?, ?, ?)`,
      this.id,
      timestamp,
      useragent,
      url,
      pagelabel,
      pathname,
    );
  }

  async countAll() {
    return (await this.findAll()).length;
  }

  async findAll() {
    return this.connection.all(
      `SELECT * FROM ${TABLE_NAME} WHERE prefix = ? ORDER BY timestamp`,
      this.id,
    );
  }

  async findByUrl(url) {
    return this.connection.all(
      `SELECT * FROM ${TABLE_NAME} WHERE prefix = ? AND url LIKE ? ORDER BY timestamp`,
      this.id,
      url,
    );
  }

  async findByPathname(pathname) {
    return this.connection.all(
      `SELECT * FROM ${TABLE_NAME} WHERE prefix = ? AND pathname LIKE ? ORDER BY timestamp`,
      this.id,
      pathname,
    );
  }

  async deleteAll() {
    return this.connection.run(`DELETE FROM ${TABLE_NAME} WHERE prefix = ?`, this.id);
  }

  async dropTable() {
    return this.connection.exec(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
  }

  async createTable() {
    return this.connection.exec(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix STRING NOT NULL,
      timestamp INTEGER NOT NULL,
      useragent TEXT NOT NULL,
      url TEXT NOT NULL,
      pagelabel TEXT,
      pathname TEXT
    )`);
  }
}
