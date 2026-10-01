import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { addLocalDays, todayInTimeZone } from '../src/common/date/local-date';
import { PrismaService } from '../src/prisma/prisma.service';

const TIMEZONE = 'Europe/Kyiv';
const PASSWORD = 'e2e-password-123';

interface ActivityTypeBody {
  id: string;
  slug: string;
}

describe('Saved exercises, workouts and the calendar', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let today: string;
  let treadmillId: string;
  let squatsId: string;
  let walkId: string;
  let squatsExerciseId: string;
  let workoutId: string;
  let planId: string;

  const send = (method: 'get' | 'post' | 'patch' | 'delete' | 'put', path: string) =>
    request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${accessToken}`);

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
        email: `e2e-workouts-${Date.now()}@sport-calorie.test`,
        password: PASSWORD,
        timezone: TIMEZONE,
      })
      .expect(201);

    accessToken = registration.body.accessToken as string;
    userId = registration.body.user.id as string;

    await send('put', `/weight/${today}`).send({ weightKg: 80 }).expect(200);

    const types = await send('get', '/activity-types').expect(200);
    const bySlug = (slug: string): string =>
      (types.body as ActivityTypeBody[]).find((type) => type.slug === slug)!.id;

    treadmillId = bySlug('treadmill');
    squatsId = bySlug('squats');
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }

    await app.close();
  });

  it('saves a treadmill walk and works out the missing duration', async () => {
    const response = await send('post', '/saved-exercises')
      .send({
        name: 'Treadmill 8 km',
        activityTypeId: treadmillId,
        distanceM: 8000,
        avgSpeedKmh: 5,
      })
      .expect(201);

    walkId = response.body.id as string;

    expect(response.body.durationSec).toBe(5760);
    expect(response.body.energySource).toBe('ESTIMATED');
    expect(response.body.energyKcal).toBeGreaterThan(0);
  });

  it('refuses an exercise with nothing to estimate from', async () => {
    await send('post', '/saved-exercises')
      .send({ name: 'Empty', activityTypeId: squatsId })
      .expect(400);
  });

  it('groups saved exercises into a workout with a total', async () => {
    const squats = await send('post', '/saved-exercises')
      .send({ name: 'Squats', activityTypeId: squatsId, sets: 4, reps: 80 })
      .expect(201);

    squatsExerciseId = squats.body.id as string;

    const workout = await send('post', '/workouts')
      .send({ name: 'Workout A', exerciseIds: [walkId, squatsExerciseId] })
      .expect(201);

    workoutId = workout.body.id as string;

    expect(workout.body.exercises.map((exercise: { id: string }) => exercise.id)).toEqual([
      walkId,
      squatsExerciseId,
    ]);
    expect(workout.body.energyKcal).toBeCloseTo(
      (workout.body.exercises as { energyKcal: number }[]).reduce(
        (sum, exercise) => sum + exercise.energyKcal,
        0,
      ),
    );
  });

  it('logs a whole workout on a day', async () => {
    const entries = await send('post', `/workouts/${workoutId}/log`)
      .send({ date: today })
      .expect(201);

    expect(entries.body).toHaveLength(2);
    expect(entries.body[0].title).toBe('Treadmill 8 km');

    const dashboard = await send('get', `/dashboard?date=${today}`).expect(200);

    expect(dashboard.body.activities).toHaveLength(2);
  });

  it('offers each recently logged activity once to log again', async () => {
    const recent = await send('get', '/activity-entries/recent').expect(200);
    const titles = (recent.body as { title: string }[]).map((entry) => entry.title);

    expect(titles).toEqual(expect.arrayContaining(['Treadmill 8 km', 'Squats']));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('plans a workout and a one-off activity on a day and keeps their order', async () => {
    const tomorrow = addLocalDays(today, 1);

    const plan = await send('post', '/plans').send({ date: tomorrow, workoutId }).expect(201);

    planId = plan.body.id as string;

    const oneOff = await send('post', '/plans')
      .send({
        date: tomorrow,
        activityTypeId: treadmillId,
        distanceM: 8000,
        avgSpeedKmh: 5,
        position: 0,
      })
      .expect(201);

    expect(oneOff.body.kind).toBe('ACTIVITY');
    expect(oneOff.body.exercises[0].durationSec).toBe(5760);

    const calendar = await send('get', `/calendar?from=${today}&to=${tomorrow}`).expect(200);

    expect(calendar.body.plans.map((item: { id: string }) => item.id)).toEqual([
      oneOff.body.id,
      planId,
    ]);
    expect(calendar.body.activities).toHaveLength(2);
  });

  it('moves a plan to another day', async () => {
    const moved = await send('patch', `/plans/${planId}`).send({ date: today }).expect(200);

    expect(moved.body.date).toBe(today);
  });

  it('logs a plan when it is marked done and removes the entries when undone', async () => {
    const done = await send('post', `/plans/${planId}/complete`).expect(200);

    expect(done.body.completedAt).not.toBeNull();
    expect(done.body.entries).toHaveLength(2);

    const dashboard = await send('get', `/dashboard?date=${today}`).expect(200);

    expect(dashboard.body.activities).toHaveLength(4);

    const reopened = await send('post', `/plans/${planId}/reopen`).expect(200);

    expect(reopened.body.completedAt).toBeNull();
    expect(reopened.body.entries).toHaveLength(0);

    const after = await send('get', `/dashboard?date=${today}`).expect(200);

    expect(after.body.activities).toHaveLength(2);
  });

  it('drops a deleted exercise from its workout', async () => {
    await send('delete', `/saved-exercises/${squatsExerciseId}`).expect(204);

    const workouts = await send('get', '/workouts').expect(200);

    expect(workouts.body[0].exercises).toHaveLength(1);
  });
});
