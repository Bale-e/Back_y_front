const cors = require('cors');

function createCorsMiddleware() {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;

  return cors({ origin: allowedOrigins });
}

module.exports = { createCorsMiddleware };
