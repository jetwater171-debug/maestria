# Impressão: garçom ou cozinha

O dono escolhe em Configurações → Onde os pedidos serão impressos.

- Com o garçom: novos pedidos geram comandas atribuídas ao funcionário autenticado. Com a conexão direta testada, o botão Enviar e imprimir salva o pedido e já envia a comanda ao aparelho do garçom. A cozinha continua vendo o pedido, mas sua impressão automática não consome essa fila.
- Direto na cozinha (padrão legado): novos pedidos entram na fila central; impressão automática via conexão Serial/BLE compatível ou Star CloudPRNT. Para o modo direto, manter tela da cozinha aberta, dispositivo ativo e impressora conectada.
- Trocas valem para novos pedidos. Destinos existentes não mudam; cancelamentos e segundas vias preservam destino e funcionário. A troca para garçom desliga o CloudPRNT.
- Configuração e novos campos vivem no JSON da barraca. Não exige migração SQL.

## Android

Conexão direta é oferecida quando o navegador expõe as APIs necessárias. Quando não oferece, o tutorial apresenta RawBT: instalar pela Play Store, autorizar Bluetooth, selecionar a TC-163 dentro do aplicativo e testar em 58 mm. A tela também oferece Open ESC/POS e impressão do navegador (que depende de um serviço de impressão instalado).

## Enviar e imprimir no celular do garçom (21/10/2026)

Escolher Com o garçom nas configurações (ou Usar impressora com o garçom na configuração da impressora), conectar por Serial/BLE e confirmar o teste uma vez por conexão. O envio normal não pede outro botão de impressão. Sem conexão testada, o carrinho permanece aberto e a configuração é mostrada antes de enviar.

Depois da confirmação do pedido pelo servidor, o cliente reserva sua comanda e envia o conteúdo retornado pelo servidor. Uma fila local serializa pedidos rápidos; a reserva autenticada impede repetição por resposta perdida, toque duplo ou sincronização offline. Pedidos offline só imprimem depois de sincronizados e com conexão direta testada. Trabalhos enviados/incertos e histórico não são repetidos automaticamente. Falha de impressão não desfaz o pedido recebido: mostrar alerta e conferir a fila/papel antes de outra via. O modo cozinha continua disponível.

As fotos fornecidas identificam a unidade vendida como HAVENDO.L TC-163: autoteste JK-5801P, firmware V3.2F, nome KPrinter_523c, interfaces BT/USB, desligamento automático após 10 minutos. O manual informa ESC/POS, papel de aproximadamente 58 mm e área imprimível de 48 mm. A indicação BT não especifica Classic versus BLE. Bluefy só oferece o caminho direto quando a unidade disponibiliza BLE/GATT compatível; não converte SPP em BLE. UUID desconhecido não recebe comandos automaticamente.

87 testes passaram, incluindo envio sem botão extra, sequência de pedidos, toque duplo, perda de reserva/confirmação e interrupção parcial. Testes de transporte usaram simulação; não comprovam papel físico nem confirmam BLE nesta unidade.

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

Os testes incluem API autenticada com banco simulado, isolamento entre garçons com o mesmo nome, cancelamento, concorrência, segunda via, CAS e igualdade dos bytes RawBT/ESC-POS. TC-163, versões reais dos navegadores e saída física pelo RawBT precisam de teste no aparelho; build ou teste simulado não comprovam impressão física.


## Configuração guiada (outubro de 2026)

- A configuração agora identifica APIs reais de Serial/BLE e contexto HTTPS; Android não é presumido incompatível. Primeiro oferece conexão sem aplicativo, quando disponível.
- Botões Serial e BLE só aparecem quando existe a API correspondente. A configuração é compartilhada entre painel, cozinha e comandas do garçom.
- Conectar → imprimir teste → confirmar saída do papel. O automático só libera depois da confirmação. Desconexão, troca de aparelho/impressora ou erro de transporte invalidam o teste. Retomar mantém o corte da primeira ativação para não pular pedidos recebidos durante a pausa.
- Impressora já conectada tem prioridade sobre preferência antiga de RawBT. O método escolhido pelo usuário continua ajustável.
- Android sem API, ou conexão direta malsucedida: tutorial RawBT em três passos (instalar, parear/configurar e testar pelo site), com alternativa Open ESC/POS. Abertura por toque e confirmação manual continuam obrigatórias.
- iPhone sem API: instruções condicionais. Bluefy é oferecido após informar que a impressora tem BLE; uma TC-163 Classic não se torna BLE. AirPrint requer equipamento/ponte de rede compatível. A configuração sugere central na cozinha quando não houver conexão local compatível.
- O acesso individual pode ser copiado por ação do usuário para abrir a barraca no Bluefy. Não registrar nem exibir o token em logs/documentação.
- Não é possível garantir impressão Bluetooth local sem aplicativo em todos os celulares/navegadores apenas mudando o site. Fontes primárias: https://developer.chrome.com/release-notes/138#web_serial_over_bluetooth_on_android , https://developer.chrome.com/docs/capabilities/bluetooth , https://bluefy.app/guide.html , https://support.apple.com/en-au/109349 .

## Central compartilhada (19/10/2026)

O dono pode ativar **Permitir central compartilhada**. Isso mantém os dois modos de trabalho e permite que qualquer navegador autorizado solicite uma comanda pelo site, mesmo sem acesso ao Bluetooth local.

1. Na cozinha, conectar e testar a impressora em um Android/computador com conexão Serial ou BLE compatível.
2. Confirmar a saída do teste e tocar em **Ativar automático**. Manter a cozinha aberta, com internet e aparelho ligado.
3. Nos outros celulares, escolher **Imprimir na central**. O papel sai na cozinha, não na impressora portátil do garçom.

No modo cozinha, novos pedidos continuam sendo impressos automaticamente. No modo garçom, a central só recebe comandas portáteis explicitamente encaminhadas; cada garçom pode encaminhar apenas as suas. A configuração não dá à cozinha acesso à fila portátil inteira.

A central consulta a fila a cada quatro segundos. Sua sessão expira após vinte segundos sem sinal; durante um transporte longo, um heartbeat separado mantém a disponibilidade. Só um aparelho ocupa a central por barraca. Pausar/retomar usa nova identidade de sessão para que uma liberação atrasada não desative a nova central. Trabalhos enviados/incertos não são repetidos automaticamente. Reenvio de solicitação ainda na fila é idempotente; segunda via exige conferência explícita.

No iPhone, o tutorial também apresenta a extensão **beacio** como alternativa experimental para BLE no Safari: requer app/extensão, iOS 26.2+ conforme a App Store atual e impressora BLE. Não funciona com Classic/SPP, nem adiciona Bluetooth ao PWA. A central compartilhada dispensa essa extensão nos celulares que apenas solicitam impressão.

O status online é indicativo; o servidor valida a sessão e a autorização em cada solicitação. Não exige SQL novo. A central precisa de internet e aba em primeiro plano, e não substitui um servidor local offline.

Pesquisa e fontes: [printing-research.md](printing-research.md). 74 testes passaram. Interface revisada em simulação local de iPhone sem APIs, 390 e 320 px, com solicitação HTTP encaminhada e sem acionamento de hardware. A saída física continua pendente de teste na TC-163 do cliente.
