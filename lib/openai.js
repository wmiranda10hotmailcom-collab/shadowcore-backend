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
    name: "adicionar_custo_fixo",
    description: "Adiciona um custo fixo mensal recorrente.",

    parameters: {
      type: "object",

      properties: {
        title: {
          type: "string",
          description: "Nome do custo fixo"
        },

        amount: {
          type: "number",
          description: "Valor mensal do custo fixo"
        },

        currency: {
          type: "string",
          description: "Moeda do valor. Detectar automaticamente USD, BRL ou EUR quando o usuário mencionar dólares, reais ou euros."
        },

        due_day: {
          type: "number",
          description: "Dia do vencimento mensal"
        }
      },

      required: ["title", "amount", "due_day"]
    }
  }
},
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

category: {
  type: "string",
  description: "Categoria do gasto (Alimentação, Transporte, Moradia, Saúde, Lazer, Assinaturas, Operação/Trabalho, Outros)"
},

currency: {
  type: "string",
  description: "Moeda do gasto (USD, EUR, BRL)"
},

cardholder_name: {
  type: "string",
  description: "Nome do titular do cartão"
},

date: {
  type: "string",
  description: "Data no formato YYYY-MM-DD (opcional, padrão hoje)"
}
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
    name: "registrar_movimento_painel",
description:
  "Use SEMPRE quando o usuário falar sobre lucro, prejuízo, ganho, perda, faturamento, caixa atual, fechamento do dia ou resultado financeiro do dia. Esta ferramenta atualiza exclusivamente os indicadores do dashboard principal.",

    parameters: {
      type: "object",

      properties: {

        amount: {
          type: "number",
          description: "Valor do movimento"
        },

        movement_type: {
          type: "string",
          enum: ["lucro", "prejuizo", "faturamento", "caixa"],
          description: "Tipo do movimento"
        }

      },

      required: ["amount", "movement_type"]
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
  title: {
    type: "string",
    description: "Título do evento"
  },

  description: {
    type: "string",
    description: "Descrição detalhada do evento"
  },

  start_at: {
    type: "string",
    description: "Data e hora de início em formato ISO 8601"
  },

  end_at: {
    type: "string",
    description: "Data e hora de fim em formato ISO 8601"
  },

  category: {
    type: "string",
    enum: ["Reunião", "Tarea", "Recordatorio", "Personal"],
    description: "Categoria do evento"
  },

  color: {
    type: "string",
    enum: ["blue", "green", "purple", "orange", "pink", "red"],
    description: "Cor visual do evento"
  },

  tags: {
    type: "array",
    items: {
      type: "string"
    },
    description: "Etiquetas associadas ao evento"
  }
},
        required: ["title", "start_at"]
      }
    }
  },
  {
  type: "function",
  function: {
    name: "registrar_execucao",
    description: "Cria uma execução com duração e checkpoints.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título da execução"
        },
        target_minutes: {
          type: "number",
          description: "Duração da execução em minutos"
        },
        subtasks: {
          type: "array",
          description: "Lista de checkpoints da execução",
          items: {
            type: "string"
          }
        }
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

  const termo = cardholderName.toLowerCase();

return data.find(card => {
  const holder = String(card.cardholder_name || "").toLowerCase();
  const brand = String(card.brand || "").toLowerCase();
  const bank = String(card.bank || "").toLowerCase();
  const last4 = String(card.last4 || "");

  return (
    holder.includes(termo) ||
    brand.includes(termo) ||
    bank.includes(termo) ||
    last4.includes(termo)
  );
}) || null;
}

async function handleToolCall(toolCall, userId) {
  const { name, arguments: argsString } = toolCall.function;
  const args = JSON.parse(argsString);
  
  logger.info(`Executing tool: ${name}`, { userId, args });

  try {
    switch (name) {
        case 'adicionar_custo_fixo': {

  // Buscar configurações atuais
  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .eq('key', 'finanzas-extras')
    .single();

  if (settingsError) throw settingsError;

  // Pega dados atuais
  const currentValue = settings?.value || {};

  const fixedCosts = currentValue.fixedCosts || [];

  // Novo custo
  const newCost = {
    id: crypto.randomUUID(),
    name: args.title,
    amount: Math.abs(args.amount),
    currency: args.currency || 'USD',
    nextChargeDay: args.due_day,
    suggestCancel: false
  };

  // Atualiza lista
  const updatedValue = {
    ...currentValue,
    fixedCosts: [...fixedCosts, newCost]
  };

  // Salva atualizado
  const { error: updateError } = await supabase
    .from('settings')
    .update({
      value: updatedValue
    })
    .eq('id', settings.id);

  if (updateError) throw updateError;

  return {
    success: true,
    message: `Custo fixo "${args.title}" registrado com vencimento todo dia ${args.due_day}.`
  };
}
    case 'adicionar_gasto': {

  let card = null;

     const installmentAmount =
  args.installments && args.installments > 1
    ? Math.abs(args.amount) / args.installments
    : Math.abs(args.amount); 

  if (args.cardholder_name) {
    card = await findUserCard(userId, args.cardholder_name);
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert({
  user_id: userId,
  type: 'expense',
  amount: installmentAmount,
  category: args.category || 'Outros',
  currency: args.currency || 'BRL',

  method: card ? 'Cartão' : 'IA',

  note: args.title || 'Gasto registrado pela IA',

  date: new Date().toISOString(),

  card_id: card?.id || null
});

  if (error) throw error;

  // Atualiza valor usado do cartão
  if (card) {

    const novoValorUsado =
  Number(card.used_amount || 0) + installmentAmount;

    const { error: cardError } = await supabase
      .from('cards')
      .update({
        used_amount: novoValorUsado
      })
      .eq('id', card.id);

    if (cardError) throw cardError;
  }

  return {
    success: true,
    message: card
      ? `Gasto registrado no cartão de ${card.cardholder_name}.`
      : 'Gasto registrado.'
  };
}

  case 'registrar_movimento_painel': {

  const amount = Math.abs(args.amount);

  // Buscar caixa atual
  const { data: caixaAtual } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .eq('key', 'caixa-atual')
    .single();

console.log('CAIXA ATUAL:', caixaAtual);
    
  // Buscar dashboard meta
  const { data: dashboardMeta } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .eq('key', 'dashboard_meta')
    .single();

  let currentBalance =
    Number(caixaAtual?.value?.balance || 0);

  let faturado =
    Number(dashboardMeta?.value?.faturado || 0);

  switch (args.movement_type) {

    case 'lucro':
  faturado += amount;
  break;

case 'prejuizo':
  faturado -= amount;
  break;

case 'faturamento':
  faturado += amount;
  break;

case 'caixa':
  currentBalance = amount;
  break;
  }

const updates = [
  {
    user_id: userId,
    key: 'dashboard_meta',
    value: {
      faturado: faturado,
      metaMensal: 10000
    }
  }
];

if (args.movement_type === 'caixa') {
  updates.unshift({
    user_id: userId,
    key: 'caixa-atual',
    value: {
      balance: currentBalance,
      currency: 'USD'
    }
  });
}
    
  const { error } = await supabase
    .from('settings')
    .upsert(updates, {
  onConflict: 'user_id,key'
});

  console.log('UPSERT RESULT:', error);

if (error) {
  console.log('SUPABASE ERROR:', error);
  throw error;
}

  return {
    success: true,
    message: 'Painel atualizado com sucesso.'
  };
}
        
case 'adicionar_receita': {
  const { error } = await supabase
    .from('financial_transactions')
    .insert([{
      user_id: userId,
      type: 'income',
      amount: Math.abs(args.amount),
      category: args.category || 'Outros',
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
      console.log("ARGS EVENTO:", args);
  const { error } = await supabase
    .from('calendar_events')
    .insert([{
      user_id: userId,

      title: args.title,

      description: args.description || "",

      start_at: new Date(args.start_at).toISOString(),

      end_at: new Date(args.end_at).toISOString(),

      category: args.category || "pessoal",

      color: args.color || "azul",

      tags: args.tags || []
    }]);

  if (error) throw error;

  return {
    success: true,
    message: "Evento adicionado."
  };
}
      case 'registrar_execucao': {

  const subtasks = (args.subtasks || []).map((title) => ({
    id: Math.random().toString(36).substring(2, 10),
    done: false,
    title
  }));

  const { error } = await supabase
    .from('tasks_execucao')
    .insert([{
      user_id: userId,
      title: args.title,
      status: 'pending',
      completed_at: null,
      target_minutes: args.target_minutes || 30,
      elapsed_minutes: 0,
      subtasks,
      is_priority: false,
      active: false
    }]);

  if (error) throw error;

  return {
    success: true,
    message: "Execução criada com checkpoints."
  };
      }

      default:
        throw new Error(`Tool ${name} not implemented`);
    }

  } catch (error) {
    console.error('ERRO REAL TOOL:', error);

    logger.error(`Error in tool ${name}`, error);

    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
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
      content: `
Você é o ShadowCore AI, o núcleo operacional inteligente do sistema ShadowCore.

Você atua como:
- assistente pessoal
- controlador financeiro
- gerenciador de produtividade
- organizador de rotina
- central de execução
- operador estratégico do usuário

Você controla:
- painel principal
- finanças
- cartões
- gastos
- receitas
- custos fixos
- metas
- execução
- checkpoints
- rotina
- hábitos
- calendário
- agenda
- produtividade

REGRAS GERAIS:

- Responda sempre de forma curta, clara e objetiva.
- Nunca peça informações desnecessárias.
- Sempre tente completar ações automaticamente.
- Use contexto para inferir informações faltantes.
- Se faltar categoria de gasto, use automaticamente "Outros".
- Se faltar moeda, use "USD".
- Se faltar data, use a data atual.
- Nunca peça confirmação desnecessária.
- Priorize automação e velocidade.

FINANÇAS:

- Gastos podem ser registrados automaticamente.
- Receitas aumentam saldo.
- Gastos diminuem saldo.
- Custos fixos são recorrentes.
- Se o usuário mencionar um cartão pelo nome do titular, associe automaticamente ao cartão correto.
- Parcelamentos devem usar cartão quando houver cartão associado.
- Custos fixos devem aparecer apenas no sistema financeiro.

PAINEL PRINCIPAL:

- Movimentos de lucro, prejuízo, faturamento ou atualização de caixa NÃO são gastos financeiros.

- Quando o usuário disser frases como:
  - "fechei o dia com lucro"
  - "tive prejuízo"
  - "ganhei dinheiro hoje"
  - "perdi dinheiro hoje"
  - "meu caixa agora é"
  - "bati faturamento"

A IA DEVE obrigatoriamente usar a ferramenta:

registrar_movimento_painel

- NUNCA use adicionar_receita para atualizar painel.
- NUNCA use adicionar_gasto para atualizar painel.
- registrar_movimento_painel é exclusivo para métricas do dashboard.

CATEGORIAS:

Categorias válidas de gasto:
- Alimentação
- Transporte
- Moradia
- Saúde
- Lazer
- Assinaturas
- Operação/Trabalho
- Outros

Se o usuário não informar categoria:
- use automaticamente "Outros"

CALENDÁRIOS:

O sistema possui DOIS calendários separados.

1. Calendário Financeiro:
- vencimentos
- cartões
- cobranças
- custos fixos
- despesas recorrentes

2. Calendário Principal:
- agenda pessoal
- compromissos
- reuniões
- tarefas
- eventos pessoais

REGRAS IMPORTANTES:

- Custos fixos NUNCA devem ser adicionados no calendário principal.
- Gastos financeiros NUNCA devem virar eventos pessoais.
- Apenas eventos reais do usuário devem aparecer no calendário principal.

DATA ATUAL DO SISTEMA:

- Hoje é ${new Date().toISOString()}.

- Sempre use a data atual como referência para interpretar:
  - hoje
  - amanhã
  - depois de amanhã
  - próxima semana
  - próximo mês
  - segunda-feira
  - terça-feira

- Nunca invente datas antigas.
- Nunca utilize anos passados como 2023.
- Eventos devem sempre usar datas futuras baseadas na data atual do sistema.

INTERPRETAÇÃO DE DATAS E EVENTOS:

- Sempre interprete linguagem natural de datas e horários.
- Exemplos:
  - hoje
  - amanhã
  - depois de amanhã
  - próxima segunda
  - às 9 da manhã
  - às 3 da tarde
  - meio-dia
  - meia-noite

- Sempre converta datas para formato ISO 8601 antes de chamar ferramentas.

- Quando o usuário pedir para:
  - criar evento
  - criar reunião
  - adicionar compromisso
  - agendar tarefa
  - adicionar evento no calendário
  - marcar reunião

A IA OBRIGATORIAMENTE deve chamar a ferramenta adicionar_evento.

- Nunca responda apenas em texto quando o usuário estiver pedindo criação de evento.

- Se existir data ou horário na mensagem:
  - considere como intenção de criar evento.

- Mesmo que o usuário escreva de forma informal:
  - ainda assim execute adicionar_evento.

Exemplos que DEVEM gerar tool call:
- "marca reunião amanhã"
- "cria evento às 9"
- "agrega una reunión mañana"
- "evento importante sexta-feira"
- "reunião vermelha amanhã"

- Se o usuário não informar horário final:
  - defina automaticamente +1 hora após início.

- Categorias válidas:
  - Reunião
  - Tarea
  - Recordatorio
  - Personal

- Cores válidas:
  - blue
  - green
  - purple
  - orange
  - pink
  - red

- Se o usuário escrever categorias ou cores em português ou espanhol:
  - converta automaticamente para os valores válidos do sistema.

Exemplos:
- "reunião" → "Reunião"
- "morado" → "purple"
- "vermelho" → "red"
- "rojo" → "red"

- Sempre priorize execução da ação ao invés de apenas conversar.

EXECUÇÃO:

- Objetivos podem conter checkpoints.
- Checkpoints representam etapas menores.
- A IA pode criar objetivos e checkpoints automaticamente.

ROTINA:

- Hábitos podem ser criados e acompanhados.
- Rotinas possuem frequência diária.

COMPORTAMENTO:

- Seja operacional.
- Seja estratégico.
- Seja eficiente.
- Aja como um centro de comando pessoal.

IDIOMAS:

- Se o usuário falar português, responda em português.
- Se o usuário falar espanhol, responda em espanhol.
`
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

console.log("TOOL CALLS:", responseMessage.tool_calls);
console.log("CONTENT:", responseMessage.content);
  
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
