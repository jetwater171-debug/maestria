# Publicação — Supabase + Vercel



1. Crie o projeto Supabase e execute `supabase/schema.sql` no SQL Editor.

2. Em Authentication, habilite apenas Email/Senha. Configure Site URL com o domínio final da Vercel e Redirect URLs com esse domínio e `/redefinir`. Para testes, inclua `http://localhost:5173` e `http://localhost:5173/redefinir`.

3. Configure SMTP próprio para confirmação e recuperação de senha em produção. Confirmação de e-mail é recomendada; o aplicativo trata ambos os modos.

4. Na Vercel, importe o repositório e escolha Root Directory `.` (raiz do repositório), framework Next.js. Node 22 ou superior.

5. Configure as quatro variáveis de `.env.example` na Vercel (e em `.env.local` para desenvolvimento). A chave pública pode ser publishable ou anon. SUPABASE_SECRET_KEY aceita secret ou service_role e NUNCA recebe prefixo NEXT_PUBLIC. LLM7_API_KEY é só do servidor.

6. Publique e valide: criar conta, confirmar e-mail, entrar, cadastrar barraca/cardápio, criar funcionário, abrir link em outro celular, enviar pedido, marcar pronto, entregar e fechar conta. Teste outra conta e confira o isolamento. Teste recuperação e saída.



## Estado e limitações

A migração preserva pedidos com atualização condicional por versão, evitando sobrescrever alterações concorrentes. As tabelas têm RLS e não permitem leitura/escrita direta pelo navegador. A API valida usuários Supabase e a função de cada funcionário. Links de funcionários são credenciais individuais revogáveis; o login do dono usa apenas e-mail e senha.



Dados anteriores do D1 NÃO são migrados automaticamente. O estado por barraca continua em JSONB; é adequado para piloto, mas precisa ser normalizado antes de operação em grande escala. Configure backups e monitoramento no Supabase. Não há cobrança Pix/cartão ou emissão fiscal: o caixa registra pagamentos recebidos. Sem internet, não há envio de pedidos. O scanner depende de chave e saldo LLM7. A impressão física permanece pendente de hardware.



Não considerar produção aprovada só pelo build: testar no domínio publicado com Supabase real e dois aparelhos. Nunca usar os antigos testes HTTP D1 como comprovação de integração Supabase.

