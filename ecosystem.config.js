module.exports = {
  apps: [{
    name: 'ageo-server',
    script: 'server/index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
    },
    max_restarts: 10,
    watch: false,
    autorestart: true,
    max_memory_restart: '512M',
    error_file: './logs/ageo-err.log',
    out_file: './logs/ageo-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
}
