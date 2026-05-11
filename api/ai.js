require('dotenv').config();
const { handleCors } = require('../utils/cors');
const { validateAuth } = require('../lib/auth');
const { processAiMessage } = require('../lib/openai');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

module.exports = async (req, res) => {
  // 1. Lidar com CORS (inclui OPTIONS preflight)
  if (handleCors(req, res)) return;

  // Garantir que é um POST
  if (req.method !== 'POST') {
    return sendError(res, 'Método não permitido', 405);
  }

  try {
    const { message, user_id, audio } = req.body;
    const authHeader = req.headers.authorization;

    logger.info('Nova requisição recebida', { 
      hasMessage: !!message, 
      hasUserId: !!user_id, 
      hasAudio: !!audio 
    });

    // 2. Validar Autenticação (JWT Supabase REAL)
    const user = await validateAuth(authHeader);
    if (!user) {
      return sendError(res, 'Sessão inválida ou expirada. Faça login novamente.', 401);
    }

    // 3. Processar IA (OpenAI + Tool Calling)
    const result = await processAiMessage(message, user.id, audio);

    // 4. Retornar JSON Sucesso
    return sendSuccess(res, 'Processado com sucesso', {
      message: result.message,
      transcription: result.transcription
    });

  } catch (error) {
    logger.error('Erro interno na rota /api/ai', error);
    
    // Tratamento de erros específicos
    if (error.status === 429) {
      return sendError(res, 'Limite de requisições da OpenAI atingido.', 429);
    }
    
    return sendError(res, 'Erro ao processar sua solicitação pela IA.', 500, error.message);
  }
};
