# ShadowCore External API (Node.js)

Este é o backend externo oficial do ShadowCore, construído para rodar no **Vercel Serverless Functions**.

## Arquitetura
- **Runtime:** Node.js 18+
- **Host:** Vercel
- **IA:** OpenAI (GPT-4 Turbo + Whisper + Tool Calling)
- **Database:** Supabase REAL (`dovzfmpizerbpziyhhhe`)
- **Auth:** Supabase JWT Validation

## Estrutura de Pastas
- `api/`: Entry points das funções Vercel.
- `lib/`: Lógica central (OpenAI, Supabase, Auth).
- `utils/`: Utilitários (CORS, Logger, Response).

## Como fazer Deploy (Vercel)

### 1. Preparar o Repositório
1. Crie um novo repositório privado no seu GitHub (ex: `shadowcore-api`).
2. Copie o conteúdo da pasta `backend/` para a raiz deste novo repositório.
3. Faça o commit e push.

### 2. Configurar no Vercel
1. Vá ao dashboard do [Vercel](https://vercel.com).
2. Clique em **"Add New"** -> **"Project"**.
3. Importe o repositório que você acabou de criar.
4. Em **"Environment Variables"**, adicione:
   - `OPENAI_API_KEY`: Sua chave da OpenAI.
   - `SUPABASE_URL`: `https://dovzfmpizerbpziyhhhe.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Sua chave **service_role** do Supabase REAL.
5. Clique em **"Deploy"**.

### 3. Conectar ao Frontend
1. Após o deploy, o Vercel fornecerá uma URL (ex: `https://shadowcore-api.vercel.app`).
2. No seu projeto principal (Frontend), adicione a variável de ambiente:
   - `VITE_AI_API_URL`: `https://shadowcore-api.vercel.app/api/ai`

## Endpoints

### POST `/api/ai`
Endpoint principal para interação com a IA.

**Headers:**
- `Authorization: Bearer <SUPABASE_JWT_TOKEN>`
- `Content-Type: application/json`

**Body:**
```json
{
  "message": "Comprei um café por 5 reais",
  "user_id": "uuid-do-usuario",
  "audio": "data:audio/webm;base64,..." (opcional)
}
```

**Respostas:**
- `200 OK`: JSON com a resposta da IA.
- `401 Unauthorized`: Token inválido ou ausente.
- `500 Internal Error`: Falha no processamento.
