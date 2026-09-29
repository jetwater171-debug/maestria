# Painel do SaaS

Acesse `/admin` com e-mail e senha de uma conta existente. A API verifica a sessão no Supabase e exige que o UUID autenticado esteja em `SAAS_ADMIN_USER_IDS`, configurado somente no servidor. Não autoriza por metadados, papel do cliente, link de funcionário ou primeiro cadastro. Sem essa variável, nenhum usuário tem acesso.

## Ativação

1. Identifique a conta indicada pelo proprietário em Supabase → Authentication → Users.
2. Configure `SAAS_ADMIN_USER_IDS` com o UUID dessa conta na Vercel, Production. Para vários administradores, separe UUIDs por vírgulas.
3. Faça um novo deploy. Não é necessário criar tabelas: dados de assinatura, cobranças e auditoria usam a propriedade interna `saas` do estado da barraca, com a mesma proteção de concorrência da operação. Essa propriedade nunca é retornada pela API operacional.

## Uso

- Barracas: dados de operação, contato, atividade baseada em pedidos e pagamentos, plano, mensalidade, dia de vencimento de 1 a 28, período de teste e notas internas.
- Donos: contas cadastradas, último login e donos que ainda não cadastraram uma barraca.
- Cobranças: gerar mensalidades para assinaturas ativas com valor definido, criar cobrança avulsa, filtrar vencidas, registrar pagamento recebido, cancelar cobrança e reverter registro com motivo.
- Resumo: receita mensal prevista de assinaturas ativas, pagamentos efetivamente registrados no mês, valores vencidos e histórico de recebimentos.
- CSV: exportar donos, barracas e cobranças. Textos que poderiam ser interpretados como fórmulas são neutralizados.

Nenhuma conta existente recebe plano pago ou cobrança automaticamente. Uma mensalidade tem identificação única por competência; repetir a geração não duplica. Alterar o preço do plano não modifica cobranças já geradas. Os recebimentos são manuais, sem gateway, Pix automático, envio de mensagem ou agendamento de geração. Lembretes são apenas copiados para envio pelo administrador.

Pausar ou cancelar uma assinatura exige confirmação na interface e bloqueia o acesso operacional do dono/equipe, preservando dados. Cobrança vencida e data final do teste não bloqueiam o acesso automaticamente. Recebimentos não são excluídos sem registro: reversões preservam o motivo na auditoria. As receitas das barracas são distintas das receitas do SaaS.

A listagem percorre todas as páginas de usuários e barracas, sem truncar no limite padrão do Supabase. No volume inicial, os indicadores são calculados sob demanda; em larga escala, convém migrar relatórios e faturamento para tabelas dedicadas e consultas agregadas.
