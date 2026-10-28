# Pesquisa e decisão: impressão em celulares

Revisão em 28/10/2026. Foram comparados projetos no GitHub, documentação dos fornecedores, fórum Chromium e discussões Reddit. Relatos são pistas; as afirmações de compatibilidade abaixo se apoiam nas fontes primárias vinculadas. Não houve teste físico na TC-163.

## Conclusão aplicada

O requisito de venda é **cada garçom com sua própria TC-163 portátil, usando o próprio Android ou iPhone**. A central da cozinha continua sendo uma função opcional já existente; ela não atende esse requisito. O caminho preferencial é conexão direta testada no aparelho do garçom, com envio após o servidor salvar o pedido. Aplicativos Android são alternativas com toque extra.

Não há evidência primária suficiente para homologar a unidade TC-163 / JK-5801P V3.2F / KPrinter_523c no iPhone: BT/USB e ESC/POS no autoteste não informam BLE/GATT, MFi ou AirPrint. Não foi identificado SDK do fabricante que comprove essa integração. Se oferecer apenas Classic SPP, um navegador BLE não a converte em BLE. O bloqueio de homologação permanece explícito até descoberta do serviço e teste real no papel.

As fotos recuperadas do próprio equipamento mostram a caixa HAVENDO.L TC-163 e um manual genérico que menciona Android **ou iPhone** e senha Bluetooth 0000. Portanto, também não se conclui que a unidade é somente SPP. O manual fotografado não identifica aplicativo, UUID GATT, SDK iOS, MFi ou QR de fabricante. A menção a iPhone é alegação do manual, ainda sem teste de impressão no aparelho.

## Matriz para o equipamento do garçom

| Aparelho / método | Condição real | Estado no Maestria |
| --- | --- | --- |
| Android / Chrome / Web Serial | Chrome 138 introduziu RFCOMM Android; API exposta, pareamento SPP e HTTPS. Permissão inicial por toque. | Transporte implementado. Envia junto do pedido após conectar e confirmar o teste. Validar a unidade física. |
| Android / Web Bluetooth | Navegador com API e impressora BLE/GATT com canal ESC/POS reconhecido. | Implementado; não serve para SPP. |
| Android / RawBT ou Open ESC/POS | App instalado/configurado e toque para abrir o link externo. | Implementado. Não equivale a automático sem interação. |
| Android / USB OTG | WebUSB depende de interface/endpoints, permissão e protocolo do dispositivo; Web Serial Bluetooth não prova USB Android. | Sem driver WebUSB genérico implementado; app auxiliar é caminho a testar. |
| iPhone ou iPad / Safari comum ou PWA | Não se deve presumir Web Serial/Bluetooth. Código testa funções reais. | Não homologado para TC-163 direta. Instalar PWA não fornece essas APIs. |
| iPhone ou iPad / Bluefy | Navegador BLE e canal da impressora compatível. | Transporte BLE e tutorial implementados; BLE dessa unidade ainda não confirmado. |
| iPhone / Safari + beacio | Extensão/app, iOS 26.2+ segundo loja atual, permissões e impressora BLE. | Tutorial experimental; detecção real de navigator.bluetooth, sem SDK terceiro. PWA não recebe a extensão. |
| iPhone ou iPad / AirPrint | Impressora explicitamente AirPrint em rede compatível; diálogo do sistema. | Saída pelo navegador disponível; não transforma a TC-163 Bluetooth/USB em AirPrint. |
| Computador / Serial ou BLE | APIs e equipamento compatíveis. | Implementado; não resolve a mobilidade individual por si só. |
| Tablet | As mesmas restrições de Android ou iPadOS, conforme sistema/navegador/hardware. | Nenhuma promessa baseada apenas no formato tablet. |

## Pontes e SDKs: o que resolveriam

- [Server for RawBT, publicação do autor](https://play.google.com/store/apps/details?id=rawbt.server): serviço **Android** com TCP 9100 e WebSocket 40213. Não é app iOS. Usá-lo pelo iPhone exigiria outro aparelho/ponte acessível e associação individual da impressora. Não implementado nem testado aqui.
- [rawbt_ws_server](https://github.com/402d/rawbt_ws_server): projeto **PHP para computador**, distinto do aplicativo Android acima; exemplo usa ws://127.0.0.1:40213. Não é solução portátil universal pronta.
- Pontes HTTP/WS locais exigem validar origem, autorização, rede, certificados/mixed content e versão do navegador. O [Chrome documenta regras de acesso à rede local](https://developer.chrome.com/blog/local-network-access); copiar um exemplo ws:// não comprova funcionamento a partir do site HTTPS. Não solicitar desativação global da segurança.
- [Star webPRNT](https://www.star-m.jp/products/s_print/sdk/webprnt/manual/en/_sampleProgram.htm) oferece navegador iOS/Android e SDK para impressoras Star compatíveis, inclusive portáteis. [Epson ePOS JavaScript](https://www.epson.jp/dl_soft/readme/47012.htm) atende hardware Epson suportado. Nenhum desses SDKs comprova suporte a uma JK-5801P genérica.
- [Apple Core Bluetooth Classic](https://developer.apple.com/videos/play/wwdc2019/901/) cobre **GATT sobre BR/EDR** em APIs nativas; isso não significa RFCOMM/SPP arbitrário no Safari nem prova de GATT na TC-163. Evitar a afirmação ampla de que todo Bluetooth Classic seria impossível no iOS.
- Uma ponte física portátil com alimentação e transporte adequado é uma hipótese de engenharia, não solução homologada para esta unidade. Exige hardware extra, firmware, vínculo individual e teste em deslocamento; não foi construída nesta revisão.

## Homologação que falta para vender a impressão portátil

1. Testar uma TC-163 do lote real no Android atualizado: pareamento, teste, pedido, dois pedidos rápidos, desligar/religar, falta de papel e rede indisponível.
2. No iPhone, verificar a unidade no seletor BLE/Bluefy ou scanner BLE. Se aparecer, identificar serviço/canal autorizado e imprimir antes de confirmar o teste. Ausência no primeiro scan pode ser permissão, bateria ou conexão concorrente; não prova isoladamente ausência de BLE.
3. Sem BLE/GATT confirmado, obter documentação/SDK iOS do fabricante. Não anunciar compatibilidade iPhone com este modelo enquanto não houver caminho e papel comprovados.
4. Validar celular bloqueado e troca de aba. A implementação web exige site ativo; não promete impressão em segundo plano. Um envio incerto exige conferir o papel antes da segunda via.

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

## Central opcional já implementada

1. Dono permite a central compartilhada nas configurações.
2. Na cozinha, um aparelho com conexão direta compatível conecta a TC-163, testa em papel e ativa o automático.
3. Outros celulares usam “Imprimir na central”; apenas HTTP autenticado, sem Bluetooth/app local.
4. O receptor consulta a fila a cada quatro segundos, renova sua sessão e envia os bytes pelo transporte existente. Um heartbeat separado mantém a sessão durante comandas longas.

A central fica indisponível após 20 segundos sem sinal. Só uma central ativa é permitida por barraca. Apenas comandas autorizadas podem ser encaminhadas; pedido repetido não cria outra comanda. Comandas enviadas/incertas não são reenviadas automaticamente. Mudança de central só permite retarget de trabalhos ainda queued. A reserva privada continua exigida para concluir o envio.

A central precisa de internet, aba em primeiro plano e aparelho ligado; não é uma implementação offline nem um serviço Android em segundo plano. `sent` continua significando envio ao transporte, não comprovação física do papel. Os dados de acesso permanecem no servidor/headers, sem segredos em URLs públicas ou aplicativos terceiros.

## Verificação histórica da central

74 testes passaram, incluindo o handler real da API com banco simulado: escopo dos funcionários, central única, expiração, CAS, solicitação repetida, heartbeat durante impressão, liberação atrasada, reserva privada e segunda via. A interface foi revisada em 390 e 320 px; uma simulação local de iPhone sem APIs enviou `relay` sem solicitar Bluetooth local. Nenhum teste acionou hardware ou instalou aplicativos. A TC-163 física e os navegadores reais dos aparelhos continuam exigindo validação no local.

## Revisão de código de 28/10/2026

Corrigido timeout Serial: uma escrita pendente não continua enviando os próximos blocos após o timeout; o lock permanece até a escrita terminar, a conexão antiga é fechada após liberação e a falha invalida o teste local. Isso reduz risco de comanda parcial/duplicada, sem prometer cancelamento dos bytes que já chegaram ao hardware. Novo relatório copiável de compatibilidade contém somente APIs/contexto e teste confirmado; não inclui links de funcionário, tokens, pedidos ou o user-agent bruto. A orientação iOS agora preserva a exigência de impressora portátil, sem apresentar cozinha como correção desse fluxo.
