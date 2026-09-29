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

## Imagem

Ferramenta nativa de geração de imagens, arquivo otimizado em
`public/images/maestria-praia.webp` (1536 × 1024). A cena é ilustrativa,
gerada para a marca, e não representa uma barraca cliente.

Prompt utilizado:

> Create a photorealistic premium editorial travel photograph for a Brazilian beach restaurant software website. Wide landscape 3:2 image. Elevated slightly overhead diagonal view of a beautiful Brazilian beach kiosk seating area, warm pale sand, three natural ivory canvas beach umbrellas and simple wooden tables, a few understated navy blue cushions. Turquoise ocean with foamy surf in the upper third and natural rich teal gradients. One palm frond enters from upper right foreground, subtle elegant shadows on sunlit sand. Warm late morning natural sunlight, analog film aesthetic, fine natural grain, sophisticated travel magazine photography, real textures, restrained colors, peaceful organized scene with spacious composition. No text, no logo, no watermarks, no people, no buildings, no screens or devices. The bottom center foreground should have mostly clear warm sand to allow website interface overlays. Not an illustration or 3D render.
