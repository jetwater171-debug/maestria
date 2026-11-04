# Impressão portátil: pesquisa de 04/11/2026

Escopo: cada garçom leva a própria TC-163 / JK-5801P / KPrinter_523c e usa Android ou iPhone. O proprietário descartou RawBT nesta revisão; ele não integra a recomendação. A impressora física não está disponível nesta sessão. Nenhuma fonte externa foi executada ou aplicativo instalado; foram lidos documentação, código e metadados públicos.

Condição final confirmada pelo proprietário: **TC-163 sem adaptador e sem troca de impressora**. As arquiteturas com ESP32 e outros equipamentos abaixo são comparação de pesquisa; estão excluídas da implementação autorizada. O caminho aplicado é a conexão direta, condicionado aos transportes que esta unidade realmente oferece.

## Decisão implementável

Há duas arquiteturas que preservam o papel com o garçom:

1. **Conexão do celular à impressora**, sem aparelho extra: Web Serial SPP no Android compatível e Web Bluetooth no Bluefy ou Safari com extensão no iPhone, desde que a TC-163 ofereça BLE/GATT de impressão. A hipótese BLE ainda precisa ser medida na unidade real. Um app próprio melhora a conexão/diagnóstico, mas continua dependendo de BLE ou integração iOS do fabricante.
2. **Adaptador portátil individual**, caso a TC-163 seja somente SPP: um ESP32 original liga por Bluetooth à impressora e consulta a fila HTTPS do próprio garçom. Android/Safari/iPhone/tablet salvam o pedido normalmente; o adaptador transportado junto da impressora envia a comanda. Exige placa, alimentação, rede e firmware próprio homologado. Não há central na cozinha nem computador fixo nessa arquitetura.

Não foi encontrada nesta busca uma biblioteca capaz de dar RFCOMM/SPP genérico ao JavaScript do Safari. Se a unidade for SPP-only e não puder haver aplicativo compatível do fabricante, adaptador ou troca de hardware, os requisitos entram em conflito. Isso é um limite de transporte ainda a resolver com evidência física, não um erro de layout.

## Evidência específica da TC-163

Foram procurados os identificadores completos e variantes JK-5801P, JK5801, KPrinter_, KPrinter_523c, HAVENDO.L e TC-163 em busca web, GitHub e fornecedores. Resultados públicos do modelo continuam concentrados em anúncios. Não se localizou SDK, página de suporte do fabricante ou manual técnico que relacione esta unidade a serviço GATT, MFi ou app iOS identificável.

As fotos já fornecidas pelo proprietário têm valor maior para identificar a unidade: o autoteste mostra BT e USB; o manual genérico menciona Android/iPhone e senha 0000, sem UUID ou aplicativo. Isso **não confirma que seja somente SPP**, nem prova BLE. Anúncios semelhantes falando Bluetooth 4.0/iPad também não identificam o firmware do lote comprado. Não inferir uma capacidade a partir de carcaça ou nome comercial.

## Fontes novas, código e licença

| Fonte primária | Constatação verificável | Uso possível / limite |
| --- | --- | --- |
| [CapacitorThermalPrinter](https://github.com/kevinfavv/CapacitorThermalPrinter), branch 8.x, atualização consultada 30/10/2026 | MIT; código Kotlin/Swift; distingue SPP Android, BLE iOS, TCP e SDKs de marcas. Documenta teste do autor em BLE genérico e modelos Epson/Star. | Base candidata para app próprio. Não comprova JK-5801P. Dependências/SDKs vendor têm condições separadas. |
| [BleTransport.swift](https://github.com/kevinfavv/CapacitorThermalPrinter/blob/8.x/ios/Plugin/Transport/BleTransport.swift) | Lista canais preferidos, serviços de descoberta e canais de controle. Comentários relatam FEE7 anunciando presença enquanto FF00 só aparece após conexão em outro modelo. | Melhorar diagnóstico de descoberta. FEE7 e canais de controle não devem receber ESC/POS. |
| [expo-thermal-printer](https://github.com/Ricka7x/expo-thermal-printer) e [gerenciador iOS](https://github.com/Ricka7x/expo-thermal-printer/blob/main/ios/BlePrinterManager.swift) | MIT; Android SPP e iOS CoreBluetooth. Procura 18F0/2AF1, ISSC, E7810A71/BEF8D6C9, FF00/FF02 e FFE0/FFE1. | App/diagnóstico nativo candidato. O fallback para qualquer característica gravável não deve ser copiado para equipamento desconhecido. |
| [NiimBLE](https://github.com/gokhanarel/NiimBLE) | NIIMBOT B1 usa E7810A71/BEF8D6C9 com protocolo de etiquetas próprio. | Contraexemplo: reconhecer esse UUID não autoriza presumir ESC/POS. |
| [beacio, App Store](https://apps.apple.com/br/app/beacio/id6761301368), [SDK](https://github.com/wklm/beacio-sdk), [licença core](https://github.com/wklm/beacio-sdk/blob/main/packages/core/LICENSE) | App/extensão Safari para BLE; loja consultada exige iOS 26.2+. Core SDK MIT. | Alternativa à troca de navegador em iPhone compatível. Depende de BLE na impressora; extensão não aparece no ícone PWA. A licença do SDK não transforma o app em código aberto. |
| [MobiWeb Bluetooth Direct Printing](https://mobiweb.dwigoric.dev/bridges-bluetooth-printing) | Bridge nativa documentada: AndroidBluetoothPrint, AppleBluetoothPrint; iOS BLE, Android SPP/BLE. Oferece printRaw(base64), eventos e getDeviceServices. | Integração de site dentro do app, sem serviço remoto de impressão. Não se encontrou repositório/licença do app nesta busca; não tratar como base aberta nem como suporte confirmado à TC-163. |
| [android-printer-kit](https://github.com/DeveloperRejaul/android-printer-kit) | Apache-2.0; BluetoothSocket SPP e serviço Android em primeiro plano. | Base candidata para companion próprio Android, sem RawBT. É biblioteca nativa, não módulo que rode dentro do Chrome. Não inclui suporte iOS. |
| [evankoza/receipt-printer](https://github.com/evankoza/receipt-printer) | Firmware ESP32 WROOM cliente SPP para MPT-II ESC/POS, recebendo fila por conexão de saída com servidor. Código distingue chunks e heartbeat. Não há licença detectada no repositório consultado. | Evidência de arquitetura, não código para copiar/distribuir. MPT-II não comprova JK-5801P. |
| [Espressif SPP API](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/bluetooth/esp_spp.html), [exemplo cliente Arduino](https://github.com/espressif/arduino-esp32/blob/master/libraries/BluetoothSerial/examples/SerialToSerialBTM/SerialToSerialBTM.ino) | API de cliente/servidor SPP. Exemplo declara domínio público/CC0 e modo master. [ESP-IDF](https://github.com/espressif/esp-idf/blob/master/LICENSE) tem licença Apache-2.0, com componentes sujeitos aos próprios avisos. | Fundamento para firmware próprio. Para esse caminho escolher ESP32 original com Classic; não presumir que S3/C3/C6 ofereçam SPP. |

O [Sensat10on/PrintBridge](https://github.com/Sensat10on/PrintBridge) também foi inspecionado: README declara impressoras físicas ainda não verificadas, versão gratuita com marca d'água e licença de código não identificada no inventário. Não é uma solução de produção comprovada a substituir uma homologação real.

## Como eliminar a dúvida BLE sem adivinhar UUID

[nRF Connect for Mobile, do fabricante Nordic](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-mobile), descobre anúncios, serviços e características BLE. [LightBlue, do fabricante Punch Through](https://punchthrough.com/lightblue/), está disponível em iOS/Android e serve para a mesma investigação. A [FAQ da Espressif](https://docs.espressif.com/projects/esp-faq/en/latest/software-framework/bt/ble.html) recomenda scanner dedicado e explica que a tela Bluetooth de ajustes do iPhone pode não mostrar anúncios BLE.

Teste mínimo quando houver a TC-163: impressora carregada e livre de outra conexão; scan BLE no iPhone; selecionar a unidade pelo nome/sinal físico; descobrir todos os serviços; registrar UUID do serviço, característica gravável e propriedades de escrita/notificação. Não enviar bytes a canais aleatórios. Primeiro confirmar canal ESC/POS por documentação ou protocolo conhecido e fazer uma comanda curta. Depois testar duas comandas, desligamento, desconexão e falta de papel.

Um scanner nativo pode descobrir todos os serviços da conexão. A descoberta web permanece limitada aos serviços autorizados pelo navegador; por isso um erro na lista optionalServices não basta para afirmar que a impressora não tem BLE. Se só houver SPP detectável em Android, isso é evidência adicional, mas ainda se deve conferir variante/firmware com o fornecedor.

## App próprio: o que resolveria

Um shell Capacitor/Expo pode manter a interface do sistema e expor transporte nativo validado. No Android ele usa SPP diretamente; no iPhone usa BLE ou SDK compatível do fabricante. Exige build/distribuição, permissões e teste em celulares. Um app nativo não converte uma TC-163 SPP-only em acessório BLE.

Para Android com navegador normal, um companion próprio pode consultar a fila HTTPS individual por serviço em primeiro plano e escrever por SPP. Assim não há salto para aplicativo por comanda. O Android ainda controla bateria e ciclo do serviço; isso requer teste. O equivalente de polling contínuo em segundo plano no iOS não deve ser prometido sem uma arquitetura suportada pelo sistema.

## Adaptador portátil: especificação inicial implementável

Fluxo: navegador salva pedido → servidor cria comanda do funcionário → adaptador individual consulta por HTTPS → reserva a comanda → envia ESC/POS por SPP à TC-163 → informa resultado do transporte. A ligação de saída por HTTPS evita exigir que Safari acesse endereço local ou WebSocket inseguro.

O adaptador precisa de vínculo exclusivo à barraca, funcionário e impressora. O pareamento deve ser aprovado pelo dono, com credencial revogável limitada a imprimir aquela fila; não gravar uma chave Supabase privilegiada nem acesso administrativo na placa. Selecionar o endereço da impressora correta, sem conectar automaticamente à primeira impressora com nome semelhante.

Firmware próprio precisa serializar trabalhos, respeitar congestionamento SPP, manter heartbeat durante escrita, verificar TLS, registrar ID de envio antes de escrever e marcar como incerto após reinicialização ou resposta perdida. Não repetir automaticamente um trabalho que pode ter saído. O backend deve impedir que duas pontes reservem a mesma comanda. Resultado do socket é envio ao transporte; confirmação física só se vier de protocolo de estado homologado ou conferência humana.

Hardware mínimo a testar: ESP32 original com Classic, alimentação portátil própria, caixa e Wi-Fi/hotspot com internet. A porta de carga USB da TC-163 não foi comprovada como saída de energia; não presumir que alimente a placa. Wi-Fi+Bluetooth compartilham recursos, então alcance, bateria e desempenho andando na praia exigem ensaio real. Uma conversão SPP→BLE local é alternativa de firmware, porém também exige placa e teste de coexistência; ela não habilita BLE dentro do Safari comum.

## Relatos usados como pistas, sem tratá-los como homologação

- [Reddit: ESP32-S3 com impressora BLE de fotos](https://www.reddit.com/r/esp32/comments/1wg6jp7/i_turned_a_bluetooth_cat_printer_into_a_wifi/): exemplo de ponte, mas S3→BLE e protocolo de outra impressora, sem firmware publicado no relato. Não serve como prova de SPP/TC-163.
- [Reddit: impressão ESC/POS por WebView Android](https://www.reddit.com/r/indotech/comments/1rjj22z/escpos_print_direct_dari_web/): ajuda a reconhecer que impressão anunciada como web pode depender de app nativo por trás.
- [Reddit: terminal SPP Android e ESP32](https://www.reddit.com/r/esp32/comments/1vzp0n8/i_built_an_android_bluetooth_classic_spp_terminal/): pista para distinguir ESP32 original de variantes BLE-only; a decisão técnica usa a documentação Espressif.

## Pendência física exata

Falta **uma sessão com a unidade real e um iPhone**, descobrindo os serviços e imprimindo. Se houver BLE ESC/POS, o caminho direto existente pode ser completado com o perfil correto. Se for SPP-only, falta escolher e testar um adaptador portátil ou equipamento com transporte iOS comprovado. Sem essa sessão, pesquisa e testes simulados não podem ser chamados de impressão funcionando em todos os celulares.
