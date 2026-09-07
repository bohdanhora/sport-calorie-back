import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'e2e-password-123';

interface SessionBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string };
}

/**
 * Covers what a phone actually does: Safari refuses the cross-site refresh
 * cookie, so the app has to get by on the token alone, and it has to do so
 * without disturbing the desktop signed in to the same account.
 */
describe('Sessions', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let email: string;
  let userId: string;

  const post = (path: string, body: object = {}): request.Test =>
    request(app.getHttpServer()).post(`/api/auth/${path}`).send(body);

  const signIn = async (): Promise<SessionBody> =>
    (await post('login', { email, password: PASSWORD }).expect(200)).body as SessionBody;

  /** Refreshes the way a browser without the cookie has to: token in the body. */
  const refreshWithoutCookie = (refreshToken: string): request.Test =>
    post('refresh', { refreshToken });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    email = `e2e-session-${Date.now()}@sport-calorie.test`;

    const registration = await post('register', { email, password: PASSWORD }).expect(201);
    userId = (registration.body as SessionBody).user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it('hands the refresh token back alongside the cookie', async () => {
    const session = await signIn();

    expect(typeof session.refreshToken).toBe('string');
    expect(session.refreshToken.length).toBeGreaterThan(0);
  });

  it('restores a session from the token alone when no cookie arrives', async () => {
    const session = await signIn();
    const restored = await refreshWithoutCookie(session.refreshToken).expect(200);

    expect((restored.body as SessionBody).user.id).toBe(userId);
    expect((restored.body as SessionBody).refreshToken).not.toBe(session.refreshToken);
  });

  it('keeps a rotated token alive briefly, so two refreshes racing cannot end the session', async () => {
    const session = await signIn();

    await refreshWithoutCookie(session.refreshToken).expect(200);
    await refreshWithoutCookie(session.refreshToken).expect(200);
  });

  it('leaves the other device signed in', async () => {
    const phone = await signIn();
    const desktop = await signIn();

    await refreshWithoutCookie(phone.refreshToken).expect(200);
    await refreshWithoutCookie(desktop.refreshToken).expect(200);
  });

  it('signs out one device without touching the other', async () => {
    const phone = await signIn();
    const desktop = await signIn();

    await post('logout', { refreshToken: phone.refreshToken }).expect(204);

    await refreshWithoutCookie(phone.refreshToken).expect(401);
    await refreshWithoutCookie(desktop.refreshToken).expect(200);
  });
});
