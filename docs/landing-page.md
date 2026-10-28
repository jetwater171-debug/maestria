# Landing page Maestria Beach

A página pública fica em `/`; o sistema fica em `/painel` e o cadastro em
`/painel?cadastro=1`. Links antigos com `#access` são encaminhados ao painel
preservando o fragmento. Login e recuperação de senha levam ao painel.
O service worker guarda o painel para uso offline, incluindo o fallback
para favoritos antigos da raiz. Não guarda respostas de APIs.

Conteúdo baseado nas funções existentes: mesas, pedidos e observações,
cozinha, aviso de pronto, consumo, divisão e pagamentos parciais, serviço,
descontos, resumo do dia, estoque, equipe, cardápio por IA e fila offline.
A impressão é descrita como dependente do equipamento e conexão.
Sem depoimentos, métricas de clientes, preços ou garantias de resultados inventados.
A demonstração é local e sinalizada como fictícia; não envia pedidos reais.

## Assinatura e preparação para venda

A seção `#assinatura` apresenta uma oferta única Maestria Beach com os recursos
existentes de mesas, pedidos, cozinha, caixa, cardápio, estoque, equipe, resumo
e fila offline. O preço permanece **Sob consulta**, pois o valor e as condições
comerciais ainda não foram definidos. Não há planos fictícios, limites de uso
inventados, promessa de teste grátis com prazo ou checkout de assinatura.

O botão “Criar conta e conhecer” usa o cadastro real em
`/painel?cadastro=1`. Ele não ativa uma mensalidade nem cobra automaticamente.
O plano, vencimento e valor continuam configuráveis no painel administrativo.

Ao lado da oferta, os primeiros passos explicam cadastro da operação, acesso
da equipe e teste do fluxo completo. A impressão portátil tem um aviso próprio:
validar o conjunto exato de celular e impressora, com papel saindo, antes de
contratar para esse uso. O texto não promete compatibilidade com toda TC-163,
todo Android, Safari ou toda impressora Bluetooth. A FAQ explica a possibilidade
de aplicativo auxiliar e toque extra, preservando a impressora com o garçom.

O cabeçalho inclui o acesso à assinatura em desktop e celular. As oito dúvidas
cobrem equipamento, equipe, cardápio, internet, impressão, pagamento, configuração
e assinatura. Os pagamentos registrados no caixa são diferenciados da cobrança
do SaaS; o produto não é anunciado como gateway nem emissor fiscal.

## Imagem

Ferramenta nativa de geração de imagens, arquivo otimizado em
`public/images/maestria-praia.webp` (1536 × 1024). A cena é ilustrativa,
gerada para a marca, e não representa uma barraca cliente.

Prompt utilizado:

> Create a photorealistic premium editorial travel photograph for a Brazilian beach restaurant software website. Wide landscape 3:2 image. Elevated slightly overhead diagonal view of a beautiful Brazilian beach kiosk seating area, warm pale sand, three natural ivory canvas beach umbrellas and simple wooden tables, a few understated navy blue cushions. Turquoise ocean with foamy surf in the upper third and natural rich teal gradients. One palm frond enters from upper right foreground, subtle elegant shadows on sunlit sand. Warm late morning natural sunlight, analog film aesthetic, fine natural grain, sophisticated travel magazine photography, real textures, restrained colors, peaceful organized scene with spacious composition. No text, no logo, no watermarks, no people, no buildings, no screens or devices. The bottom center foreground should have mostly clear warm sand to allow website interface overlays. Not an illustration or 3D render.


## Refinamento editorial e desempenho

- Abertura centralizada “Praia cheia. Operação leve.”, panorama da praia e demonstração em três etapas.
- Seis benefícios agrupam a operação; botões maiores e textos mais legíveis em telas pequenas.
- A versão compacta não usa CTA fixo nem menu expansível: o cabeçalho oferece Entrar e a abertura oferece o cadastro e a demonstração.
- Links para o painel usam `prefetch={false}`: a página comercial não antecipa o download da aplicação operacional.
- Animações usam transform/opacity e IntersectionObserver, sem bibliotecas de animação ou handlers de scroll. O scanner pausa fora da tela. Reduced motion e economia de dados desativam efeitos.
- A foto original foi redimensionada para 1280 × 853 e comprimida em WebP (`public/images/maestria-praia-light.webp`, 141.068 bytes). Next Image entrega tamanhos adaptados à tela. O original continua preservado.
- Não há promessa de desempenho em todo aparelho; verificar carregamento e interações em aparelhos reais conforme a base de clientes crescer.


## Versão compacta

A base compacta usa abertura, benefícios, demonstração e cadastro, com a oferta
de assinatura e dúvidas completas acrescentadas para a venda. Foram mantidos
os benefícios antes da demonstração e removidas seções redundantes. A medida
anterior de 3.481 px de altura pertencia à versão com apenas três dúvidas,
antes da seção de assinatura; não descreve a versão atual.
