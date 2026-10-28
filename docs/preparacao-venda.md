# Preparação para venda — Maestria Beach

Revisão de 28/10/2026. Este roteiro separa implementação, verificação automatizada e validação de operação real.

| Etapa | Entrega e critério de aceite | Estado |
| --- | --- | --- |
| 1. Impressão portátil | Cada garçom usa seu celular e sua própria TC-163; conectar, conferir teste, enviar pedido e verificar papel. Sem duplicação após erro ou reconexão. | Transporte Serial/BLE, fila e diagnóstico implementados; falta homologação física Android e iPhone. |
| 2. Administração do SaaS | `/admin` protegido; listar clientes/barracas, ver pendências, configurar assinatura, gerar cobrança, registrar/reverter recebimento com histórico. | Implementado; validar sessão e operações no ambiente publicado. |
| 3. Oferta comercial | Site responsivo, recursos reais e contratação com condições claras. | Seção de assinatura implementada; preço público sob consulta até decisão comercial. |
| 4. Integridade da operação | Preço do servidor, permissões, concorrência, pedidos offline, conta parcial e impressão incerta. | Testes automatizados cobrem os fluxos; falta ensaio completo com duas contas e aparelhos reais. |
| 5. Piloto de venda | Uma barraca acompanhada durante atendimento, com plano acordado, suporte, recuperação e impressão testados. | Depende das validações abaixo. |

## Impressão: condição para oferecer Android e iPhone

A caixa e o autoteste identificam HAVENDO.L TC-163 / JK-5801P / KPrinter_523c, BT/USB. O manual menciona iPhone, mas não identifica BLE/GATT ou SDK. A unidade não está homologada no iPhone apenas por essa indicação.

No Android, testar Chrome atualizado com Web Serial disponível, ou BLE se compatível. No iPhone/iPad, testar a descoberta BLE e o envio no Bluefy. Safari comum, PWA, AirPrint e aplicativos Android não são substitutos universais para essa conexão. O relatório e as fontes estão em [printing-research.md](printing-research.md); o procedimento está em [iphone-printing.md](iphone-printing.md).

O teste físico deve incluir dois pedidos rápidos, perda de internet, retorno da conexão, impressora desligada/religada, falta de papel e retomada após bloquear o celular. `Enviada` registra transporte, sem comprovar papel. Não reimprimir automaticamente um envio incerto.

## Administração e cobrança

O painel recebe a senha exclusivamente no servidor. A configuração privada, os limites de login e a sessão são descritos em [saas-admin.md](saas-admin.md). As pendências operacionais representam o último estado carregado; não são monitoramento de aparelhos em segundo plano.

As cobranças e os recebimentos são registros administrativos manuais. Não existe gateway de assinatura, débito recorrente, Pix automático ou mensagem de cobrança enviada pelo sistema. Definir preço, vencimento e condições com o cliente antes de ativar uma mensalidade. Valores passados não mudam ao alterar o preço do plano.

## Ensaio antes do primeiro cliente pagante

1. Criar duas contas e conferir que cada dono vê somente sua barraca; os acessos de equipe respeitam as funções e a revogação.
2. Cadastrar cardápio, mesas e equipe; conferir preços importados pelo scanner antes de aceitar.
3. Garçom envia, cozinha marca pronto, garçom entrega e caixa recebe, com e sem serviço, incluindo pagamento parcial.
4. Abrir o painel online uma vez após a atualização. Reabrir sem rede no mesmo navegador, guardar pedido e retomar a conexão; conferir que chega uma única vez e não muda de atendimento.
5. Conferir recuperação de senha, SMTP, retorno de cadastro, saída e nova entrada no domínio real.
6. Validar impressão portátil em papel nos dois sistemas e com o lote de impressoras que será usado.
7. Validar backup e recuperação do Supabase e combinar o canal de suporte. O estado por barraca ainda é JSONB; crescimento de volume exige evolução das consultas e do armazenamento.

## Decisões ainda abertas

- Preço, condições de contratação, canal comercial e suporte.
- Compatibilidade física da TC-163 no iPhone; se BLE/GATT não for demonstrado, obter integração documentada do fornecedor ou definir equipamento compatível antes de anunciar esse suporte.
- Acompanhamento do primeiro atendimento real. Build, deployment e testes com transporte simulado não encerram essa etapa.
