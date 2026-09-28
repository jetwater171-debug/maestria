# Maestria Beach

Next.js + Supabase, preparado para Vercel.

Consulte [PRODUCAO.md](PRODUCAO.md) para configuração, publicação e limitações.

- `npm run dev`: prévia em localhost:5173
- `npm run build`: build Next.js
- `npm test`: regras de operação

Credenciais ficam em `.env.local` (ignorado) ou nas variáveis da Vercel. Execute `supabase/schema.sql` antes do primeiro cadastro.

A configuração legada de Sites/D1 permanece apenas como referência; não é usada pelo build de produção.
