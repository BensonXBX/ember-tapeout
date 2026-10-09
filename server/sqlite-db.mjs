import {MONITOR_SCHEMA} from './monitor.mjs';
import {AUTH_SCHEMA,PROFILE_SCHEMA} from './auth.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Preserve the D1 prepare/bind/first/run/batch contract used by the game server.
export function openArenaDatabase(filename, schemaFile) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
  if (sqlite.prepare('PRAGMA user_version').get().user_version === 0) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(readFileSync(schemaFile, 'utf8'));
      sqlite.exec('PRAGMA user_version=1; COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      sqlite.close();
      throw error;
    }
  }
  if (sqlite.prepare('PRAGMA user_version').get().user_version < 2) {
    sqlite.exec('BEGIN IMMEDIATE');
    try { sqlite.exec(AUTH_SCHEMA); sqlite.exec('PRAGMA user_version=2; COMMIT'); }
    catch(error) { sqlite.exec('ROLLBACK'); sqlite.close(); throw error; }
  }
  if(sqlite.prepare('PRAGMA user_version').get().user_version<3){
    sqlite.exec('BEGIN IMMEDIATE');
    try{sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ember_payment_key ON arena_rooms(json_extract(payload,'$.payment.key')) WHERE json_type(payload,'$.payment') IS NOT NULL;
CREATE INDEX IF NOT EXISTS ember_payment_player0 ON arena_rooms(json_extract(payload,'$.wallets[0]'),json_extract(payload,'$.payment.createdAt')) WHERE json_type(payload,'$.payment') IS NOT NULL;
CREATE INDEX IF NOT EXISTS ember_payment_player1 ON arena_rooms(json_extract(payload,'$.wallets[1]'),json_extract(payload,'$.payment.createdAt')) WHERE json_type(payload,'$.payment') IS NOT NULL;
PRAGMA user_version=3;COMMIT;`);}catch(error){sqlite.exec('ROLLBACK');sqlite.close();throw error;}
  }
  if(sqlite.prepare('PRAGMA user_version').get().user_version<4){
    sqlite.exec('BEGIN IMMEDIATE');
    try{sqlite.exec(MONITOR_SCHEMA);sqlite.exec('PRAGMA user_version=4;COMMIT');}
    catch(error){sqlite.exec('ROLLBACK');sqlite.close();throw error;}
  }
  if(sqlite.prepare('PRAGMA user_version').get().user_version<5){
    sqlite.exec('BEGIN IMMEDIATE');
    try{sqlite.exec(PROFILE_SCHEMA);sqlite.exec('PRAGMA user_version=5;COMMIT');}
    catch(error){sqlite.exec('ROLLBACK');sqlite.close();throw error;}
  }
  // Bound the prepared-statement cache; keep each bind's values independent.
  const statements = new Map();
  function prepare(sql) {
    let statement = statements.get(sql);
    if (!statement) { statement = sqlite.prepare(sql); if (statements.size >= 32) statements.delete(statements.keys().next().value); statements.set(sql, statement); }
    function bind(...values) {
      return {
        bind,
        first: async () => statement.get(...values) ?? null,
        all: async () => ({ results: statement.all(...values) }),
        execute: () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
        async run() { return this.execute(); },
      };
    }
    return bind();
  }
  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = statements.map(statement => statement.execute());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => { statements.clear(); sqlite.close(); },
  };
}
