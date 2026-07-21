# Calc Ponto

Utilitário local para calcular:

- horas já trabalhadas;
- horas faltantes para completar `08:00`;
- hora exata em que a meta de `08:00` foi atingida;
- horas extras acima da meta;
- saída alvo quando você informa a volta do segundo período.

## Como usar

### Opção 1: abrir direto no navegador

Abra [index.html](/home/danilo/git/calc-ponto/index.html) no navegador.

### Opção 2: subir um servidor local simples

```bash
cd /home/danilo/git/calc-ponto
python -m http.server 4173
```

Depois acesse `http://localhost:4173`.

## Fluxo

1. copie as marcações do sistema de ponto;
2. cole no campo principal;
3. veja o resultado consolidado e por linha;
4. se faltar a volta do almoço, preencha manualmente `Entrada 2` para descobrir a saída exata.

## Exemplos aceitos

```text
08:42 13:06 14:06 15:03
08:42 13:06
08:42 13:06 14:06
21/07/2026 08:19 13:02 14:03 17:27 08:07
```

No último exemplo, o valor final `08:07` é tratado como coluna extra da tabela e ignorado, porque quebra a sequência cronológica das marcações.

## Preenchimento manual

O bloco manual aceita um único dia com:

- `Entrada 1`
- `Saída 1`
- `Entrada 2`
- `Saída 2` opcional

Com `Entrada 1`, `Saída 1` e `Entrada 2`, a aplicação já calcula a hora exata de saída para completar `08:00`.

Também é possível colar horários diretamente nos campos manuais. Se você colar uma sequência como `08:42 13:06 14:06 15:23` no primeiro campo, a aplicação distribui automaticamente os horários nos quatro inputs.
