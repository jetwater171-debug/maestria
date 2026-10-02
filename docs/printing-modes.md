# Impressão: garçom ou cozinha

O dono escolhe em Configurações → Onde os pedidos serão impressos.

- Com o garçom: novos pedidos geram comandas atribuídas ao funcionário autenticado. A fila aparece em Mesas, inclusive para o dono. O garçom prepara, imprime e leva o papel. A cozinha continua vendo o pedido, mas sua impressão automática não consome essa fila.
- Direto na cozinha (padrão legado): novos pedidos entram na fila central; impressão automática via conexão Serial/BLE compatível ou Star CloudPRNT. Para o modo direto, manter tela da cozinha aberta, dispositivo ativo e impressora conectada.
- Trocas valem para novos pedidos. Destinos existentes não mudam; cancelamentos e segundas vias preservam destino e funcionário. A troca para garçom desliga o CloudPRNT.
- Configuração e novos campos vivem no JSON da barraca. Não exige migração SQL.

## Android

RawBT é a opção inicial em Imprimir comanda. Instalar pela Play Store, autorizar Bluetooth, selecionar a TC-163 dentro do aplicativo e testar em 58 mm. A tela também oferece Open ESC/POS e impressão do navegador (que depende de um serviço de impressão instalado).

O site reserva a comanda primeiro. Um novo toque abre `rawbt:base64,<bytes ESC/POS>`, preservando a ativação do usuário exigida pelo navegador. O código apenas implementa o protocolo público, sem copiar código do aplicativo. ESC/POS usa ASCII sem acentos, quebra em 32 colunas, inicialização e avanço de papel; caracteres de controle enviados pelo cliente são removidos.

Depois da abertura, o usuário confere o papel e registra a conclusão. Não existe callback físico nessa ponte. `sent` significa envio/conferência registrada, nunca confirmação física automática. Abortar ou perder a comunicação gera estado incerto; não há repetição automática. Segunda via exige confirmação e recebe identificação impressa.

Não é possível garantir Bluetooth direto ou abertura de apps em todo navegador Android. Navegadores internos, bloqueio de links externos e permissões do Android podem impedir a ponte. O RawBT requer toque; não é usado para simular impressão automática por timer. Em navegador compatível, a conexão direta existente continua disponível.

## Concorrência e permissões

- Identidade do funcionário é atribuída pelo servidor, nunca pelo nome ou payload do pedido.
- Cada garçom só reserva suas próprias comandas. Cozinha não acessa comandas portáteis, e caixa não acessa API de impressão.
- Reservas por destino/funcionário permitem dois garçons imprimirem em paralelo. Tokens e IDs de dispositivo não são expostos pela API de workspace.
- Operações usam controle de versão da barraca; reenvio de pedido mantém ID e não duplica a comanda.
- Em envio interrompido, a reserva expira para `uncertain` ao consultar novamente após 90 segundos. Conferir papel antes de uma segunda via.
- Comandas antigas sem destination continuam sendo da cozinha. Cancelamento de pedido não elimina uma impressão que já esteja em andamento: a equipe deve comunicar o cancelamento.

## Fontes consultadas

- Protocolo RawBT do próprio autor: https://github.com/402d/DemoRawBtPrinter/blob/master/app/src/main/java/ru/a402d/demorawbt/MainActivity.java (test2, esquema rawbt:base64).
- Regras de abertura de aplicativos: https://developer.chrome.com/docs/android/intents (timers sem gesto não abrem apps).
- Web Serial no Android: https://support.google.com/chrome/a/answer/7679408 (Chrome 138 / RFCOMM; não implica suporte em todos os navegadores ou aparelhos).

## Verificação

49 testes passaram, incluindo API autenticada com banco simulado, isolamento entre garçons com o mesmo nome, cancelamento, concorrência, segunda via, CAS e igualdade dos bytes RawBT/ESC-POS. Interface móvel e URI Android verificadas com dados fictícios, sem abrir aplicativo nem acionar hardware. TC-163, versões reais dos navegadores e saída física pelo RawBT precisam de teste no aparelho; build ou teste simulado não comprovam impressão física.
