import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FoodUnit, MealType } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { todayInTimeZone } from '../src/common/date/local-date';
import { PrismaService } from '../src/prisma/prisma.service';

const TIMEZONE = 'Europe/Kyiv';
const PASSWORD = 'e2e-password-123';

describe('Daily tracking flow', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let today: string;

  const authorised = (): request.Test =>
    request(app.getHttpServer()).get('/api/dashboard').set('Authorization', `Bearer ${accessToken}`);

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
        email: `e2e-${Date.now()}@sport-calorie.test`,
        password: PASSWORD,
        displayName: 'End to end',
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

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/dashboard').expect(401);
  });

  it('starts the day empty with a default target', async () => {
    const response = await authorised().expect(200);

    expect(response.body.date).toBe(today);
    expect(response.body.calories.consumedKcal).toBe(0);
    expect(response.body.calories.activityKcal).toBe(0);
    expect(response.body.calories.targetKcal).toBeGreaterThan(0);
    expect(response.body.meals).toHaveLength(4);
  });

  it('keeps a manually chosen calorie target', async () => {
    await request(app.getHttpServer())
      .put('/api/profile/calorie-target')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ calorieTargetKcal: 2000 })
      .expect(200);

    const response = await authorised().expect(200);

    expect(response.body.calories.targetKcal).toBe(2000);
    expect(response.body.calories.targetSource).toBe('MANUAL');
  });

  it('records body measurements so estimates have a body weight', async () => {
    await request(app.getHttpServer())
      .patch('/api/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sex: 'MALE', birthDate: '1994-06-15', heightCm: 182 })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/weight/${today}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ weightKg: 80 })
      .expect(200);

    const response = await authorised().expect(200);

    expect(response.body.weight.weightKg).toBe(80);
  });

  it('logs food from a saved food and scales its nutrition', async () => {
    const food = await request(app.getHttpServer())
      .post('/api/foods')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Chicken breast',
        servingSize: 100,
        servingUnit: FoodUnit.GRAM,
        energyKcal: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
      })
      .expect(201);

    const entry = await request(app.getHttpServer())
      .post('/api/food-entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ foodId: food.body.id, meal: MealType.LUNCH, amount: 200, unit: FoodUnit.GRAM })
      .expect(201);

    expect(entry.body.energyKcal).toBe(330);
    expect(entry.body.proteinG).toBe(62);
    expect(entry.body.date).toBe(today);

    const recent = await request(app.getHttpServer())
      .get('/api/foods/recent')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(recent.body[0].id).toBe(food.body.id);
  });

  it('logs a treadmill session and derives speed and energy', async () => {
    const types = await request(app.getHttpServer())
      .get('/api/activity-types')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const treadmill = types.body.find((type: { slug: string }) => type.slug === 'treadmill');

    expect(treadmill).toBeDefined();

    const entry = await request(app.getHttpServer())
      .post('/api/activity-entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        activityTypeId: treadmill.id,
        title: 'WalkingPad',
        durationSec: 2700,
        distanceM: 3700,
      })
      .expect(201);

    expect(entry.body.avgSpeedKmh).toBe(4.93);
    expect(entry.body.energySource).toBe('ESTIMATED');
    expect(entry.body.energyKcal).toBe(211);
  });

  it('keeps a manually entered activity energy value', async () => {
    const types = await request(app.getHttpServer())
      .get('/api/activity-types')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const jumpRope = types.body.find((type: { slug: string }) => type.slug === 'jump-rope');

    const entry = await request(app.getHttpServer())
      .post('/api/activity-entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        activityTypeId: jumpRope.id,
        durationSec: 600,
        intensity: 'MODERATE',
        energyKcal: 150,
      })
      .expect(201);

    expect(entry.body.energyKcal).toBe(150);
    expect(entry.body.energySource).toBe('MANUAL');
  });

  it('aggregates the day consistently', async () => {
    const response = await authorised().expect(200);
    const { calories, walking, macros } = response.body;

    expect(calories.consumedKcal).toBe(330);
    expect(calories.activityKcal).toBe(361);
    expect(calories.netKcal).toBe(calories.consumedKcal - calories.activityKcal);
    expect(calories.remainingKcal).toBe(
      calories.targetKcal + calories.activityKcal - calories.consumedKcal,
    );
    expect(macros.consumed.proteinG).toBe(62);
    expect(walking.sessions).toBe(1);
    expect(walking.distanceM).toBe(3700);
    expect(walking.energyKcal).toBe(211);
  });

  it('places a late-night entry on the correct local day', async () => {
    const entry = await request(app.getHttpServer())
      .post('/api/food-entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Late snack',
        meal: MealType.SNACK,
        amount: 1,
        unit: FoodUnit.SERVING,
        energyKcal: 120,
        consumedAt: '2026-03-01T22:30:00.000Z',
      })
      .expect(201);

    expect(entry.body.date).toBe('2026-03-02');

    const history = await request(app.getHttpServer())
      .get('/api/history?from=2026-03-01&to=2026-03-02')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(history.body).toHaveLength(2);
    expect(history.body[0].consumedKcal).toBe(0);
    expect(history.body[1].consumedKcal).toBe(120);
  });

  it('rejects a one-off entry without calories', async () => {
    await request(app.getHttpServer())
      .post('/api/food-entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Mystery', meal: MealType.SNACK, amount: 1, unit: FoodUnit.SERVING })
      .expect(400);
  });
});
