# Textos para a Chrome Web Store

Não vai dentro do zip da extensão, serve só para copiar para o painel da loja.

## Separador "Store listing"

**Nome**: Custo Real

**Resumo (máx. 132 caracteres)**: Mostra o IUC anual e o custo mensal de combustível estimados nos anúncios de carros do Standvirtual.

**Categoria**: Shopping

**Idioma**: Português (Portugal)

**Descrição detalhada**

Quem compra um carro usado olha para o preço, mas o custo verdadeiro inclui o imposto todos os anos e o combustível todos os meses. O Custo Real faz essas contas por ti, na própria página do anúncio do Standvirtual.

O que mostra:
• IUC anual estimado, com as parcelas do cálculo (cilindrada, CO₂, coeficiente do ano e adicional do gasóleo)
• Custo mensal de combustível, a partir do consumo do anúncio (ou de um consumo por defeito), dos quilómetros por mês e do preço do combustível
• Preços médios dos combustíveis da DGEG, por distrito, atualizados automaticamente (também podes escrever os teus)
• Quando falta um dado, o painel diz qual é em vez de inventar um valor. Se faltar o CO₂, mostra o intervalo possível e deixa-te escrevê-lo

Também funciona nos anúncios de comerciais: calcula o combustível e mostra o IUC que o anunciante indicar.

Tudo são estimativas e aparecem com ≈. As tabelas do IUC são as de 2026 e não substituem o simulador do Portal das Finanças.

Privacidade: não recolhe dados, não tem análises nem servidores próprios. As opções ficam no teu browser. O único pedido externo, além do Standvirtual, é à DGEG, para ler os preços dos combustíveis.

Código aberto no GitHub.

**Descrição curta em inglês (se quiseres adicionar o idioma)**

Shows an estimate of the yearly Portuguese road tax (IUC) and the monthly fuel cost on car ads at Standvirtual. No data collection, no analytics, no servers of its own.

## Separador "Privacy practices"

**Single purpose (finalidade única)**

Mostrar, nos anúncios de carros do Standvirtual, uma estimativa do IUC anual e do custo mensal de combustível.

**Justificação das permissões**

- `storage`: guarda as opções do utilizador (quilómetros por mês, consumos, preços, distrito) e, em cache, os preços médios dos combustíveis.
- Acesso a `https://www.standvirtual.com/*`: o content script corre nas páginas de anúncios, lê os dados do anúncio (combustível, cilindrada, ano, CO₂, consumo) e mostra o painel com as estimativas. Quando o site muda de anúncio sem recarregar a página, pede o HTML desse anúncio ao próprio Standvirtual.
- Acesso a `https://precoscombustiveis.dgeg.gov.pt/*`: o service worker lê os preços dos postos no portal oficial da DGEG para calcular a média por distrito. O pedido não leva dados do utilizador nem dos anúncios.

**Código remoto**: Não. Todo o código está no pacote.

**Uso de dados (Data usage)**: não marcar nenhuma categoria, porque a extensão não recolhe dados do utilizador. Certificar as três declarações no fim (não vende dados, não os usa para fins sem relação com a finalidade única, não os usa para avaliar crédito).

**Política de privacidade (URL)**: endereço público do `PRIVACY.md` no GitHub, por exemplo `https://github.com/<utilizador>/<repositório>/blob/main/PRIVACY.md`.

## Instruções para o revisor (campo opcional de testes)

A extensão só muda a página dos anúncios de https://www.standvirtual.com (por exemplo, um anúncio em /carros/anuncio/...). Abre um anúncio e aparece um painel "Custo Real" no canto inferior direito. Clicar no ícone da extensão abre as opções, onde se escolhe o distrito e se pode carregar em "Atualizar agora" para ler os preços da DGEG. Não é preciso conta nem iniciar sessão.

## Imagens

| Imagem | Tamanho | Ficheiro |
| --- | --- | --- |
| Ícone da loja | 128×128 | `icons/icon128.png` |
| Mosaico promocional pequeno | 440×280 | `store/assets/promo-440x280.png` |
| Capturas de ecrã (1 a 5) | 1280×800 | as tuas, em anúncios reais |
