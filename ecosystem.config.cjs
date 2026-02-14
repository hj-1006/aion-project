/**
 * AION - PM2 ecosystem (마이크로서비스: web, api, query-server)
 * 실행: pm2 start ecosystem.config.cjs
 * MySQL 선기동 후 실행: ./scripts/start-with-mysql.sh
 */
module.exports = {
  apps: [
    {
      name: 'aion-query',
      script: 'servers/query-server/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { PORT: 3002 },
      env_production: { NODE_ENV: 'production', PORT: 3002 }
    },
    {
      name: 'aion-api',
      script: 'servers/api/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { PORT: 3001, QUERY_SERVER_URL: 'http://localhost:3002' },
      env_production: { NODE_ENV: 'production', PORT: 3001, QUERY_SERVER_URL: 'http://localhost:3002' },
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'aion-web',
      script: 'servers/web/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { PORT: process.env.WEB_PORT || 80, API_SERVER_URL: 'http://localhost:3001' },
      env_production: { NODE_ENV: 'production', PORT: process.env.WEB_PORT || 80, API_SERVER_URL: 'http://localhost:3001' }
    }
  ]
};
