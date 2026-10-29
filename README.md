# Pastinha

Monte dossiês juntando PDFs e fotos num só lugar: organize arrastando, edite uma página e baixe no formato que precisar.

**Acesse:** https://lucascst79.github.io/pastinha/

Tudo roda no navegador de quem usa. Nenhum documento é enviado para servidor nenhum.

## O que dá para fazer

- **Juntar PDFs e imagens** (JPG, PNG, WEBP) arrastando para a tela, escolhendo os arquivos ou colando um print com `Ctrl+V`.
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
| Excluir selecionadas | `Delete` |
| Desfazer / refazer | `Ctrl+Z` / `Ctrl+Y` |
| Selecionar tudo | `Ctrl+A` |
| Colar imagem | `Ctrl+V` |

## Como atualizar o site

O site é publicado pelo GitHub Pages a partir da branch `main`. Qualquer alteração enviada para a `main` entra no ar sozinha em cerca de 1 minuto.

## Observações

- O site não aparece em buscadores (marcado como `noindex`).
- Precisa de internet só para carregar as bibliotecas (pdf-lib, pdf.js, SortableJS e JSZip). Os documentos ficam no computador de quem usa.
- Páginas editadas são salvas como imagem em alta resolução, então o texto delas deixa de ser selecionável.
- Fotos HEIC de iPhone não abrem no Chrome nem no Edge; envie em JPG.
- PDFs com assinatura digital perdem a assinatura ao serem juntados, como em qualquer ferramenta desse tipo.
