const supabase = require('./supabase');
const logger = require('../utils/logger');

async function validateAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Valida o JWT chamando o endpoint /auth/v1/user do Supabase REAL
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.error('Auth validation failed', error);
      return null;
    }

    logger.info('User authenticated', { userId: user.id, email: user.email });
    return user;
  } catch (err) {
    logger.error('Unexpected error during auth validation', err);
    return null;
  }
}

module.exports = { validateAuth };
