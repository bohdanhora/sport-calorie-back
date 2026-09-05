import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { todayInTimeZone } from '../src/common/date/local-date';
import { PrismaService } from '../src/prisma/prisma.service';

const TIMEZONE = 'Europe/Kyiv';
const PASSWORD = 'e2e-password-123';

describe('First run onboarding', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let today: string;

  const authorised = (method: 'get' | 'post', path: string): request.Test =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${accessToken}`);

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
    today = todayInTimeZone(TIMEZONE);

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `onboarding-${Date.now()}@sport-calorie.test`,
        password: PASSWORD,
        timezone: TIMEZONE,
      })
      .expect(201);

    accessToken = registration.body.accessToken as string;
    userId = registration.body.user.id as string;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it('marks a new account as not onboarded', async () => {
    const response = await authorised('get', '/api/profile').expect(200);

    expect(response.body.onboardingCompletedAt).toBeNull();
    expect(response.body.energy.isComplete).toBe(false);
  });

  it('saves the answers, the starting weight and the target in one call', async () => {
    const response = await authorised('post', '/api/profile/onboarding')
      .send({
        displayName: 'First run',
        sex: 'MALE',
        birthDate: '1994-06-15',
        heightCm: 180,
        currentWeightKg: 80,
        targetWeightKg: 75,
        activityLevel: 'MODERATE',
        goal: 'LOSE_WEIGHT',
        timezone: TIMEZONE,
        locale: 'uk',
      })
      .expect(200);

    expect(response.body.onboardingCompletedAt).not.toBeNull();
    expect(response.body.displayName).toBe('First run');
    expect(response.body.heightCm).toBe(180);
    expect(response.body.currentWeightKg).toBe(80);
    expect(response.body.locale).toBe('uk');
    expect(response.body.manualCalorieTargetKcal).toBeNull();
    expect(response.body.energy.isComplete).toBe(true);
    expect(response.body.energy.recommendedCalorieTargetKcal).toBeGreaterThan(0);

    const weight = await authorised('get', `/api/weight?from=${today}&to=${today}`).expect(200);

    expect(weight.body.currentWeightKg).toBe(80);
  });

  it('feeds the recommended target into the day', async () => {
    const profile = await authorised('get', '/api/profile').expect(200);
    const dashboard = await authorised('get', '/api/dashboard').expect(200);

    expect(dashboard.body.calories.targetKcal).toBe(
      profile.body.energy.recommendedCalorieTargetKcal,
    );
    expect(dashboard.body.calories.targetSource).toBe('RECOMMENDED');
  });

  it('rejects answers the metabolic formula cannot use', async () => {
    await authorised('post', '/api/profile/onboarding')
      .send({ sex: 'MALE', birthDate: '1994-06-15', heightCm: 180 })
      .expect(400);

    await authorised('post', '/api/profile/onboarding')
      .send({
        sex: 'MALE',
        birthDate: '1994-06-15',
        heightCm: 12,
        currentWeightKg: 80,
        activityLevel: 'MODERATE',
        goal: 'LOSE_WEIGHT',
      })
      .expect(400);
  });

  it('turns the Google endpoint away while no client id is configured', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/google')
      .send({ idToken: 'not-a-real-token' })
      .expect(process.env.GOOGLE_CLIENT_ID ? 401 : 503);
  });
});
