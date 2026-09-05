import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  appConfig,
  googleConfig,
  jwtConfig,
  securityConfig,
  type AppConfig,
} from './config/app.config';
import { validateEnvironment } from './config/environment';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AuthModule } from './modules/auth/auth.module';
import { FoodEntriesModule } from './modules/food-entries/food-entries.module';
import { FoodsModule } from './modules/foods/foods.module';
import { HealthModule } from './modules/health/health.module';
import { NutritionProviderModule } from './modules/nutrition-provider/nutrition-provider.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SummaryModule } from './modules/summary/summary.module';
import { TargetsModule } from './modules/targets/targets.module';
import { UserContextModule } from './modules/user-context/user-context.module';
import { WeightModule } from './modules/weight/weight.module';
import { PrismaModule } from './prisma/prisma.module';

const GLOBAL_RATE_LIMIT = { ttl: 60_000, limit: 240 };

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
      load: [appConfig, jwtConfig, securityConfig, googleConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfig>('app');

        return {
          pinoHttp: {
            level: config.logLevel,
            transport: config.isProduction ? undefined : { target: 'pino-pretty' },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: { ignore: (request) => request.url === '/api/health' },
          },
        };
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [GLOBAL_RATE_LIMIT] }),
    PrismaModule,
    UserContextModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    TargetsModule,
    FoodsModule,
    FoodEntriesModule,
    NutritionProviderModule,
    ActivitiesModule,
    WeightModule,
    SummaryModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
