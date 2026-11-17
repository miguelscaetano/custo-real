# Política de privacidade — Custo Real

Última atualização: 17 de novembro de 2026.

## Resumo

A extensão **Custo Real** não recolhe, não guarda fora do teu browser e não envia a ninguém dados pessoais, histórico de navegação ou os anúncios que vês. Não tem servidores próprios nem ferramentas de análise ou publicidade.

## O que fica guardado, e onde

- **As tuas opções** (quilómetros por mês, consumos, preços, distrito escolhido) ficam no teu perfil do browser, em `chrome.storage.sync`. Se tiveres a sincronização do Chrome ligada, o Chrome pode sincronizá-las entre os teus dispositivos, como faz com outras extensões.
- **Os preços médios dos combustíveis** e a data da última atualização ficam em `chrome.storage.local`, apenas neste computador.
- **Se o painel está minimizado** fica em `chrome.storage.local`.

Nada disto sai do teu browser, exceto o que a sincronização do Chrome fizer com as opções.

## Pedidos de rede

A extensão só faz pedidos a dois sites:

1. **standvirtual.com**: a extensão corre nas páginas de anúncios e lê os dados do anúncio que estás a ver. Quando o site muda de anúncio sem recarregar a página, pede o HTML desse mesmo anúncio ao Standvirtual para ler os dados dele. Estes dados são usados só para calcular as estimativas no teu ecrã.
2. **precoscombustiveis.dgeg.gov.pt** (DGEG): para obter a média dos preços dos combustíveis. O pedido é feito no máximo de 12 em 12 horas e quando mudas o distrito. Leva o tipo de combustível e o distrito que escolheste nas opções, e nada sobre os anúncios que vês. Como em qualquer pedido na internet, a DGEG recebe o teu endereço IP. No modo manual este pedido não é feito.

A extensão não envia nada para outros endereços.

## Permissões

- `storage`: guardar as tuas opções e os preços em cache.
- Acesso a `https://www.standvirtual.com/*`: mostrar o painel e ler os dados do anúncio.
- Acesso a `https://precoscombustiveis.dgeg.gov.pt/*`: obter os preços médios dos combustíveis.

## Código remoto

A extensão não carrega nem executa código de fora. Todo o código está dentro do pacote instalado.

## Partilha com terceiros

Não partilho dados com terceiros, não vendo dados e não uso dados para publicidade, porque a extensão não os recolhe.

## Contacto

Dúvidas ou pedidos: abre uma _issue_ no repositório do projeto no GitHub.
