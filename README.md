# Pastinha

Monte dossiês juntando PDFs e fotos num só lugar: organize arrastando, edite uma página e baixe no formato que precisar.

**Acesse:** https://lucascst79.github.io/pastinha/

Tudo roda no navegador de quem usa. Nenhum documento é enviado para servidor nenhum.

## O que dá para fazer

- **Juntar PDFs e imagens** (JPG, PNG, WEBP e HEIC do iPhone) arrastando para a tela, escolhendo os arquivos ou colando um print com `Ctrl+V`.
- **Conferir em tela cheia**, passando as páginas com as setas.
- **Organizar arrastando:** ver página por página ou por arquivo, e mover um documento inteiro de uma vez.
- **Girar, duplicar e excluir** páginas, uma de cada vez ou várias selecionadas.
- **Editar uma página:** recortar, girar, escrever, desenhar, marcar texto, cobrir com tarja e ajustar brilho e contraste (inclui o modo "Documento escaneado").
- **Baixar em 5 formatos:**
  - PDF único;
  - um PDF por documento;
  - um PDF por página;
  - imagens JPG;
  - imagens PNG.

  Quando são vários arquivos, eles chegam juntos num `.zip`.
- **3 qualidades:** Máxima (igual ao original), Equilibrada (recomendada) e Compacta (menor tamanho).
- **Nome do arquivo** definido antes de baixar.

## Atalhos

| Ação | Atalho |
| --- | --- |
| Selecionar várias páginas | `Shift` + clique |
| Abrir o editor da página | duplo clique |
| Ver em tela cheia / fechar | `Espaço` |
| Passar as páginas na tela cheia | `←` `→` |
| Excluir selecionadas | `Delete` |
| Desfazer / refazer | `Ctrl+Z` / `Ctrl+Y` |
| Selecionar tudo | `Ctrl+A` |
| Colar imagem | `Ctrl+V` |

## Instalar como app

No Chrome ou no Edge, clique em **Instalar app** no topo da página (ou no ícone de instalar na barra de endereço). A Pastinha ganha um ícone próprio, abre como programa e **funciona sem internet**. No Windows, dá para clicar com o botão direito num PDF ou foto e escolher **Abrir com › Pastinha**.

No celular: Android (Chrome) › menu ⋮ › **Instalar app**; iPhone (Safari) › Compartilhar › **Adicionar à Tela de Início**.

## Como atualizar o site

O site é publicado pelo GitHub Pages a partir da branch `main`. Qualquer alteração enviada para a `main` entra no ar sozinha em cerca de 1 minuto. Quem tem o app instalado recebe a versão nova ao abrir com internet.

## Testes

Os testes usam navegadores de verdade (Chrome, Edge, Firefox, Safari/WebKit e celular) e simulam uma pessoa usando a ferramenta: arrastar páginas, editar, baixar em todos os formatos, trabalhar sem internet etc.

```bash
npm install
npx playwright install
npm test               # todos os testes
npm run test:stress    # dossiê grande: 60 fotos de 12 MP
npm start              # abre a Pastinha em http://localhost:4173
```

Os testes também rodam sozinhos no GitHub a cada alteração (aba **Actions**).

## Observações

- O site não aparece em buscadores (marcado como `noindex`).
- As bibliotecas (pdf-lib, pdf.js, SortableJS, JSZip e heic2any) ficam na pasta `vendor/`, sem depender de outros sites. Os documentos ficam no computador de quem usa.
- Páginas editadas são salvas como imagem em alta resolução, então o texto delas deixa de ser selecionável.
- Fotos HEIC de iPhone são convertidas para JPG automaticamente.
- PDFs com assinatura digital perdem a assinatura ao serem juntados, como em qualquer ferramenta desse tipo.
