const allowedOrigins = [
  'https://shadowcoreapp.com',
  'https://www.shadowcoreapp.com',

  'https://shadowcore.lovable.app',
  'https://preview-shadowcore.lovable.app',

  'https://rota-lucro-diario-axm5e9iug.vercel.app',

  'http://localhost:5173'
];

function handleCors(req, res) {
  const origin = req.headers.origin;

  console.log('CORS ORIGIN:', origin);

  // Permitir qualquer subdomínio da Vercel
  const isVercelPreview =
    origin &&
    (
      origin.includes('.vercel.app') ||
      allowedOrigins.includes(origin)
    );

  if (isVercelPreview || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

module.exports = { handleCors };
