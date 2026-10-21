const server = require('express')();
let appPromise = null;

async function createApp() {
  const express = require('express');
  const { NestFactory } = require('@nestjs/core');
  const { ExpressAdapter } = require('@nestjs/platform-express');
  const { AppModule } = require('../dist/app.module');
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  app.enableCors({ origin: true, credentials: true });
  await app.init();
  return server;
}

module.exports = async (req, res) => {
  if (req.url === '/__probe') {
    res.setHeader('Content-Type', 'application/json');
    let nest = 'ok';
    try {
      require('@nestjs/core');
    } catch (e) {
      nest = `${e.code || e.name}: ${e.message}`;
    }
    res.end(
      JSON.stringify({
        node: process.version,
        cwd: process.cwd(),
        nest,
        pkgType: require('../package.json').type ?? 'commonjs',
      }),
    );
    return;
  }
  try {
    if (!appPromise) appPromise = createApp();
    const handler = await appPromise;
    return handler(req, res);
  } catch (error) {
    appPromise = null;
    console.error('Serverless bootstrap failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({ success: false, message: 'Server gagal dijalankan' }),
    );
  }
};
