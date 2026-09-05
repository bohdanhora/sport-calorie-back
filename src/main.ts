import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { appConfig, type AppConfig } from './config/app.config';

const API_PREFIX = 'api';
const DOCS_PATH = 'api/docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // A downscaled photo arrives as a base64 data URL, which the 100 kB default
  // for JSON bodies would reject long before validation ever saw it.
  app.useBodyParser('json', { limit: '6mb' });
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const config = app.get<AppConfig>(appConfig.KEY);

  app.enableCors({ origin: config.corsOrigins, credentials: true });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Sport Calorie API')
      .setDescription(
        'Personal fitness and calorie tracking. Energy in kcal, nutrition in grams, body weight in kilograms, distance in metres, duration in seconds.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.port);
  logger.log(`Sport Calorie API listening on port ${config.port}`);
}

void bootstrap();
