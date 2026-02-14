import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { PageDoc } from '../domain/types.js';

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  rank: number;
};

export function openDb(dbPath: string) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts5(
      url UNINDEXED,
      title,
      content,
      fetchedAt UNINDEXED
    );
  `);
  return db;
}

export function upsertPage(db: Database.Database, doc: PageDoc) {
  const del = db.prepare(`DELETE FROM pages WHERE url = ?`);
  del.run(doc.url);
  const ins = db.prepare(`INSERT INTO pages (url, title, content, fetchedAt) VALUES (?, ?, ?, ?)`);
  ins.run(doc.url, doc.title, doc.content, doc.fetchedAt);
}

export function search(db: Database.Database, query: string, limit = 10): SearchResult[] {
  const stmt = db.prepare(`
    SELECT url, title, snippet(pages, 2, '<b>', '</b>', '…', 10) as snippet, rank
    FROM pages
    WHERE pages MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  return stmt.all(query, limit);
}
