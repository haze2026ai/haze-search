import express from 'express';
import { z } from 'zod';
import { openDb, search, upsertPage } from '../infrastructure/db.js';
import { crawl } from '../infrastructure/crawler.js';
import crypto from 'node:crypto';

export const app = express();
app.use(express.json({ limit: '1mb' }));

const dbPath = process.env.DB_PATH ?? './data/search.db';
const userAgent = process.env.USER_AGENT ?? 'haze-search/0.1';
const db = openDb(dbPath);

const crawlSchema = z.object({
  seedUrls: z.array(z.string().url()).min(1),
  allowHosts: z.array(z.string()).optional(),
  maxPages: z.number().int().min(1).max(5000).default(100),
  maxDepth: z.number().int().min(0).max(5).default(1),
  rateLimitMs: z.number().int().min(0).max(5000).default(250)
});

type Job = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: { queued: number; fetched: number; indexed: number; errors: number };
};

const jobs = new Map<string, Job>();

app.post('/crawl', (req, res) => {
  const parsed = crawlSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const id = crypto.randomUUID();
  const job: Job = { id, status: 'queued', progress: { queued: 0, fetched: 0, indexed: 0, errors: 0 } };
  jobs.set(id, job);

  setImmediate(async () => {
    try {
      job.status = 'running';
      await crawl(
        { ...parsed.data, userAgent },
        (doc) => upsertPage(db, doc),
        (p) => (job.progress = p)
      );
      job.status = 'done';
    } catch {
      job.status = 'error';
    }
  });

  res.json({ jobId: id });
});

app.get('/status/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  res.json(job);
});

app.get('/search', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = Number(req.query.limit ?? 10);
  if (!q) return res.status(400).json({ error: 'missing_q' });
  const results = search(db, q, Math.min(Math.max(limit, 1), 50));
  res.json({ query: q, results });
});

export function startServer(port: number) {
  return app.listen(port, () => {
    console.log(`haze-search listening on :${port}`);
  });
}
