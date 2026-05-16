const allowedOrigins = [
  'https://shadowcoreapp.com',
  'https://www.shadowcoreapp.com',
  'https://shadowcore-backend.vercel.app',
  'https://rota-lucro-diario-axm5e9iug.vercel.app',
  'https://preview-shadowcore.lovable.app',
  'https://shadowcore.lovable.app',
  'https://shadowcore-api.vercel.app',
  'http://localhost:5173'
];

function handleCors(req, res) {
  const origin = req.headers.origin;

  console.log('CORS ORIGIN:', origin);
  console.log('CORS METHOD:', req.method);

  const isAllowed =
    !origin ||
    allowedOrigins.includes(origin) ||
    origin.includes('.vercel.app');

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Vary', 'Origin');

  res.setHeader(
    'Access-Control-Allow-Credentials',
    'true'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma'
    ].join(', ')
  );

  res.setHeader(
    'Access-Control-Max-Age',
    '86400'
  );

  // MUITO IMPORTANTE
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return false;
}

module.exports = { handleCors };
