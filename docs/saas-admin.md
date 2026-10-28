# Painel do SaaS

Acesse `/admin` com a senha administrativa compartilhada. A verificação acontece apenas no servidor; a interface não recebe a senha configurada nem a chave de assinatura. A API administrativa aceita a sessão HttpOnly e não depende da conta Supabase do dono ou de `SAAS_ADMIN_USER_IDS`.

## Ativação

1. Configure `SAAS_ADMIN_PASSWORD` no ambiente do servidor com a senha escolhida pelo proprietário. Não use prefixo `NEXT_PUBLIC_`.
2. Configure `SAAS_ADMIN_SESSION_SECRET` com pelo menos 32 caracteres aleatórios, somente no servidor. Use um segredo próprio, independente da senha e das chaves do Supabase.
3. Reinicie o servidor ou faça um novo deploy. Sem ambas as variáveis válidas, o acesso permanece bloqueado. A mensagem de login não informa qual configuração está ausente.

A sessão dura no máximo oito horas. O cookie `maestria_admin_session` usa `Path=/`, `HttpOnly`, `SameSite=Strict` e `Secure` em produção. O valor é assinado com HMAC-SHA256 e vinculado à versão da senha: alterar a senha ou o segredo invalida imediatamente as sessões anteriores. A senha é comparada no servidor por scrypt e comparação de tempo constante. Sair apaga o cookie deste navegador; para invalidar todos os navegadores, altere a senha ou o segredo. As alterações feitas com a senha compartilhada são auditadas como `Administrador`, sem identificação individual.

`GET /api/admin-session` consulta se a sessão é válida. `POST` recebe apenas `{ "password": "..." }` em JSON de até 1.024 bytes; `DELETE` encerra a sessão. Login, logout e alterações administrativas exigem `Origin` exatamente igual à origem do servidor. Não há senha padrão nem segredo no código, nos arquivos públicos ou nos logs da aplicação.

O login permite até cinco tentativas a cada dez minutos por IP e sessenta por minuto no total **por instância do servidor**. A memória dos limites é limitada e não é compartilhada entre instâncias, regiões ou reinicializações. Na Vercel é usado `X-Forwarded-For`, que a plataforma sobrescreve ([documentação oficial](https://vercel.com/docs/headers/request-headers)); em outros servidores, cabeçalhos de IP não são confiados e todas as tentativas compartilham um grupo local. Antes de ampliar a operação para vários servidores, adote armazenamento compartilhado ou proteção equivalente no proxy. Esses limites não são apresentados como proteção distribuída.

Não é necessário criar tabelas: dados de assinatura, cobranças e auditoria usam a propriedade interna `saas` do estado da barraca, com a mesma proteção de concorrência da operação. Essa propriedade nunca é retornada pela API operacional.

## Uso

- Barracas: dados de operação, contato, atividade baseada em pedidos e pagamentos, plano, mensalidade, dia de vencimento de 1 a 28, período de teste e notas internas.
- Donos: contas cadastradas, último login e donos que ainda não cadastraram uma barraca.
- Cobranças: gerar mensalidades para assinaturas ativas com valor definido, criar cobrança avulsa, filtrar vencidas, registrar pagamento recebido, cancelar cobrança e reverter registro com motivo.
- Resumo: receita mensal prevista de assinaturas ativas, pagamentos efetivamente registrados no mês, valores vencidos e histórico de recebimentos.
- Atenção: barracas com comandas aguardando envio há mais de 2 minutos, envios sem conclusão há mais de 90 segundos, falhas e envios incertos registrados em comandas das últimas 24 horas. Também mostra cardápio/mesas ausentes, mensalidade ativa com valor zero, fim de teste e cobranças vencidas. Cada ponto orienta a próxima ação e abre a barraca correspondente.
- CSV: exportar donos, barracas e cobranças. Textos que poderiam ser interpretados como fórmulas são neutralizados.

Os pontos de atenção são calculados no servidor a partir do estado salvo, ao carregar ou atualizar o painel. A data da leitura aparece no painel e nos detalhes da barraca. Não há sonda dos celulares, confirmação de papel físico, alerta push, e-mail ou monitoramento contínuo. Uma falha histórica pode ter uma segunda via bem-sucedida posterior; as últimas 24 horas mostram ocorrências para conferência, não incidentes comprovadamente em aberto. Cancelamentos anteriores à impressão não são contados como falha de equipamento. Uma fila antiga pode continuar aparecendo até o responsável verificar e resolver seus trabalhos na operação.

Nenhuma conta existente recebe plano pago ou cobrança automaticamente. Uma mensalidade tem identificação única por competência; repetir a geração não duplica. Alterar o preço do plano não modifica cobranças já geradas. Os recebimentos são manuais, sem gateway, Pix automático, envio de mensagem ou agendamento de geração. Lembretes são apenas copiados para envio pelo administrador.

Pausar ou cancelar uma assinatura exige confirmação na interface e bloqueia o acesso operacional do dono/equipe, preservando dados. Cobrança vencida e data final do teste não bloqueiam o acesso automaticamente. Recebimentos não são excluídos sem registro: reversões preservam o motivo na auditoria. As receitas das barracas são distintas das receitas do SaaS.

A listagem percorre todas as páginas de usuários e barracas, sem truncar no limite padrão do Supabase. No volume inicial, os indicadores são calculados sob demanda; em larga escala, convém migrar relatórios e faturamento para tabelas dedicadas e consultas agregadas.

As alterações exigem JSON e corpo de até 12.000 bytes, medido também quando `Content-Length` não está presente. O UUID da barraca é validado antes do acesso ao banco. O registro de recebimento considera o dia em `America/Sao_Paulo`, inclusive durante a virada de data em UTC.
