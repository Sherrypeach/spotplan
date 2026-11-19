import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';

import { AppModule } from '@app/app.module';
import { AllExceptionsFilter } from '@core/filters/all-exceptions.filter';
import { requireClientHeader } from '@core/middlewares/client-header.middleware';
import { rejectDeepJson } from '@core/middlewares/json-depth.middleware';
import { requestId } from '@core/middlewares/request-id.middleware';
import {
  AppConfiguration,
  AppEnvironment,
} from '@infrastructure/config/config.interface';

// JSON bodies are refused past this size before they're parsed. A whole class
// is saved at once (up to MAX_DOCUMENT_CHARS of text); this leaves room for
// accented names, and a body past it gets a 413 the web shows as "too large".
const JSON_BODY_LIMIT = '512kb';

/** The web app's content policy: its one inline script is allowed by hash. */
function webAppCsp(webDist: string): Record<string, string[]> {
  const html = readFileSync(join(webDist, 'index.html'), 'utf8');
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, body]) =>
      `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
  );
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...hashes],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    objectSrc: ["'none'"],
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService).getOrThrow<AppConfiguration>('app');
  const isProduction = config?.env === AppEnvironment.Production;

  // The API sits behind a proxy on the same machine, which passes the client
  // address on. Only trust it from there, so a caller can't fake its address.
  app.set('trust proxy', config.trustProxy);

  // One-service deploy: with WEB_DIST set, this server also hands out the
  // built web app, and the app's /api calls reach the API on the same origin.
  const webDist = process.env.WEB_DIST;
  if (webDist) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.url === '/api' || req.url.startsWith('/api/')) {
        req.url = req.url.slice(4) || '/';
        (req as Request & { fromApi?: boolean }).fromApi = true;
      }
      next();
    });
  }
  app.use(requestId);
  // The GraphQL landing page needs inline scripts, so the strict content
  // policy applies in production only, where that page is off.
  app.use(
    helmet({
      contentSecurityPolicy: webDist
        ? { directives: webAppCsp(webDist) }
        : isProduction
          ? undefined
          : false,
    }),
  );
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(rejectDeepJson);
  app.use(cookieParser());
  app.use(requireClientHeader);

  if (webDist) {
    app.useStaticAssets(webDist, { index: false, maxAge: '1h' });
    const indexHtml = join(webDist, 'index.html');
    app.use((req: Request, res: Response, next: NextFunction) => {
      const fromApi = (req as Request & { fromApi?: boolean }).fromApi;
      if (req.method !== 'GET' || fromApi || req.path === '/health')
        return next();
      res.sendFile(indexHtml);
    });
  }

  // Inputs are validated and stripped to their DTO: a field without
  // class-validator decorators is silently dropped.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter());

  // Browsers reach the API through the web app's same-origin /api proxy, the
  // only way their session cookie gets here. Cross-origin access is read-only
  // and cookieless.
  if (config?.corsOrigins.length) {
    app.enableCors({
      origin: config.corsOrigins,
      methods: ['GET', 'HEAD'],
      credentials: false,
    });
  }

  if (!isProduction) {
    // Swagger documents the REST health check; GraphQL introspection
    // documents the rest.
    const swaggerConfig = new DocumentBuilder()
      .setTitle(config?.name ?? 'api')
      .setVersion(config?.version ?? '1.0.0')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  // A listenHost of 127.0.0.1 keeps the API reachable only through the web
  // app's /api proxy on the same machine.
  if (config.listenHost) {
    await app.listen(config.port, config.listenHost);
  } else {
    await app.listen(config.port);
  }
  Logger.log(
    `${config.name} listening on ${config.listenHost ?? ''}:${config.port}`,
  );
}

bootstrap();
