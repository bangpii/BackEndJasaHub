import 'reflect-metadata';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');

const server = express();
let appPromise = null;

async function createApp() {
  const mod = await import('../dist/app.module.js');
  const AppModule = mod.AppModule || mod.default.AppModule || mod.default;
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  app.enableCors({ origin: true, credentials: true });
  await app.init();
  return server;
}

export default async function handler(req, res) {
  try {
    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    appPromise = null;
    console.error('Serverless bootstrap failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Server gagal dijalankan' }));
  }
}
