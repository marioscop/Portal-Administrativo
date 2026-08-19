import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { json, urlencoded, static as expressStatic } from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      xssFilter: true,
      hidePoweredBy: true,
      frameguard: false,
      hsts: false,
      noSniff: true,
      ieNoOpen: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'no-referrer-when-downgrade' },
    }),
  );

  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ limit: '12mb', extended: true }));

  const frontendDistPath = join(__dirname, '../../frontend/dist');
  app.use(
    expressStatic(frontendDistPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store');
          return;
        }
        const isHashedAsset =
          filePath.endsWith('.js') ||
          filePath.endsWith('.css') ||
          filePath.endsWith('.woff2') ||
          filePath.endsWith('.woff') ||
          filePath.endsWith('.ttf');
        if (isHashedAsset) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }
        const isImage =
          filePath.endsWith('.png') ||
          filePath.endsWith('.jpg') ||
          filePath.endsWith('.jpeg') ||
          filePath.endsWith('.svg') ||
          filePath.endsWith('.webp') ||
          filePath.endsWith('.ico');
        if (isImage) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          return;
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
      fallthrough: true,
    }),
  );
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(frontendDistPath, 'index.html'));
    } else {
      next();
    }
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
