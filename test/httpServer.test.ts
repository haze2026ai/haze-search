import request from 'supertest';
import { app } from '../src/presentation/httpServer.js';

describe('httpServer', () => {
  it('rejects search without q', async () => {
    const res = await request(app).get('/search');
    expect(res.status).toBe(400);
  });

  it('accepts crawl job', async () => {
    const res = await request(app)
      .post('/crawl')
      .send({ seedUrls: ['https://example.com'], maxPages: 1, maxDepth: 0, rateLimitMs: 0 });
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeDefined();
  });
});
