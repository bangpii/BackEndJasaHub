import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`Backend Ready — http://localhost:${port}`);
  console.log('Database Ready — Neon Postgres connected');
}

bootstrap();
