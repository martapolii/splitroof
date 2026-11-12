const request = require('supertest');
const express = require('express');

jest.mock('../backend/src/config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn(async (token) => {
      if (token === 'valid-token') return { uid: 'user123', email: 'a@b.com' };
      throw new Error('invalid token');
    }),
  }),
}));

const requireAuth = require('../backend/src/middleware/auth');

const app = express();
app.get('/protected', requireAuth, (req, res) => res.json({ uid: req.user.uid }));

describe('requireAuth middleware', () => {
  test('valid token gets through', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user123');
  });

  test('missing token gets 401', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  test('malformed header gets 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'valid-token');
    expect(res.status).toBe(401);
  });

  test('invalid token gets 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });
});