# Impressora portátil no iPhone e iPad

Revisado em 28/10/2026. O objetivo é cada garçom imprimir na TC-163 que leva consigo. Essa unidade ainda não foi homologada fisicamente no iPhone. A caixa/manual recuperados mencionam iPhone, mas não identificam o transporte GATT/SDK; o autoteste informa JK-5801P, KPrinter_523c, BT e USB. Isso não permite afirmar nem excluir BLE.

## Caminho direto a verificar

1. Carregue a impressora, coloque papel e desconecte de outros aparelhos/apps.
2. Abra o Maestria por HTTPS no [Bluefy](https://apps.apple.com/app/id1492822055), que oferece Web Bluetooth BLE; permita Bluetooth.
3. Use o acesso individual do garçom. A configuração oferece copiar esse acesso para abrir no Bluefy, sem colocar credenciais Supabase no link.
4. Configurar impressora → Buscar impressora BLE. Se a unidade aparecer e o canal for identificado, envie o teste e confirme **somente após ver o texto no papel**.
5. Com o dono tendo escolhido impressão com o garçom, toque Enviar e imprimir. A comanda é reservada e enviada depois de o pedido ser salvo; cada funcionário tem a própria fila.
6. Mantenha o site aberto e a tela ativa durante o envio. Tela bloqueada, segundo plano e bateria precisam de teste real; não há garantia de serviço web em segundo plano.

Se não aparecer no seletor, confira permissões, energia e conexões concorrentes. Um scanner BLE pode ajudar a identificar serviço/canal; o painel avançado aceita UUIDs confirmados pelo fabricante. Ausência no primeiro scan, sozinha, não prova que o hardware é Classic.

O transporte autoriza perfis ISSC UART, FF00/FF02, FFE0/FFE1 e 18F0/2AF1; somente canais de escrita reconhecidos recebem comandos. O diagnóstico mostra serviços autorizados, não todos os serviços existentes. Um perfil encontrado ainda precisa aceitar ESC/POS e passar no papel. Blocos de 20 bytes e intervalo de 50 ms evitam depender de um MTU maior; limite de envio de 40 segundos.

## Safari, apps e Classic

Safari comum e o ícone PWA não devem ser tratados como navegadores com BLE/Serial. O site verifica as APIs reais. A [extensão beacio](https://apps.apple.com/br/app/beacio/id6761301368) é alternativa experimental para **BLE**, com app/extensão e iOS 26.2+ na versão consultada. Não adiciona Bluetooth ao PWA nem transforma SPP em GATT.

Se a unidade tiver apenas Classic SPP sem integração iOS compatível, instalar um navegador BLE não resolve. O suporte nativo [Core Bluetooth Classic da Apple](https://developer.apple.com/videos/play/wwdc2019/901/) usa GATT sobre BR/EDR; não oferece uma porta RFCOMM genérica ao JavaScript do Safari. Obter SDK do fabricante ou validar outro transporte/hardware é necessário antes de vender essa compatibilidade.

[AirPrint](https://support.apple.com/pt-br/109349) depende de impressora compatível na mesma rede e abre o diálogo do sistema. BT/USB no autoteste da TC-163 não comprova AirPrint. [Star webPRNT](https://www.star-m.jp/products/s_print/sdk/webprnt/manual/en/_sampleProgram.htm) é um caminho comercial para modelos Star suportados, não driver genérico desta impressora.

Server for RawBT é um serviço Android. Usá-lo a partir de iPhone exigiria uma ponte/aparelho adicional e rede; não resolve o iPhone sozinho. Uma central na cozinha não satisfaz a exigência da impressora portátil individual.

## Conferência e suporte

Falhas de escrita e confirmação perdida ficam incertas; não repetir automaticamente. `sent` é envio ao transporte, não prova de papel. Depois de desconectar/reconectar, o teste precisa ser confirmado novamente.

O botão Copiar compatibilidade para o suporte informa contexto seguro, APIs disponíveis, conexão e teste confirmado, sem incluir tokens, links de funcionário ou pedidos. A [pesquisa comparativa](./printing-research.md) registra opções, fontes e roteiro de homologação Android/iPhone.
