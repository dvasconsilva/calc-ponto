(function (global) {
  "use strict";

  const TARGET_MINUTES = 8 * 60;
  const EXAMPLE_INPUT = [
    "08:42 13:06 14:06",
    "08:42 13:06",
    "08:42 13:06 14:06 15:03",
    "21/07/2026 08:19 13:02 14:03 17:27 08:07",
    "linha sem horario",
  ].join("\n");
  const MANUAL_FIELD_KEYS = ["entry1", "exit1", "entry2", "exit2"];

  const state = {
    rows: [],
    summary: createEmptySummary(),
    manual: null,
    copyTimeoutId: null,
  };

  let elements = null;

  function createEmptySummary() {
    return {
      validCount: 0,
      invalidCount: 0,
      workedTotal: 0,
      missingTotal: 0,
      extraTotal: 0,
    };
  }

  function init() {
    elements = {
      input: document.getElementById("punch-input"),
      loadExampleBtn: document.getElementById("load-example-btn"),
      copyResultsBtn: document.getElementById("copy-results-btn"),
      clearBtn: document.getElementById("clear-btn"),
      clearManualBtn: document.getElementById("clear-manual-btn"),
      statusMessage: document.getElementById("status-message"),
      validCount: document.getElementById("valid-count"),
      workedTotal: document.getElementById("worked-total"),
      missingTotal: document.getElementById("missing-total"),
      extraTotal: document.getElementById("extra-total"),
      invalidCount: document.getElementById("invalid-count"),
      resultsCaption: document.getElementById("results-caption"),
      emptyState: document.getElementById("empty-state"),
      resultsTableWrap: document.getElementById("results-table-wrap"),
      resultsBody: document.getElementById("results-body"),
      manualEntry1: document.getElementById("manual-entry-1"),
      manualExit1: document.getElementById("manual-exit-1"),
      manualEntry2: document.getElementById("manual-entry-2"),
      manualExit2: document.getElementById("manual-exit-2"),
      manualWorkedTotal: document.getElementById("manual-worked-total"),
      manualBalanceTotal: document.getElementById("manual-balance-total"),
      manualBalanceHelp: document.getElementById("manual-balance-help"),
      manualTargetTime: document.getElementById("manual-target-time"),
      manualTargetHelp: document.getElementById("manual-target-help"),
      manualDayStatus: document.getElementById("manual-day-status"),
      manualDayStatusHelp: document.getElementById("manual-day-status-help"),
      manualStatusMessage: document.getElementById("manual-status-message"),
    };

    if (!elements.input) {
      return;
    }

    bindEvents();
    renderFromText(elements.input.value);
    renderManual();
  }

  function bindEvents() {
    elements.input.addEventListener("input", () => {
      renderFromText(elements.input.value);
    });

    elements.loadExampleBtn.addEventListener("click", () => {
      elements.input.value = EXAMPLE_INPUT;
      renderFromText(elements.input.value);
      elements.input.focus();
      setStatusMessage("Exemplos carregados para validação rápida.");
    });

    elements.clearBtn.addEventListener("click", () => {
      clearCopyTimeout();
      elements.input.value = "";
      setManualValues(createEmptyManualValues());
      renderFromText("");
      renderManual();
      elements.input.focus();
      setStatusMessage("Colagem e preenchimento manual foram limpos.");
    });

    elements.clearManualBtn.addEventListener("click", () => {
      setManualValues(createEmptyManualValues());
      renderManual();
      elements.manualEntry1.focus();
    });

    getManualInputs().forEach((input) => {
      input.addEventListener("input", (event) => {
        event.currentTarget.value = normalizeManualInputValue(event.currentTarget.value);
        renderManual();
      });

      input.addEventListener("paste", handleManualPaste);
    });

    elements.copyResultsBtn.addEventListener("click", async () => {
      if (!state.rows.length) {
        setStatusMessage("Nada para copiar ainda.");
        return;
      }

      const text = buildCopyText(state.rows, state.summary);

      try {
        await copyText(text);
        flashCopySuccess();
      } catch (error) {
        setStatusMessage("Não foi possível copiar automaticamente.");
      }
    });
  }

  function renderFromText(text) {
    const rows = parseInput(text);
    const summary = summarizeRows(rows);

    state.rows = rows;
    state.summary = summary;

    renderSummary(summary);
    renderRows(rows);
    renderCaption(rows, summary);
    updateBatchButtons(rows, text);
    updateStatusFromState(rows, summary, text);
  }

  function renderManual() {
    const manualState = parseManualState(readManualValues());
    state.manual = manualState;

    renderManualCards(manualState);
    elements.clearManualBtn.disabled = manualState.kind === "empty";
  }

  function updateBatchButtons(rows, text) {
    const hasText = text.trim().length > 0;
    elements.copyResultsBtn.disabled = rows.length === 0;
    elements.clearBtn.disabled = !hasText && isManualEmpty(readManualValues());
  }

  function renderSummary(summary) {
    elements.validCount.textContent = String(summary.validCount);
    elements.workedTotal.textContent = formatDuration(summary.workedTotal);
    elements.missingTotal.textContent = formatDuration(summary.missingTotal);
    elements.extraTotal.textContent = formatDuration(summary.extraTotal);
    elements.invalidCount.textContent = String(summary.invalidCount);
  }

  function renderCaption(rows, summary) {
    if (!rows.length) {
      elements.resultsCaption.textContent =
        "Cole seus registros para gerar o detalhamento.";
      return;
    }

    const totalProcessed = rows.length;
    const invalidSuffix =
      summary.invalidCount > 0
        ? ` · ${summary.invalidCount} inválida${summary.invalidCount === 1 ? "" : "s"}`
        : "";

    elements.resultsCaption.textContent =
      `${totalProcessed} linha${totalProcessed === 1 ? "" : "s"} processada${totalProcessed === 1 ? "" : "s"}`
      + ` · ${summary.validCount} válida${summary.validCount === 1 ? "" : "s"}`
      + invalidSuffix;
  }

  function renderRows(rows) {
    if (!rows.length) {
      elements.emptyState.hidden = false;
      elements.resultsTableWrap.hidden = true;
      elements.resultsBody.innerHTML = "";
      return;
    }

    elements.emptyState.hidden = true;
    elements.resultsTableWrap.hidden = false;
    elements.resultsBody.innerHTML = rows.map(renderRowMarkup).join("");
  }

  function renderRowMarkup(row) {
    if (row.kind === "invalid") {
      return `
        <tr>
          <td data-label="Linha"><span class="row-index">#${row.lineNumber}</span></td>
          <td data-label="Marcações">
            <span class="marks">${escapeHtml(row.displayMarks)}</span>
            <span class="meta-note meta-note-error">${escapeHtml(row.errorMessage)}</span>
          </td>
          <td data-label="Trabalhadas"><span class="time-value">--:--</span></td>
          <td data-label="Status"><span class="row-status status-invalido">Inválido</span></td>
          <td data-label="Falta / Extra"><span class="balance-value balance-invalid">--:--</span></td>
          <td data-label="Meta / Saída alvo"><span class="exit-value exit-unavailable">--:--</span></td>
        </tr>
      `;
    }

    const balanceValue =
      row.balanceType === "extra"
        ? formatDuration(row.extraMinutes)
        : row.balanceType === "missing"
          ? formatDuration(row.missingMinutes)
          : "00:00";

    const targetValue =
      row.targetMomentMinutes == null
        ? "--:--"
        : formatClock(row.targetMomentMinutes);

    const targetHint = row.targetMomentHint || "";
    const targetClass = `exit-${row.targetMomentKind}`;
    const statusClass = normalizeStatusClass(row.status);

    return `
      <tr>
        <td data-label="Linha"><span class="row-index">#${row.lineNumber}</span></td>
        <td data-label="Marcações">
          <span class="marks">${escapeHtml(row.displayMarks)}</span>
          ${row.note ? `<span class="meta-note">${escapeHtml(row.note)}</span>` : ""}
        </td>
        <td data-label="Trabalhadas"><span class="time-value">${formatDuration(row.totalMinutes)}</span></td>
        <td data-label="Status"><span class="row-status ${statusClass}">${escapeHtml(row.status)}</span></td>
        <td data-label="Falta / Extra"><span class="balance-value balance-${row.balanceType}">${balanceValue}</span></td>
        <td data-label="Meta / Saída alvo">
          <span class="exit-value ${targetClass}">${targetValue}</span>
          ${targetHint ? `<span class="meta-note">${escapeHtml(targetHint)}</span>` : ""}
        </td>
      </tr>
    `;
  }

  function renderManualCards(manualState) {
    if (manualState.kind === "empty") {
      elements.manualWorkedTotal.textContent = "--:--";
      elements.manualBalanceTotal.textContent = "--:--";
      elements.manualBalanceHelp.textContent = "Preencha os horários para calcular o saldo.";
      elements.manualTargetTime.textContent = "--:--";
      elements.manualTargetHelp.textContent =
        "Informe a volta do segundo período para descobrir a saída final.";
      elements.manualDayStatus.textContent = "Aguardando";
      elements.manualDayStatusHelp.textContent = "Preencha ao menos Entrada 1 e Saída 1.";
      elements.manualStatusMessage.textContent =
        "Preencha os horários acima para calcular a saída exata.";
      updateBatchButtons(state.rows, elements.input.value);
      return;
    }

    if (manualState.kind === "invalid" || manualState.kind === "partial") {
      elements.manualWorkedTotal.textContent = "--:--";
      elements.manualBalanceTotal.textContent = "--:--";
      elements.manualBalanceHelp.textContent = "Ainda não há cálculo válido para o saldo.";
      elements.manualTargetTime.textContent = "--:--";
      elements.manualTargetHelp.textContent =
        manualState.kind === "invalid"
          ? "Corrija a ordem ou complete os campos obrigatórios."
          : "Complete Saída 1 para iniciar o cálculo.";
      elements.manualDayStatus.textContent =
        manualState.kind === "invalid" ? "Inválido" : "Incompleto";
      elements.manualDayStatusHelp.textContent = manualState.message;
      elements.manualStatusMessage.textContent = manualState.message;
      updateBatchButtons(state.rows, elements.input.value);
      return;
    }

    const calculation = manualState.calculation;
    const targetValue =
      calculation.targetMomentMinutes == null
        ? "--:--"
        : formatClock(calculation.targetMomentMinutes);
    const balanceValue =
      calculation.balanceType === "extra"
        ? formatDuration(calculation.extraMinutes)
        : calculation.balanceType === "missing"
          ? formatDuration(calculation.missingMinutes)
          : "00:00";

    elements.manualWorkedTotal.textContent = formatDuration(calculation.totalMinutes);
    elements.manualBalanceTotal.textContent = balanceValue;
    elements.manualBalanceHelp.textContent = buildManualBalanceHelp(calculation);
    elements.manualTargetTime.textContent = targetValue;
    elements.manualTargetHelp.textContent = calculation.targetMomentHint;
    elements.manualDayStatus.textContent = calculation.status;
    elements.manualDayStatusHelp.textContent = buildManualStatusHelp(manualState);
    elements.manualStatusMessage.textContent = buildManualStatusMessage(manualState);
    updateBatchButtons(state.rows, elements.input.value);
  }

  function buildManualBalanceHelp(calculation) {
    if (calculation.balanceType === "extra") {
      return "Você já passou da meta diária.";
    }

    if (calculation.balanceType === "complete") {
      return "Meta diária fechada sem saldo pendente.";
    }

    return "Tempo restante até completar 08:00.";
  }

  function buildManualStatusHelp(manualState) {
    const calculation = manualState.calculation;

    if (manualState.filledCount === 2 && calculation.targetMomentKind === "unavailable") {
      return "Agora informe Entrada 2 para descobrir a saída exata.";
    }

    if (calculation.targetMomentKind === "projected") {
      if (calculation.targetMomentContext === "closed-early") {
        return "A hora exibida é a saída que faltou para fechar 08:00.";
      }

      return "A hora exibida é a saída necessária para fechar 08:00.";
    }

    if (calculation.targetMomentKind === "achieved") {
      return "A hora exibida é quando a meta foi atingida.";
    }

    return calculation.targetMomentHint;
  }

  function buildManualStatusMessage(manualState) {
    const calculation = manualState.calculation;

    if (manualState.filledCount === 2 && calculation.targetMomentKind === "unavailable") {
      return "Primeiro período calculado. Informe Entrada 2 para descobrir a saída final.";
    }

    if (calculation.targetMomentKind === "projected") {
      if (calculation.targetMomentContext === "closed-early") {
        return `Para completar 08:00, a saída deveria ter sido ${formatClock(calculation.targetMomentMinutes)}.`;
      }

      return `Se bater o ponto às ${formatClock(calculation.targetMomentMinutes)}, você completa 08:00.`;
    }

    if (calculation.targetMomentKind === "achieved") {
      if (calculation.extraMinutes > 0) {
        return `A meta foi concluída às ${formatClock(calculation.targetMomentMinutes)}. O dia está com ${formatDuration(calculation.extraMinutes)} extra.`;
      }

      return `A meta foi concluída às ${formatClock(calculation.targetMomentMinutes)}.`;
    }

    return calculation.targetMomentHint;
  }

  function updateStatusFromState(rows, summary, text) {
    if (!text.trim()) {
      setStatusMessage("Aguardando colagem.");
      return;
    }

    if (!rows.length) {
      setStatusMessage("Nenhuma linha processável foi encontrada.");
      return;
    }

    if (summary.invalidCount === 0) {
      setStatusMessage(
        `${summary.validCount} linha${summary.validCount === 1 ? "" : "s"} válida${summary.validCount === 1 ? "" : "s"} processada${summary.validCount === 1 ? "" : "s"}.`,
      );
      return;
    }

    setStatusMessage(
      `${summary.validCount} válida${summary.validCount === 1 ? "" : "s"} e ${summary.invalidCount} inválida${summary.invalidCount === 1 ? "" : "s"}.`,
    );
  }

  function setStatusMessage(message) {
    if (elements && elements.statusMessage) {
      elements.statusMessage.textContent = message;
    }
  }

  function parseInput(text) {
    return text
      .split(/\r?\n/)
      .map((line, index) => ({
        rawLine: line,
        lineNumber: index + 1,
      }))
      .filter((line) => line.rawLine.trim().length > 0)
      .map((line) => parseLine(line.rawLine, line.lineNumber));
  }

  function parseLine(rawLine, lineNumber) {
    const tokens = extractTimeTokens(rawLine);

    if (!tokens.length) {
      return invalidResult(
        lineNumber,
        rawLine,
        "Nenhum horário no formato HH:MM foi encontrado.",
      );
    }

    const parsed = tokens.map((token) => ({
      token,
      minutes: parseTimeToken(token),
    }));

    const invalidToken = parsed.find((item) => item.minutes == null);

    if (invalidToken) {
      return invalidResult(
        lineNumber,
        rawLine,
        `Horário inválido: ${invalidToken.token}.`,
        tokens,
      );
    }

    if (parsed.length === 1) {
      return invalidResult(
        lineNumber,
        rawLine,
        "A linha precisa ter pelo menos 2 marcações.",
        tokens,
      );
    }

    const resolved = resolveChronologicalSequence(parsed);

    if (!resolved) {
      const reason =
        parsed.length > 4
          ? "Há mais de 4 marcações em sequência cronológica."
          : "Os horários precisam estar em ordem crescente.";

      return invalidResult(lineNumber, rawLine, reason, tokens);
    }

    const calculation = calculateWorkedTime(resolved.usedMinutes);
    const ignoredCount = resolved.ignoredCount;

    return {
      kind: "valid",
      lineNumber,
      rawLine,
      displayMarks: resolved.usedMinutes.map(formatClock).join(" · "),
      totalMinutes: calculation.totalMinutes,
      missingMinutes: calculation.missingMinutes,
      extraMinutes: calculation.extraMinutes,
      exitEstimateMinutes: calculation.exitEstimateMinutes,
      targetMomentMinutes: calculation.targetMomentMinutes,
      targetMomentKind: calculation.targetMomentKind,
      targetMomentHint: calculation.targetMomentHint,
      status: calculation.status,
      balanceType: calculation.balanceType,
      note:
        ignoredCount > 0
          ? `${ignoredCount} valor${ignoredCount === 1 ? "" : "es"} extra${ignoredCount === 1 ? "" : "s"} ${ignoredCount === 1 ? "foi ignorado" : "foram ignorados"}.`
          : "",
    };
  }

  function parseManualState(values) {
    if (isManualEmpty(values)) {
      return {
        kind: "empty",
      };
    }

    const orderedValues = MANUAL_FIELD_KEYS.map((key) => (values[key] || "").trim());
    const firstEmptyIndex = orderedValues.findIndex((value) => value === "");

    if (
      firstEmptyIndex !== -1
      && orderedValues.slice(firstEmptyIndex + 1).some((value) => value !== "")
    ) {
      return {
        kind: "invalid",
        message: "Preencha os horários na ordem: Entrada 1, Saída 1, Entrada 2 e Saída 2.",
      };
    }

    const filledValues = orderedValues.filter(Boolean);

    if (filledValues.some((value) => !isCompleteTimeToken(value))) {
      return {
        kind: "partial",
        message: "Complete os horários manuais no formato HH:MM.",
      };
    }

    const parsedMinutes = filledValues.map(parseTimeToken);

    if (parsedMinutes.some((value) => value == null)) {
      return {
        kind: "invalid",
        message: "Todos os campos manuais precisam estar no formato HH:MM.",
      };
    }

    if (filledValues.length === 1) {
      return {
        kind: "partial",
        message: "Informe Saída 1 para começar o cálculo manual.",
      };
    }

    if (!isStrictlyIncreasing(parsedMinutes)) {
      return {
        kind: "invalid",
        message: "Os horários manuais precisam estar em ordem crescente.",
      };
    }

    const calculation = calculateWorkedTime(parsedMinutes);

    return {
      kind: "ready",
      filledCount: filledValues.length,
      marks: parsedMinutes,
      calculation,
    };
  }

  function invalidResult(lineNumber, rawLine, errorMessage, tokens) {
    const extractedTokens = Array.isArray(tokens) && tokens.length > 0
      ? tokens.join(" · ")
      : "—";

    return {
      kind: "invalid",
      lineNumber,
      rawLine,
      displayMarks: extractedTokens,
      errorMessage,
    };
  }

  function extractTimeTokens(line) {
    return line.match(/\b\d{1,2}:\d{2}\b/g) || [];
  }

  function extractManualPasteTokens(text) {
    const matchedTimes = text.match(/\b\d{1,2}:\d{1,2}\b/g);

    if (matchedTimes && matchedTimes.length > 0) {
      return matchedTimes
        .map((token) => normalizeManualInputValue(token))
        .filter(isCompleteTimeToken);
    }

    const normalizedSingle = normalizeManualInputValue(text);
    return isCompleteTimeToken(normalizedSingle) ? [normalizedSingle] : [];
  }

  function parseTimeToken(token) {
    const parts = token.split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
      Number.isNaN(hours)
      || Number.isNaN(minutes)
      || hours < 0
      || hours > 23
      || minutes < 0
      || minutes > 59
    ) {
      return null;
    }

    return (hours * 60) + minutes;
  }

  function isCompleteTimeToken(token) {
    return /^\d{2}:\d{2}$/.test(token);
  }

  function normalizeManualInputValue(value) {
    const trimmed = String(value || "").trim();

    if (!trimmed) {
      return "";
    }

    const sanitized = trimmed.replace(/[^\d:]/g, "");

    if (sanitized.includes(":")) {
      const [rawHours = "", rawMinutes = ""] = sanitized.split(":");
      const hours = rawHours.slice(0, 2);
      const minutes = rawMinutes.slice(0, 2);
      const normalizedHours =
        rawHours.length === 1 && rawMinutes.length > 0 ? `0${rawHours}` : hours;

      if (sanitized.endsWith(":") && rawMinutes.length === 0) {
        return `${normalizedHours}:`;
      }

      return rawMinutes.length > 0
        ? `${normalizedHours}:${minutes}`
        : normalizedHours;
    }

    const digits = sanitized.replace(/\D/g, "").slice(0, 4);

    if (digits.length <= 2) {
      return digits;
    }

    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  function resolveChronologicalSequence(parsedTokens) {
    const minutes = parsedTokens.map((item) => item.minutes);
    const maxLength = Math.min(4, minutes.length);

    for (let length = maxLength; length >= 2; length -= 1) {
      const candidate = minutes.slice(0, length);
      const remaining = minutes.slice(length);

      if (!isStrictlyIncreasing(candidate)) {
        continue;
      }

      if (remaining.length === 0) {
        return {
          usedMinutes: candidate,
          ignoredCount: 0,
        };
      }

      const canIgnoreRemaining = remaining.every(
        (value) => value <= candidate[candidate.length - 1],
      );

      if (canIgnoreRemaining) {
        return {
          usedMinutes: candidate,
          ignoredCount: remaining.length,
        };
      }
    }

    return null;
  }

  function isStrictlyIncreasing(values) {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) {
        return false;
      }
    }

    return true;
  }

  function calculateWorkedTime(marks) {
    const firstPeriodMinutes = marks[1] - marks[0];
    const secondPeriodMinutes = marks.length === 4 ? marks[3] - marks[2] : 0;
    const totalMinutes = firstPeriodMinutes + secondPeriodMinutes;
    const missingMinutes = Math.max(0, TARGET_MINUTES - totalMinutes);
    const extraMinutes = Math.max(0, totalMinutes - TARGET_MINUTES);

    let targetMomentMinutes = null;
    let targetMomentKind = "unavailable";
    let targetMomentHint = "Informe a volta do segundo período para calcular a saída.";
    let targetMomentContext = "unavailable";

    if (firstPeriodMinutes >= TARGET_MINUTES) {
      targetMomentMinutes = marks[0] + TARGET_MINUTES;
      targetMomentKind = "achieved";
      targetMomentHint = "A meta foi atingida ainda no primeiro período.";
      targetMomentContext = "achieved-period1";
    } else if (marks.length >= 3) {
      const targetOnSecondPeriod = marks[2] + (TARGET_MINUTES - firstPeriodMinutes);

      if (marks.length === 3) {
        targetMomentMinutes = targetOnSecondPeriod;
        targetMomentKind = "projected";
        targetMomentHint = "Saída necessária para completar 08:00.";
        targetMomentContext = "ongoing";
      } else if (totalMinutes >= TARGET_MINUTES) {
        targetMomentMinutes = targetOnSecondPeriod;
        targetMomentKind = "achieved";
        targetMomentHint = "A meta foi atingida durante o segundo período.";
        targetMomentContext = "achieved-period2";
      } else {
        targetMomentMinutes = targetOnSecondPeriod;
        targetMomentKind = "projected";
        targetMomentHint = "Saída alvo para completar 08:00; o registro atual encerrou antes da meta.";
        targetMomentContext = "closed-early";
      }
    } else if (marks.length === 2) {
      targetMomentHint = "Informe Entrada 2 no bloco manual para descobrir a saída final.";
      targetMomentContext = "need-entry2";
    }

    const status =
      extraMinutes > 0
        ? "Extra"
        : missingMinutes > 0
          ? "Faltando"
          : "Completo";

    const balanceType =
      extraMinutes > 0
        ? "extra"
        : missingMinutes > 0
          ? "missing"
          : "complete";

    return {
      totalMinutes,
      missingMinutes,
      extraMinutes,
      status,
      balanceType,
      firstPeriodMinutes,
      secondPeriodMinutes,
      targetMomentMinutes,
      targetMomentKind,
      targetMomentHint,
      targetMomentContext,
      exitEstimateMinutes: targetMomentKind === "projected" ? targetMomentMinutes : null,
    };
  }

  function summarizeRows(rows) {
    return rows.reduce((summary, row) => {
      if (row.kind === "invalid") {
        summary.invalidCount += 1;
        return summary;
      }

      summary.validCount += 1;
      summary.workedTotal += row.totalMinutes;
      summary.missingTotal += row.missingMinutes;
      summary.extraTotal += row.extraMinutes;

      return summary;
    }, createEmptySummary());
  }

  function formatDuration(totalMinutes) {
    const safeMinutes = Math.max(0, totalMinutes);
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatClock(totalMinutes) {
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const hours = Math.floor(normalizedMinutes / 60);
    const minutes = normalizedMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function normalizeStatusClass(status) {
    return `status-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
  }

  function buildCopyText(rows, summary) {
    const lines = [
      "Resumo Calc Ponto",
      `Linhas válidas: ${summary.validCount}`,
      `Horas trabalhadas: ${formatDuration(summary.workedTotal)}`,
      `Horas faltantes: ${formatDuration(summary.missingTotal)}`,
      `Horas extras: ${formatDuration(summary.extraTotal)}`,
      `Linhas inválidas: ${summary.invalidCount}`,
      "",
    ];

    rows.forEach((row) => {
      if (row.kind === "invalid") {
        lines.push(
          `Linha ${row.lineNumber}: Inválido | ${row.errorMessage}`,
        );
        return;
      }

      let line = `Linha ${row.lineNumber}: ${row.displayMarks} | Trabalhadas ${formatDuration(row.totalMinutes)} | ${row.status}`;

      if (row.balanceType === "missing") {
        line += ` | Faltam ${formatDuration(row.missingMinutes)}`;
      } else if (row.balanceType === "extra") {
        line += ` | Extra ${formatDuration(row.extraMinutes)}`;
      } else {
        line += " | Meta atingida";
      }

      if (row.targetMomentMinutes != null) {
        line += row.targetMomentKind === "projected"
          ? ` | Saída alvo ${formatClock(row.targetMomentMinutes)}`
          : ` | Meta concluída ${formatClock(row.targetMomentMinutes)}`;
      } else if (row.targetMomentHint) {
        line += ` | ${row.targetMomentHint}`;
      }

      if (row.note) {
        line += ` | ${row.note}`;
      }

      lines.push(line);
    });

    return lines.join("\n");
  }

  function createEmptyManualValues() {
    return {
      entry1: "",
      exit1: "",
      entry2: "",
      exit2: "",
    };
  }

  function readManualValues() {
    return {
      entry1: elements.manualEntry1.value,
      exit1: elements.manualExit1.value,
      entry2: elements.manualEntry2.value,
      exit2: elements.manualExit2.value,
    };
  }

  function setManualValues(values) {
    elements.manualEntry1.value = values.entry1 || "";
    elements.manualExit1.value = values.exit1 || "";
    elements.manualEntry2.value = values.entry2 || "";
    elements.manualExit2.value = values.exit2 || "";
  }

  function isManualEmpty(values) {
    return MANUAL_FIELD_KEYS.every((key) => !(values[key] || "").trim());
  }

  function getManualInputs() {
    return [
      elements.manualEntry1,
      elements.manualExit1,
      elements.manualEntry2,
      elements.manualExit2,
    ];
  }

  function handleManualPaste(event) {
    const tokens = extractManualPasteTokens(event.clipboardData.getData("text"));

    if (!tokens.length) {
      return;
    }

    event.preventDefault();

    const inputs = getManualInputs();
    const startIndex = inputs.indexOf(event.currentTarget);

    tokens.slice(0, inputs.length - startIndex).forEach((token, offset) => {
      inputs[startIndex + offset].value = token;
    });

    renderManual();
  }

  async function copyText(text) {
    if (
      typeof navigator !== "undefined"
      && navigator.clipboard
      && typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "absolute";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();

    const succeeded = document.execCommand("copy");
    document.body.removeChild(helper);

    if (!succeeded) {
      throw new Error("copy_failed");
    }
  }

  function flashCopySuccess() {
    clearCopyTimeout();
    setStatusMessage("Resultado copiado para a área de transferência.");
    elements.copyResultsBtn.textContent = "Copiado";
    state.copyTimeoutId = global.setTimeout(() => {
      elements.copyResultsBtn.textContent = "Copiar resultado";
      updateStatusFromState(state.rows, state.summary, elements.input.value);
      state.copyTimeoutId = null;
    }, 1800);
  }

  function clearCopyTimeout() {
    if (state.copyTimeoutId != null) {
      global.clearTimeout(state.copyTimeoutId);
      state.copyTimeoutId = null;
    }

    if (elements && elements.copyResultsBtn) {
      elements.copyResultsBtn.textContent = "Copiar resultado";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const api = {
    TARGET_MINUTES,
    parseInput,
    parseLine,
    parseManualState,
    formatDuration,
    formatClock,
    calculateWorkedTime,
    buildCopyText,
    summarizeRows,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.calcPonto = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
