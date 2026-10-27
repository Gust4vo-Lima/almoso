# Almoso

Aplicação React client-side para distribuir horários de almoço a partir de uma planilha semanal de triagem. A planilha é lida no navegador e não é enviada a nenhum servidor; somente as configurações da equipe ficam no `localStorage`.

## Executar

Requer Node.js 20.19+ ou 22.12+ e npm.

```bash
npm install
npm run dev
```

O Vite informa o endereço local no terminal. Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## GitHub Pages

O workflow em `.github/workflows/pages.yml` publica automaticamente após cada push para `main`. No repositório, configure **Settings → Pages → Source: GitHub Actions**. Para o remoto `Gust4vo-Lima/almoso`, o endereço esperado é `https://gust4vo-lima.github.io/almoso/`.

## Planilha

Carregue um arquivo `.xlsx`. A primeira linha deve conter os dias a partir da segunda coluna; a primeira coluna deve conter os horários de triagem separados por uma hora (por exemplo, `09:00`, `10:00`, `11:00`). Os nomes nas células precisam corresponder aos nomes cadastrados. A primeira aba da pasta de trabalho é utilizada.

Cada aparição de um analista bloqueia uma hora inteira de triagem. Os almoços são distribuídos dentro da janela configurada em incrementos de 15 minutos, respeitando esses bloqueios. O algoritmo prioriza blocos sem sobreposição entre almoços. Se não existir um bloco livre em relação à triagem, a célula informa que não foi possível agendar; sobreposição entre almoços é permitida como último recurso e sinalizada.

## Privacidade e configurações

As preferências da equipe e da janela ficam em `localStorage`. Importar ou exportar configurações usa um arquivo JSON local. Os dados da planilha permanecem apenas em memória durante a sessão.

O sistema identifica a tabela da semana atual pela sequência de datas dos cabeçalhos. Colunas anteriores escondidas à direita e tabelas posteriores na mesma planilha não participam da escala atual. “Escala Lia” e qualquer outro texto de controle são ignorados quando não correspondem aos analistas cadastrados.

O arquivo real deve manter a coluna A vazia, os intervalos em B no formato `07:00 - 08:00`, e os dias da semana visíveis nas colunas seguintes. Somente a primeira aba é lida. Colunas anteriores escondidas e outras abas/tabelas não entram na escala.