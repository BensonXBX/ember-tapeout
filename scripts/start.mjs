process.env.HOST ||= '0.0.0.0';
process.env.PORT ||= '3276';
await import('../server/server.mjs');
