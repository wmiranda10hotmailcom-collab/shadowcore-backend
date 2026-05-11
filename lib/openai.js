const OpenAI = require('openai');
const supabase = require('./supabase');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TOOLS = [
  {
    type: "function",
    function: {
      name: "adicionar_gasto",
      description: "Adiciona uma despesa ou gasto financeiro.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do gasto" },
          amount: { type: "number", description: "Valor do gasto" },
          category: { type: "string", description: "Categoria (Ex: Alimentação, Transporte, Lazer)" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD (opcional, padrão hoje)" }
        },
        required: ["title", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "adicionar_receita",
      description: "Adiciona uma receita ou entrada financeira.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da receita" },
          amount: { type: "number", description: "Valor da receita" },
          category: { type: "string", description: "Categoria (Ex: Salário, Venda, Investimento)" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD (opcional, padrão hoje)" }
        },
        required: ["title", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_habito",
      description: "Cria um novo hábito para rastreamento.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do hábito" },
          description: { type: "string", description: "Descrição do hábito" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "adicionar_evento",
      description: "Adiciona um evento ao calendário.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do evento" },
          start_at: { type: "string", description: "Data e hora de início (ISO 8601)" },
          end_at: { type: "string", description: "Data e hora de fim (ISO 8601, opcional)" }
        },
        required: ["title", "start_at"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "registrar_execucao",
      description: "Registra que uma tarefa foi realizada.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa realizada" }
        },
        required: ["title"]
      }
    }
  }
];

async function findUserCard(userId, cardholderName) {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  if (!data || data.length === 0) {
    return null;
  }

  return data.find(card =>
    card.cardholder_name?.toLowerCase().includes(cardholderName.toLowerCase())
  );
}
async function handleToolCall(toolCall, userId) {
  const { name, arguments: argsString } = toolCall.function;
  const args = JSON.parse(argsString);
  
  logger.info(`Executing tool: ${name}`, { userId, args });

  try {
    switch (name) {
    case 'adicionar_gasto': {
  const { error } = await supabase
    .from('financial_transactions')
    .insert([{
      user_id: userId,
      type: 'expense',
      amount: Math.abs(args.amount),
      category: args.category || 'Geral',
      currency: args.currency || 'USD',
      method: 'IA',
      note: args.title || 'Gasto registrado pela IA',
      date: new Date().toISOString()
    }]);

  if (error) throw error;

  return {
    success: true,
    message: 'Gasto registrado.'
  };
}

case 'adicionar_receita': {
  const { error } = await supabase
    .from('financial_transactions')
    .insert([{
      user_id: userId,
      type: 'income',
      amount: Math.abs(args.amount),
      category: args.category || 'Geral',
      currency: args.currency || 'USD',
      method: 'IA',
      note: args.title || 'Receita registrada pela IA',
      date: new Date().toISOString()
    }]);

  if (error) throw error;

  return {
    success: true,
    message: 'Receita registrada.'
  };
}

case 'criar_habito': {
        const { error } = await supabase
          .from('habits_rotina')
          .insert([{
            user_id: userId,
            name: args.name,
            description: args.description || '',
            active: true
          }]);
        if (error) throw error;
        return { success: true, message: "Hábito criado." };
      }
      case 'adicionar_evento': {
        const { error } = await supabase
          .from('calendar_events')
          .insert([{
            user_id: userId,
            title: args.title,
            start_at: args.start_at,
            end_at: args.end_at
          }]);
        if (error) throw error;
        return { success: true, message: "Evento adicionado." };
      }
      case 'registrar_execucao': {
        const { error } = await supabase
          .from('tasks_execucao')
          .insert([{
            user_id: userId,
            title: args.title,
            status: 'done',
            completed_at: new Date().toISOString()
          }]);
        if (error) throw error;
        return { success: true, message: "Tarefa concluída." };
      }
      default:
        throw new Error(`Tool ${name} not implemented`);
    }
  } catch (error) {
    logger.error(`Error in tool ${name}`, error);
    return { success: false, error: error.message };
  }
}

// ... (Restante do arquivo permanece igual)
async function transcribeAudio(audioDataUrl) {
  try {
    const base64Data = audioDataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Usando form-data para enviar o buffer como arquivo para a OpenAI
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const transcription = await openai.audio.transcriptions.create({
      file: await OpenAI.toFile(buffer, 'audio.webm'),
      model: "whisper-1",
    });

    return transcription.text;
  } catch (error) {
    logger.error('Audio transcription failed', error);
    throw new Error('Falha ao transcrever áudio');
  }
}

async function processAiMessage(message, userId, audioDataUrl = null) {
  let userText = message;

  if (audioDataUrl) {
    logger.info('Transcribing audio...');
    userText = await transcribeAudio(audioDataUrl);
    logger.info('Transcription result:', { userText });
  }

  if (!userText) {
    throw new Error('Nenhuma mensagem ou áudio fornecido');
  }

  const messages = [
    {
      role: "system",
      content: "Você é o ShadowCore AI, um assistente pessoal focado em produtividade e finanças. Você pode gerenciar gastos, receitas, hábitos e calendário. Responda de forma curta e objetiva. Idiomas suportados: Português e Espanhol. Se o usuário falar em português, responda em português. Se falar em espanhol, responda em espanhol."
    },
    { role: "user", content: userText }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools: TOOLS,
    tool_choice: "auto",
  });

  const responseMessage = response.choices[0].message;

  if (responseMessage.tool_calls) {
    const toolOutputs = [];
    for (const toolCall of responseMessage.tool_calls) {
      const output = await handleToolCall(toolCall, userId);
      toolOutputs.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: toolCall.function.name,
        content: JSON.stringify(output)
      });
    }

    const secondResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...messages, responseMessage, ...toolOutputs],
    });

    return {
      message: secondResponse.choices[0].message.content,
      transcription: audioDataUrl ? userText : null
    };
  }

  return {
    message: responseMessage.content,
    transcription: audioDataUrl ? userText : null
  };
}

module.exports = { processAiMessage };
