const path = require("path");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

const TABLE_NAME = "beacons";

module.exports = class BeaconStore {
  static connection;

  static async open() {
    return sqlite
      .open({
        filename: path.join(__dirname, "..", "..", "beacon-store.db"),
        driver: sqlite3.Database,
      })
      .then((connection) => new BeaconStore(connection));
  }

  constructor(connection) {
    this.connection = connection;
  }

  async put(timestamp, useragent, url, pagelabel, pathname) {
    return this.connection.run(
      `INSERT INTO ${TABLE_NAME} (timestamp, useragent, url, pagelabel, pathname) VALUES (?, ?, ?, ?, ?)`,
      timestamp,
      useragent,
      url,
      pagelabel,
      pathname
    );
  }

  async findAll() {
    return this.connection.all(`SELECT * FROM ${TABLE_NAME} ORDER BY timestamp`);
  }

  async findByPathname(pathname) {
    return this.connection.all(
      `SELECT * FROM ${TABLE_NAME} WHERE pathname = ? ORDER BY timestamp`,
      pathname
    );
  }

  async deleteByPathname(pathname) {
    return this.connection.run(`DELETE FROM ${TABLE_NAME} WHERE pathname = ?`, pathname);
  }

  async dropTable() {
    return this.connection.exec(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
  }

  async createTable() {
    return this.connection.exec(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      useragent TEXT NOT NULL,
      url TEXT NOT NULL,
      pagelabel TEXT NOT NULL,
      pathname TEXT NOT NULL
    )`);
  }
};
