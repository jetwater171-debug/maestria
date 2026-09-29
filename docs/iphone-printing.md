# Impressão pelo iPhone

O site suporta transporte Web Bluetooth BLE em Bluefy/WebBLE. Safari e PWA
não oferecem esse transporte. Não há confirmação física da TC-163 no iPhone.
ESC/POS é o formato dos comandos; BLE e SPP são transportes diferentes.

## Operação

1. Desconectar a impressora do notebook e de outros aplicativos.
2. Abrir o site HTTPS no Bluefy/WebBLE e permitir Bluetooth.
3. Cozinha → Impressão automática → Configurar → Conectar por Bluetooth BLE.
4. Selecionar a impressora e imprimir um teste; confirmar no papel.
5. Ativar automático e manter a cozinha visível, com a tela ligada.

A mesma fila autenticada, reserva e confirmação atende BLE, Serial e impressão
manual. Falhas de envio deixam a comanda incerta, sem repetição automática.
Blocos de 20 bytes com intervalo de 50 ms evitam depender de um MTU maior.
O limite de envio é 40 segundos. O teste no papel é necessário mesmo quando
o navegador confirma que os bytes foram enviados.

Perfis: ISSC UART, FF00/FF02, FFE0/FFE1, 18F0/2AF1. UUIDs diferentes podem
ser informados em Configuração avançada, se confirmados pelo fabricante.
A seleção aceita dispositivos BLE sem filtrar pelo nome comercial. Serviços
precisam estar autorizados em optionalServices. O diagnóstico só mostra os
serviços autorizados; não é um inventário de todos os serviços do dispositivo.
Canais desconhecidos não recebem comandos. A detecção de um perfil não
garante que o firmware aceite ESC/POS: o teste físico valida isso.

## Referências analisadas

- https://github.com/daphtdazz/WebBLE — polyfill GATT e métodos de escrita.
- https://github.com/joshmcarthur/yhk-mini-printer — transporte Web Bluetooth,
  UUID ISSC, fragmentação e ponte iOS; hardware YHK, não TC-163.
- https://github.com/kevinfavv/CapacitorThermalPrinter — BleTransport.swift,
  perfis de descoberta e restrições de SPP no iOS.
- https://github.com/qzind/tray — alternativa com servidor intermediário;
  não é um transporte Bluetooth direto no iPhone.
- https://github.com/cicloid/printable — protocolos de outros modelos e
  ponte AirPrint; não comprova compatibilidade TC-163.

Implementação própria baseada nas APIs e perfis documentados. Nenhum SDK
nativo, aplicativo de terceiros ou código de protocolo proprietário foi
incorporado. Se a unidade for apenas Classic SPP, usar a central no MacBook
que já foi testada, ou validar outro hardware com BLE compatível.
