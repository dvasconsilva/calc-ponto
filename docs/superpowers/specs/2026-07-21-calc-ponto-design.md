# Calc Ponto Local

## Objetivo

Criar um utilitário local e independente em `calc-ponto/` para calcular rapidamente:

- horas já trabalhadas no dia;
- horas faltantes para completar `8:00` líquidas;
- hora exata em que a meta de `8:00` é atingida, quando ela puder ser determinada;
- saldo excedente quando o total ultrapassar `8:00`;
- horário final necessário para completar `8:00` quando a volta do segundo período estiver disponível.

O uso principal será por colagem direta (`Ctrl+V`) dos registros copiados do sistema de ponto atual.

## Escopo

### Incluído

- página única em HTML, CSS e JavaScript puro;
- execução local, sem backend;
- suporte a colagem de uma única linha ou de múltiplas linhas;
- suporte a preenchimento manual de um único dia com `4` campos dedicados;
- parser tolerante a tab, múltiplos espaços e texto adicional na linha;
- cálculo automático por linha;
- cálculo automático no formulário manual;
- resumo consolidado no topo;
- tabela com resultado detalhado por linha;
- ações de `Limpar`, `Carregar exemplo` e `Copiar resultado`.

### Fora de escopo

- integração com o sistema de ponto existente;
- persistência em banco, histórico salvo ou login;
- regras semanais, quinzenais ou banco de horas;
- exportação em PDF, Excel ou impressão;
- edição avançada de jornada com múltiplos intervalos além das 4 marcações esperadas.

## Público e contexto de uso

A ferramenta é voltada para uso pessoal/local, com foco em velocidade. O fluxo esperado é:

1. copiar os registros de ponto do sistema atual;
2. colar no campo principal da calculadora;
3. visualizar imediatamente horas trabalhadas, faltantes, extras e a hora de conclusão da meta quando aplicável;
4. opcionalmente preencher manualmente um dia quando não houver colagem disponível ou quando faltar informar a volta do almoço.

## Arquitetura proposta

Estrutura simples e isolada:

- `index.html`
- `styles.css`
- `script.js`

### Responsabilidades

`index.html`

- estrutura da página;
- área de colagem;
- formulário manual de um dia;
- resumo consolidado;
- tabela de resultados;
- botões de ação.

`styles.css`

- identidade visual da página;
- layout responsivo;
- estados visuais de sucesso, atenção e erro;
- legibilidade para uso recorrente em desktop e mobile.

`script.js`

- captura de eventos de colagem e digitação;
- leitura e validação dos campos manuais;
- extração e validação dos horários;
- cálculo dos totais;
- cálculo da hora exata de conclusão da meta;
- renderização do resumo e da tabela;
- renderização do resultado manual em destaque;
- cópia do resultado textual.

## Experiência de uso

### Layout

Página única com os seguintes blocos:

1. cabeçalho curto com propósito da ferramenta;
2. área principal de colagem com instrução objetiva;
3. bloco manual para preenchimento de um único dia;
4. cartões de resumo com visão consolidada;
5. tabela com resultado por linha;
6. faixa de ajuda com exemplos aceitos e regras rápidas.

### Interação

- cálculo automático ao colar;
- recálculo também durante edição manual do conteúdo;
- cálculo automático ao preencher os campos manuais;
- feedback instantâneo sem necessidade de botão “calcular”;
- botão para popular a área com exemplos reais;
- botão para limpar a entrada e os resultados;
- botão para copiar um resumo textual das linhas processadas.

### Fluxo manual

O bloco manual atenderá um único dia por vez, com os campos:

- `Entrada 1`
- `Saída 1`
- `Entrada 2`
- `Saída 2` opcional

Comportamento esperado:

- se `Entrada 1` e `Saída 1` forem preenchidos, o sistema calcula o primeiro período;
- se `Entrada 2` também for preenchida, o sistema calcula a hora exata de saída necessária para completar `8:00`;
- se `Saída 2` for preenchida, o sistema calcula o total final do dia e o saldo excedente ou faltante.

## Regras de parsing

Cada linha colada representa um dia independente.

### Entrada aceita

Exemplos válidos:

- `08:42 13:06 14:06 15:03`
- `08:42 13:06`
- `08:42 13:06 14:06`
- linhas copiadas de tabela contendo data, texto extra e horários misturados, desde que os horários estejam no formato `HH:MM`

### Extração

- localizar todos os tokens compatíveis com `HH:MM`;
- ignorar ruído textual fora dos horários;
- ignorar linhas vazias;
- considerar no máximo a sequência de horários encontrada na própria linha.

### Validação

Uma linha será marcada como inválida quando:

- contiver apenas `1` horário;
- contiver `5` ou mais horários;
- contiver horário impossível, como `24:61`;
- tiver ordem inconsistente, como saída menor que entrada no mesmo dia.

Linhas inválidas não interrompem o processamento das demais.

## Regras de cálculo

Meta diária fixa: `8:00` líquidas de trabalho.

### Cenários suportados

#### 2 marcações

Interpretação:

- entrada 1
- saída 1

Resultado:

- calcula somente o primeiro período;
- mostra horas trabalhadas até o momento;
- mostra quanto ainda falta para completar `8:00`.
- se esse primeiro período sozinho já atingir `8:00`, mostra a hora em que a meta foi concluída dentro do próprio período;
- se esse primeiro período não atingir `8:00`, a hora final de saída não pode ser determinada sem informar a volta do segundo período.

#### 3 marcações

Interpretação:

- entrada 1
- saída 1
- entrada 2

Resultado:

- calcula o total já trabalhado no primeiro período;
- mostra quanto falta para completar `8:00`;
- calcula a hora exata de saída no segundo período para completar `8:00`.

#### 4 marcações

Interpretação:

- entrada 1
- saída 1
- entrada 2
- saída 2

Resultado:

- calcula o total líquido do dia;
- calcula a hora exata em que a meta de `8:00` foi atingida, se ela tiver sido alcançada;
- se menor que `8:00`, mostra horas faltantes;
- se igual a `8:00`, mostra status completo;
- se maior que `8:00`, mostra saldo extra.

## Fórmulas

### Duração de período

`duração = saída - entrada`

### Total trabalhado

`total = soma dos períodos completos`

### Faltante

`faltante = max(0, 8:00 - total)`

### Extra

`extra = max(0, total - 8:00)`

### Saída prevista com 3 marcações

`saída_prevista = entrada_2 + faltante`

### Hora de conclusão da meta

- se a meta for atingida ainda no primeiro período:
  `conclusão_meta = entrada_1 + 8:00`
- se a meta for atingida no segundo período:
  `conclusão_meta = entrada_2 + faltante_após_primeiro_período`

## Formatação da saída

Todas as durações serão exibidas em `HH:MM`.

### Status por linha

- `Faltando`: total menor que `8:00`
- `Completo`: total igual a `8:00`
- `Extra`: total maior que `8:00`
- `Inválido`: linha com erro de parsing ou consistência

### Colunas da tabela

- `Linha`
- `Marcações`
- `Trabalhadas`
- `Status`
- `Falta / Extra`
- `Meta concluída / Saída alvo`

## Resumo consolidado

No topo da tela, a aplicação exibirá:

- quantidade de linhas válidas;
- soma total de horas trabalhadas;
- soma total faltante;
- soma total excedente;
- quantidade de linhas inválidas.

Esse resumo serve para colagens com vários dias e reduz a necessidade de leitura linha a linha.

## Resultado manual em destaque

O bloco manual exibirá um resumo próprio com:

- horas trabalhadas no momento;
- horas faltantes;
- hora exata de saída para completar `8:00`, quando `Entrada 2` estiver preenchida;
- total final do dia, quando `Saída 2` for informada;
- hora de conclusão da meta, quando ela já tiver sido atingida.

## Tratamento de erros e feedback visual

- linhas inválidas devem aparecer destacadas visualmente;
- a razão do erro deve ser exibida de forma curta e clara;
- a área de colagem não deve bloquear a edição ao detectar erro;
- os campos manuais devem validar formato `HH:MM` e ordem cronológica;
- quando não houver entrada, a tela mostra estado vazio com instrução de uso;
- quando houver linhas válidas e inválidas misturadas, o resumo considera apenas as válidas nos totais.

## Direção visual

A ferramenta deve parecer utilitária e confiável, sem aparência improvisada.

Direção recomendada:

- base clara com contraste forte;
- tipografia expressiva no título e altamente legível no conteúdo;
- cartões de resumo com códigos visuais distintos para faltante, completo e extra;
- tabela com leitura rápida e boa densidade de informação;
- destaque forte na área de colagem para incentivar o fluxo de `Ctrl+V`.

## Responsividade

- desktop como cenário principal;
- mobile suportado com empilhamento dos cartões;
- tabela com adaptação para largura menor, sem comprometer a leitura dos resultados.

## Testes manuais mínimos

### Casos válidos

- uma linha com `2` marcações;
- uma linha com `3` marcações;
- uma linha com `4` marcações;
- múltiplas linhas copiadas da tabela real.
- preenchimento manual com `Entrada 1`, `Saída 1` e `Entrada 2`.

### Casos inválidos

- linha com apenas `1` horário;
- linha com `5` horários;
- horário fora do intervalo válido;
- linha com ordem inconsistente.

### Comportamento de interface

- colagem dispara cálculo automático;
- edição manual recalcula os resultados;
- preenchimento dos campos manuais recalcula imediatamente a saída alvo;
- `Limpar` zera a tela sem recarregar a página;
- `Carregar exemplo` preenche a entrada com amostras úteis;
- `Copiar resultado` gera um resumo textual utilizável.

## Estratégia de implementação

Implementação incremental em uma única entrega:

1. estruturar a página estática;
2. implementar parser e motor de cálculo;
3. renderizar resumo e tabela;
4. adicionar estados visuais e ações auxiliares;
5. validar com os exemplos reais informados.

## Critérios de sucesso

O utilitário será considerado pronto quando:

- aceitar colagem direta dos registros reais;
- calcular corretamente horas trabalhadas, faltantes e extras;
- informar a hora exata de conclusão da meta quando ela puder ser determinada;
- informar a saída final necessária ao preencher manualmente a volta do segundo período;
- isolar linhas inválidas sem quebrar o restante;
- puder ser aberto localmente no navegador e usado sem dependências adicionais.
