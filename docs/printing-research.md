# Pesquisa e decisão: impressão em celulares

Revisão em 19/10/2026. Foram comparados projetos de transporte Bluetooth, serviços Android, extensões iOS, pontes desktop e protocolos de impressoras, usando relatos como pistas e documentação/código do autor para confirmar limites. Não houve teste físico na TC-163.

## Conclusão aplicada

Não existe uma biblioteca JavaScript que dê ao Safari acesso universal a uma impressora Bluetooth Classic. A cobertura mais ampla é separar o celular que faz o pedido do aparelho conectado à impressora. O Maestria passa a oferecer uma **central compartilhada pelo próprio navegador**, aproveitando sua conexão Serial/BLE existente e a fila HTTPS autenticada. Não exige instalar programas nos celulares que apenas solicitam a impressão.

Para quem carrega a impressora, continuam as opções locais: Serial SPP no Android/navegador que expõe a API, BLE quando a impressora oferece GATT, serviço Android por toque, e alternativas iOS condicionadas ao equipamento. Central na cozinha não transforma uma TC-163 portátil Classic em uma impressora iPhone.

## Projetos comparados

| Projeto / fonte | O que realmente faz | Decisão para o Maestria |
| --- | --- | --- |
| [WebSerialReceiptPrinter](https://github.com/at-point-of-sale/WebSerialReceiptPrinter) | Transporte Web Serial; precisa da API e equipamento compatível. | Manter nosso transporte, reserva e tratamento de envio incerto. |
| [WebBluetoothReceiptPrinter](https://github.com/at-point-of-sale/WebBluetoothReceiptPrinter) | BLE/GATT e perfis de fabricantes; README alerta que algumas falhas podem não rejeitar print(). | Não copiar critério de sucesso; BLE não substitui SPP. |
| [Open ESC/POS Print Service](https://github.com/farminos/open-escpos-print-service) | PrintService Android e intent com páginas HTML compactadas; Bluetooth/USB/rede. | Manter fallback guiado já implementado, com toque e conferência. |
| [RawBT: demonstração do autor](https://github.com/402d/DemoRawBtPrinter) | Esquema rawbt:base64 encaminha ESC/POS ao aplicativo Android. | Manter tutorial e teste; abertura de app não confirma papel. |
| [QZ Tray / Print Server](https://qz.io/docs/print-server) | Agente/servidor que recebe impressão de outros navegadores; configuração de certificados. | Maduro, mas adiciona instalação e configuração que não precisamos para a central atual. |
| [PrintNode](https://www.printnode.com/en/faq) | Cliente em computador/Pi com API HTTPS comercial; celulares não conectam à impressora. | Arquitetura válida, porém adicionaria serviço e custos externos. |
| [node-thermal-printer](https://github.com/Klemen1337/node-thermal-printer) | Biblioteca MIT para gerar/enviar comandos em uma central Node. | Opção futura para central permanente, sem depender de aba aberta. Não dá hardware ao navegador móvel. |
| [PrintBridge](https://github.com/vergil-lai/print-bridge/blob/main/README_en.md) | Ponte desktop/headless, fila e controle de acesso. | Referência para central futura; exige instalação/manutenção local. |
| [escprintbridge](https://github.com/teknosuper/escprintbridge) | Serviço Android em primeiro plano consultando fila HTTPS e enviando Bluetooth/TCP. | Referência arquitetural; não copiar/distribuir sem licença declarada nem herdar tokens em query. |
| [beacio SDK](https://github.com/wklm/beacio-sdk) / [App Store atual](https://apps.apple.com/br/app/beacio/id6761301368) | App + extensão Safari injeta Web Bluetooth para BLE. Loja atual exige iOS 26.2+. PWA orienta abrir Safari. | Adicionar tutorial experimental opcional; não é solução sem app nem para SPP. |
| [Bluefy](https://bluefy.app/guide.html) | Navegador iOS com Web Bluetooth BLE. | Manter tutorial condicionado a BLE real na impressora. |
| [Star CloudPRNT](https://github.com/star-micronics/cloudprnt-sdk) | Impressora compatível consulta servidor e informa resultado. | Integração existente continua disponível para hardware Star, não TC-163. |

## Documentação e relatos confrontados

- [Chrome 138: Web Serial over Bluetooth on Android](https://developer.chrome.com/release-notes/138#web_serial_over_bluetooth_on_android): Android pode expor RFCOMM, além de BLE. Verificar funções reais, não apenas o nome do navegador.
- [Chrome: Serial over Bluetooth](https://developer.chrome.com/blog/serial-over-bluetooth): SPP usa pareamento e seletor; UUID aleatório não conserta impressora ausente.
- [Apple: AirPrint](https://support.apple.com/pt-br/109349): exige impressora compatível em rede, não basta parear Bluetooth.
- [Reddit: SaaS e ESC/POS](https://www.reddit.com/r/webdev/comments/1wmy51x/help_with_escpos_printer_and_web_saas/): discussão de agente desktop intermediário; alguns comentários ignoram o Serial Android recente.
- [Reddit: ponte WebView Android](https://www.reddit.com/r/indotech/comments/1rjj22z/escpos_print_direct_dari_web/): “impressão web” pode significar aplicativo nativo por trás.
- [Reddit: navegador e impressora iOS/Android](https://www.reddit.com/r/techsupport/comments/1e1uyvc/): frustrações com descoberta de impressoras reforçam que rede/Bluetooth não implica AirPrint.

## Central implementada

1. Dono permite a central compartilhada nas configurações.
2. Na cozinha, um aparelho com conexão direta compatível conecta a TC-163, testa em papel e ativa o automático.
3. Outros celulares usam “Imprimir na central”; apenas HTTP autenticado, sem Bluetooth/app local.
4. O receptor consulta a fila a cada quatro segundos, renova sua sessão e envia os bytes pelo transporte existente. Um heartbeat separado mantém a sessão durante comandas longas.

A central fica indisponível após 20 segundos sem sinal. Só uma central ativa é permitida por barraca. Apenas comandas autorizadas podem ser encaminhadas; pedido repetido não cria outra comanda. Comandas enviadas/incertas não são reenviadas automaticamente. Mudança de central só permite retarget de trabalhos ainda queued. A reserva privada continua exigida para concluir o envio.

A central precisa de internet, aba em primeiro plano e aparelho ligado; não é uma implementação offline nem um serviço Android em segundo plano. `sent` continua significando envio ao transporte, não comprovação física do papel. Os dados de acesso permanecem no servidor/headers, sem segredos em URLs públicas ou aplicativos terceiros.

## Verificação da implementação

74 testes passaram, incluindo o handler real da API com banco simulado: escopo dos funcionários, central única, expiração, CAS, solicitação repetida, heartbeat durante impressão, liberação atrasada, reserva privada e segunda via. A interface foi revisada em 390 e 320 px; uma simulação local de iPhone sem APIs enviou `relay` sem solicitar Bluetooth local. Nenhum teste acionou hardware ou instalou aplicativos. A TC-163 física e os navegadores reais dos aparelhos continuam exigindo validação no local.
