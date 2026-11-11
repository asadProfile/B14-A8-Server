import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.JWT_SECRET = 'studiosspace-test-secret';
process.env.AUTO_SEED = 'false';
process.env.CLIENT_URL = 'http://localhost:3000';

const { connectDB, disconnectDB } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { Studio } = await import('../src/models/Studio.js');
const { Booking } = await import('../src/models/Booking.js');
const { Review } = await import('../src/models/Review.js');
const { Wishlist } = await import('../src/models/Wishlist.js');

const app = createApp();

const validStudio = {
  title: 'Test Daylight Loft',
  category: 'Photo Studio',
  hourlyRate: 80,
  securityDeposit: 150,
  capacity: 10,
  location: 'Bushwick, Brooklyn',
  imageURL: 'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=1200',
  amenities: ['Natural light', 'Cyc wall'],
  overview:
    'A bright test studio with plenty of room for a small crew, natural light and a clean cyc wall.',
};

const register = (agent, overrides = {}) =>
  agent.post('/api/auth/register').send({
    name: 'Test Creator',
    email: 'creator@example.com',
    password: 'Studio123',
    ...overrides,
  });

const signIn = async (agent, email, password = 'Studio123') => {
  await register(agent, { email });
  const response = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(response.status, 200);
  return response;
};

const createStudio = async (agent, overrides = {}) => {
  const response = await agent.post('/api/studios').send({ ...validStudio, ...overrides });
  assert.equal(response.status, 201);
  return response.body.studio;
};

before(async () => {
  await connectDB();
});

after(async () => {
  await disconnectDB();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Studio.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
    Wishlist.deleteMany({}),
  ]);
});

test('GET /api/health reports a connected database', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
});

test('registration rejects passwords without upper and lower case letters', async () => {
  const agent = request.agent(app);
  const response = await register(agent, { email: 'weak@example.com', password: 'lowercase' });

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.ok(response.body.details.some((detail) => detail.field === 'password'));
});

test('login sets an HTTPOnly cookie and /me returns the session user', async () => {
  const agent = request.agent(app);
  const login = await signIn(agent, 'cookie@example.com');

  const cookie = login.headers['set-cookie']?.join(';') || '';
  assert.match(cookie, /studiosspace_token=/);
  assert.match(cookie, /HttpOnly/i);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'cookie@example.com');

  await agent.post('/api/auth/logout');
  const afterLogout = await agent.get('/api/auth/me');
  assert.equal(afterLogout.body.user, null);
});

test('studio mutations require authentication', async () => {
  const unauthorised = await request(app).post('/api/studios').send(validStudio);
  assert.equal(unauthorised.status, 401);
  assert.equal(unauthorised.body.success, false);
});

test('authenticated hosts can create and update their own studio', async () => {
  const agent = request.agent(app);
  await signIn(agent, 'host@example.com');

  const studio = await createStudio(agent);
  assert.equal(studio.ownerEmail, 'host@example.com');
  assert.equal(studio.title, validStudio.title);

  const updated = await agent
    .patch(`/api/studios/${studio.id}`)
    .send({ title: 'Renamed Daylight Loft', hourlyRate: 95 });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.studio.title, 'Renamed Daylight Loft');
  assert.equal(updated.body.studio.hourlyRate, 95);
});

test('a different host cannot edit or delete someone else’s studio', async () => {
  const owner = request.agent(app);
  await signIn(owner, 'owner@example.com');
  const studio = await createStudio(owner);

  const intruder = request.agent(app);
  await signIn(intruder, 'intruder@example.com');

  const patch = await intruder.patch(`/api/studios/${studio.id}`).send({ title: 'Hijacked listing' });
  assert.equal(patch.status, 403);

  const remove = await intruder.delete(`/api/studios/${studio.id}`);
  assert.equal(remove.status, 403);
});

test('booking rejects any overlap with a confirmed reservation', async () => {
  const host = request.agent(app);
  await signIn(host, 'host@example.com');
  const studio = await createStudio(host);

  const guest = request.agent(app);
  await signIn(guest, 'guest@example.com');

  const date = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const first = await guest.post('/api/bookings').send({
    studioId: studio.id,
    date,
    startTime: '10:00',
    endTime: '13:00',
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.booking.status, 'Pending');
  assert.equal(first.body.booking.total, 252); // 3h × $80 + 5% fee

  const confirm = await host.patch(`/api/bookings/${first.body.booking.id}/confirm`);
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.booking.status, 'Confirmed');

  const collision = await guest.post('/api/bookings').send({
    studioId: studio.id,
    date,
    startTime: '12:00',
    endTime: '15:00',
  });
  assert.equal(collision.status, 409);
  assert.match(collision.body.message, /overlaps a confirmed booking/i);

  const adjacent = await guest.post('/api/bookings').send({
    studioId: studio.id,
    date,
    startTime: '14:00',
    endTime: '16:00',
  });
  assert.equal(adjacent.status, 201);

  const invalid = await guest.post('/api/bookings').send({
    studioId: studio.id,
    date,
    startTime: '17:00',
    endTime: '16:00',
  });
  assert.equal(invalid.status, 422);
});

test('wishlist toggles saved studios for the signed-in user', async () => {
  const host = request.agent(app);
  await signIn(host, 'host@example.com');
  const studio = await createStudio(host);

  const guest = request.agent(app);
  await signIn(guest, 'guest@example.com');

  const save = await guest.post(`/api/wishlist/${studio.id}`);
  assert.equal(save.status, 200);
  assert.equal(save.body.saved, true);

  const list = await guest.get('/api/wishlist');
  assert.equal(list.body.studioIds.length, 1);
  assert.equal(list.body.studios[0].title, validStudio.title);

  const remove = await guest.post(`/api/wishlist/${studio.id}`);
  assert.equal(remove.body.saved, false);

  const empty = await guest.get('/api/wishlist');
  assert.equal(empty.body.studios.length, 0);
});

test('reviews update the studio’s averaged rating', async () => {
  const host = request.agent(app);
  await signIn(host, 'host@example.com');
  const studio = await createStudio(host);

  const guest = request.agent(app);
  await signIn(guest, 'guest@example.com');

  const response = await guest
    .post(`/api/studios/${studio.id}/reviews`)
    .send({ rating: 4, comment: 'Lovely light and a well-prepared space.' });

  assert.equal(response.status, 201);
  assert.equal(response.body.summary.rating, 4);

  const ownReview = await host
    .post(`/api/studios/${studio.id}/reviews`)
    .send({ rating: 5, comment: 'Hosts cannot review their own listing.' });
  assert.equal(ownReview.status, 403);
});

test('uploads require auth and only accept image files', async () => {
  const unauthorised = await request(app).post('/api/upload');
  assert.equal(unauthorised.status, 401);

  const agent = request.agent(app);
  await signIn(agent, 'uploader@example.com');

  const wrongType = await agent
    .post('/api/upload')
    .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
  assert.equal(wrongType.status, 415);
});

test('deleting a studio removes it from discovery', async () => {
  const host = request.agent(app);
  await signIn(host, 'host@example.com');
  const studio = await createStudio(host);

  const remove = await host.delete(`/api/studios/${studio.id}`);
  assert.equal(remove.status, 200);

  const list = await request(app).get('/api/studios');
  assert.equal(list.body.studios.length, 0);

  const detail = await request(app).get(`/api/studios/${studio.id}`);
  assert.equal(detail.status, 404);
});
