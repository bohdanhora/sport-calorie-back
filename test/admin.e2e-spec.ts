import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const ADMIN_KEY = 'e2e-admin-key-0123456789-abcdefghijklmnop';
const PASSWORD = 'e2e-password-123';

interface AdminSectionBody {
  key: string;
  fields?: { label: string; value: unknown }[];
  table?: { rows: Record<string, unknown>[]; total: number };
}

describe('Admin', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let email: string;
  let userId: string;
  const previousKey = process.env.ADMIN_API_KEY;

  const admin = (path: string, key: string | null = ADMIN_KEY): request.Test => {
    const call = request(app.getHttpServer()).get(`/api/admin/${path}`);

    return key === null ? call : call.set('x-admin-key', key);
  };

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    email = `e2e-admin-${Date.now()}@sport-calorie.test`;

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);

    userId = (registration.body as { user: { id: string } }).user.id;

    await request(app.getHttpServer())
      .put('/api/weight/2026-03-02')
      .set('authorization', `Bearer ${(registration.body as { accessToken: string }).accessToken}`)
      .send({ weightKg: 80.4, note: 'morning' })
      .expect(200);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
    process.env.ADMIN_API_KEY = previousKey;
  });

  it('refuses a request without the key or with a wrong one', async () => {
    await admin('stats', null).expect(401);
    await admin('stats', 'not-the-key').expect(401);
  });

  it('does not accept a user access token instead of the key', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/admin/stats')
      .set('authorization', `Bearer ${(login.body as { accessToken: string }).accessToken}`)
      .expect(401);
  });

  it('reports the user counts', async () => {
    const response = await admin('stats').expect(200);
    const body = response.body as { users: { total: number; new7d: number; active7d: number } };

    expect(body.users.total).toBeGreaterThanOrEqual(1);
    expect(body.users.new7d).toBeGreaterThanOrEqual(1);
    expect(body.users.active7d).toBeGreaterThanOrEqual(1);
  });

  it('finds the user by part of the address', async () => {
    const response = await admin(`users?search=${encodeURIComponent(email.slice(0, 20))}`).expect(
      200,
    );
    const body = response.body as { items: { id: string; authMethods: string[] }[] };

    expect(body.items.map((item) => item.id)).toContain(userId);
    expect(body.items.find((item) => item.id === userId)?.authMethods).toEqual(['password']);
  });

  it('returns the full card without any secret', async () => {
    const response = await admin(`users/${userId}`).expect(200);
    const raw = JSON.stringify(response.body);
    const body = response.body as { user: { email: string }; sections: AdminSectionBody[] };

    expect(body.user.email).toBe(email);
    expect(raw).not.toMatch(/passwordHash|tokenHash|apiKey/);

    const weight = body.sections.find((section) => section.key === 'weight');

    expect(weight?.table?.total).toBe(1);
    expect(weight?.table?.rows[0]).toMatchObject({ date: '2026-03-02', kg: 80.4 });
  });

  it('answers 404 for an unknown user and 400 for a malformed id', async () => {
    await admin('users/00000000-0000-4000-8000-000000000000').expect(404);
    await admin('users/not-a-uuid').expect(400);
  });
});
