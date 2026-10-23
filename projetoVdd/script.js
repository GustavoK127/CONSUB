// =========================================================
// ConSub — interações compartilhadas
// =========================================================

const DEMO_VAN_CAPACITY = Object.freeze({
  '2026-03-07': { capacity: 8, occupied: 5 },
  '2026-03-08': { capacity: 8, occupied: 7 },
  '2026-03-09': { capacity: 8, occupied: 8 },
  '2026-03-10': { capacity: 8, occupied: 4 },
  '2026-03-11': { capacity: 8, occupied: 6 },
  '2026-03-12': { capacity: 8, occupied: 8 },
  '2026-03-13': { capacity: 8, occupied: 2 },
  '2026-03-14': { capacity: 8, occupied: 8 }
});

function calculateVanAvailability(date, passengerCount) {
  const sample = DEMO_VAN_CAPACITY[date];
  const passengers = Number(passengerCount);
  if (!sample || !Number.isInteger(passengers) || passengers < 1) {
    return { knownDate: Boolean(sample), validPassengerCount: false, enoughSeats: false };
  }
  const availableSeats = Math.max(0, sample.capacity - sample.occupied);
  return {
    knownDate: true,
    validPassengerCount: true,
    capacity: sample.capacity,
    occupied: sample.occupied,
    availableSeats,
    passengers,
    enoughSeats: passengers <= availableSeats
  };
}

function hasValidPriorCancellation(record) {
  if (!record.canceledAt || !record.appointmentAt) return false;
  const leadTime = Date.parse(record.appointmentAt) - Date.parse(record.canceledAt);
  return Number.isFinite(leadTime) && leadTime >= 24 * 60 * 60 * 1000;
}

function addDaysToDate(dateTime, days) {
  const date = new Date(`${dateTime.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function evaluateAbsenceRestriction(records) {
  const orderedRecords = [...records].sort((a, b) => Date.parse(a.appointmentAt) - Date.parse(b.appointmentAt));
  let consecutiveAbsences = [];

  for (const record of orderedRecords) {
    if (record.status !== 'falta') {
      consecutiveAbsences = [];
      continue;
    }

    if (hasValidPriorCancellation(record)) {
      consecutiveAbsences = [];
      continue;
    }

    // Um cancelamento tardio é neutro nesta demonstração: não vira falta e interrompe a sequência.
    if (record.canceledAt) {
      consecutiveAbsences = [];
      continue;
    }

    consecutiveAbsences.push(record);
    if (consecutiveAbsences.length === 2) {
      const secondAbsence = consecutiveAbsences[1];
      return {
        blocked: true,
        consecutiveAbsences,
        startsOn: secondAbsence.appointmentAt,
        endsOn: addDaysToDate(secondAbsence.appointmentAt, 30)
      };
    }
  }

  return { blocked: false, consecutiveAbsences };
}

if (typeof window !== 'undefined') {
  window.ConSubDemos = { calculateVanAvailability, evaluateAbsenceRestriction, hasValidPriorCancellation };
}

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Menu mobile ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open-mobile');
    });
  }

  /* ---------- FAQ accordion (página Ajuda) ---------- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
    });
  });

  /* ---------- Filtro de categorias FAQ ---------- */
  const faqFilters = document.querySelectorAll('.faq-filter');
  faqFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      faqFilters.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.dataset.category;
      faqItems.forEach((item) => {
        const show = category === 'todos' || item.dataset.category === category;
        item.style.display = show ? '' : 'none';
      });
    });
  });

  /* ---------- Busca e filtros de Consultas Disponíveis ---------- */
  const searchInput = document.getElementById('consulta-search');
  const specialtyFilter = document.getElementById('filter-specialty');
  const cityFilter = document.getElementById('filter-city');
  const consultaCards = document.querySelectorAll('.consulta-card');
  const emptyState = document.getElementById('consultas-empty');

  function applyConsultaFilters() {
    if (!consultaCards.length) return;
    const term = (searchInput?.value || '').trim().toLowerCase();
    const specialty = specialtyFilter?.value || 'todas';
    const city = cityFilter?.value || 'todas';
    let visibleCount = 0;

    consultaCards.forEach((card) => {
      const haystack = card.dataset.search || '';
      const cardSpecialty = card.dataset.specialty || '';
      const cardCity = card.dataset.city || '';

      const matchesTerm = !term || haystack.includes(term);
      const matchesSpecialty = specialty === 'todas' || cardSpecialty === specialty;
      const matchesCity = city === 'todas' || cardCity === city;

      const visible = matchesTerm && matchesSpecialty && matchesCity;
      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    if (emptyState) {
      emptyState.classList.toggle('visible', visibleCount === 0);
    }
  }

  [searchInput, specialtyFilter, cityFilter].forEach((el) => {
    if (el) el.addEventListener('input', applyConsultaFilters);
  });

  /* ---------- Solicitação demonstrativa de consulta ---------- */
  const vagaDialog = document.getElementById('vaga-demo-dialog');
  const vagaForm = document.getElementById('vaga-demo-form');
  const requestTransport = document.getElementById('request-transport');
  const transportFields = document.getElementById('transport-fields');
  const transportDate = document.getElementById('transport-date');
  const transportPickup = document.getElementById('transport-pickup');
  const transportRural = document.getElementById('transport-rural');
  const ruralCommunityField = document.getElementById('rural-community-field');
  const ruralCommunity = document.getElementById('rural-community');
  const transportPassengers = document.getElementById('transport-passengers');
  const transportAvailability = document.getElementById('transport-availability');
  const removeTransport = document.getElementById('remove-transport');
  const selectedVagaSummary = document.getElementById('vaga-demo-summary');
  const vagaDemoResult = document.getElementById('vaga-demo-result');

  function formatDemoDate(date) {
    if (!date) return '';
    const [year, month, day] = date.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  function setDemoMessage(element, message, tone = '') {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('is-warning', tone === 'warning');
    element.classList.toggle('is-blocked', tone === 'blocked');
  }

  function updateTransportAvailability() {
    if (!requestTransport || !transportFields) return;
    transportFields.hidden = !requestTransport.checked;
    const transportInputs = [transportDate, transportPickup, transportPassengers].filter(Boolean);
    transportInputs.forEach((input) => { input.required = requestTransport.checked; });
    if (ruralCommunity) ruralCommunity.required = requestTransport.checked && Boolean(transportRural?.checked);
    if (ruralCommunityField) ruralCommunityField.hidden = !requestTransport.checked || !transportRural?.checked;
    if (!requestTransport.checked) {
      if (transportAvailability) setDemoMessage(transportAvailability, 'O transporte é opcional. A solicitação demonstrativa da consulta pode continuar sem ele.');
      if (removeTransport) removeTransport.hidden = true;
      return;
    }

    const result = calculateVanAvailability(transportDate?.value, transportPassengers?.value);
    if (!result.validPassengerCount) {
      setDemoMessage(transportAvailability, 'Informe uma quantidade inteira de passageiros maior que zero para consultar os dados fictícios.', 'warning');
      if (removeTransport) removeTransport.hidden = true;
      return;
    }
    if (!result.knownDate) {
      setDemoMessage(transportAvailability, 'Não há ocupação fictícia cadastrada para esta data. Escolha uma das datas de exemplo.', 'warning');
      if (removeTransport) removeTransport.hidden = false;
      return;
    }

    const message = `Dados fictícios para ${formatDemoDate(transportDate.value)}: capacidade ${result.capacity}; ocupação simulada ${result.occupied}; assentos restantes ${result.availableSeats}. Passageiros informados: ${result.passengers}. `;
    if (result.enoughSeats) {
      setDemoMessage(transportAvailability, `${message}Há assentos suficientes neste cenário, mas isso não representa reserva ou disponibilidade municipal. `);
      if (removeTransport) removeTransport.hidden = true;
    } else {
      setDemoMessage(transportAvailability, `${message}Não há assentos suficientes neste cenário. Altere a data ou remova o transporte; a solicitação da consulta não será cancelada.`, 'warning');
      if (removeTransport) removeTransport.hidden = false;
    }
  }

  function clearTransportErrors() {
    ['transport-date', 'transport-pickup', 'rural-community', 'transport-passengers'].forEach((id) => {
      const field = document.getElementById(id);
      const error = document.getElementById(`${id}-error`);
      if (field) field.removeAttribute('aria-invalid');
      if (error) error.hidden = true;
    });
  }

  function validateTransportFields() {
    clearTransportErrors();
    const checks = [
      { field: transportDate, error: document.getElementById('transport-date-error'), invalid: !transportDate?.value },
      { field: transportPickup, error: document.getElementById('transport-pickup-error'), invalid: !transportPickup?.value.trim() },
      { field: ruralCommunity, error: document.getElementById('rural-community-error'), invalid: Boolean(transportRural?.checked && !ruralCommunity?.value.trim()) },
      { field: transportPassengers, error: document.getElementById('transport-passengers-error'), invalid: !Number.isInteger(Number(transportPassengers?.value)) || Number(transportPassengers?.value) < 1 || Number(transportPassengers?.value) > 8 }
    ];
    const firstInvalid = checks.find((check) => check.invalid);
    if (!firstInvalid) return true;
    firstInvalid.field?.setAttribute('aria-invalid', 'true');
    if (firstInvalid.error) firstInvalid.error.hidden = false;
    firstInvalid.field?.focus();
    return false;
  }

  function closeVagaDialog() {
    if (vagaDialog?.open) vagaDialog.close();
  }

  document.querySelectorAll('.btn-vaga').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.consulta-card');
      if (!card || !vagaDialog || !vagaForm) return;
      const specialty = card.querySelector('h3')?.textContent.trim() || 'consulta de exemplo';
      const date = card.dataset.demoDate || '';
      vagaForm.reset();
      clearTransportErrors();
      if (transportDate && [...transportDate.options].some((option) => option.value === date)) transportDate.value = date;
      if (selectedVagaSummary) selectedVagaSummary.textContent = `${specialty} — data de exemplo ${formatDemoDate(date)}. Nenhuma vaga real será solicitada ou reservada.`;
      setDemoMessage(vagaDemoResult, '');
      updateTransportAvailability();
      vagaDialog.showModal();
    });
  });

  document.getElementById('close-vaga-dialog')?.addEventListener('click', closeVagaDialog);
  document.getElementById('cancel-vaga-dialog')?.addEventListener('click', closeVagaDialog);
  requestTransport?.addEventListener('change', updateTransportAvailability);
  transportRural?.addEventListener('change', updateTransportAvailability);
  transportDate?.addEventListener('change', updateTransportAvailability);
  transportPassengers?.addEventListener('input', updateTransportAvailability);

  removeTransport?.addEventListener('click', () => {
    if (requestTransport) requestTransport.checked = false;
    updateTransportAvailability();
    setDemoMessage(vagaDemoResult, 'Transporte removido da demonstração. A solicitação da consulta continua selecionada e pode seguir sem transporte.');
    document.querySelector('#vaga-demo-form button[type="submit"]')?.focus();
  });

  vagaForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (requestTransport?.checked) {
      if (!validateTransportFields()) {
        setDemoMessage(vagaDemoResult, 'Revise os campos destacados para continuar com a simulação de transporte.', 'warning');
        return;
      }
      const capacity = calculateVanAvailability(transportDate.value, transportPassengers.value);
      if (!capacity.knownDate || !capacity.enoughSeats) {
        updateTransportAvailability();
        setDemoMessage(vagaDemoResult, 'A consulta permanece selecionada. Altere a data ou remova o transporte para continuar; nenhuma consulta foi cancelada.', 'warning');
        removeTransport?.focus();
        return;
      }
      setDemoMessage(vagaDemoResult, 'Solicitação demonstrativa da consulta e do transporte registrada. A consulta não foi reservada e os assentos não foram reservados.');
      return;
    }
    setDemoMessage(vagaDemoResult, 'Solicitação demonstrativa da consulta registrada sem transporte. A vaga não foi reservada.');
  });

  /* ---------- Formulário Entrar na Fila ---------- */
  const queueForm = document.getElementById('queue-form');
  if (queueForm) {
    queueForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const requiredFields = queueForm.querySelectorAll('[required]');
      let valid = true;
      requiredFields.forEach((field) => {
        if (!field.value || (field.type === 'checkbox' && !field.checked)) {
          valid = false;
          field.style.borderColor = '#c23b3b';
        } else {
          field.style.borderColor = '';
        }
      });
      if (!valid) {
        alert('Por favor, preencha todos os campos obrigatórios (*) e aceite os termos.');
        return;
      }
      alert('Cadastro realizado com sucesso! Você foi adicionado à fila de espera do ConSub e será avisado assim que uma vaga compatível surgir.');
      queueForm.reset();
    });
  }

  /* ---------- Máscaras simples ---------- */
  const cpfInput = document.getElementById('cpf');
  if (cpfInput) {
    cpfInput.addEventListener('input', () => {
      let v = cpfInput.value.replace(/\D/g, '').slice(0, 11);
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      cpfInput.value = v;
    });
  }

  document.querySelectorAll('input[type="tel"]').forEach((tel) => {
    tel.addEventListener('input', () => {
      let v = tel.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) {
        v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      } else if (v.length > 0) {
        v = v.replace(/(\d{0,2})/, '($1');
      }
      tel.value = v.trim();
    });
  });

  /* ---------- Protocolo fictício de dengue ---------- */
  const dengueRecords = [
    { code: 'TRI-014', arrival: '08:20', symptoms: false, routineNonUrgent: true },
    { code: 'TRI-009', arrival: '08:45', symptoms: true, routineNonUrgent: false },
    { code: 'TRI-021', arrival: '08:10', symptoms: false, routineNonUrgent: false },
    { code: 'TRI-006', arrival: '08:30', symptoms: true, routineNonUrgent: false },
    { code: 'TRI-018', arrival: '08:25', symptoms: false, routineNonUrgent: true },
    { code: 'TRI-003', arrival: '08:15', symptoms: false, routineNonUrgent: false }
  ];
  const dengueQueue = document.getElementById('dengue-queue');
  const routineReviewSection = document.getElementById('routine-review-section');
  const routineReviewList = document.getElementById('routine-review-list');
  const dengueSummary = document.getElementById('dengue-summary');
  const dengueConfirmation = document.getElementById('dengue-confirmation');
  const activateDengue = document.getElementById('activate-dengue');
  const deactivateDengue = document.getElementById('deactivate-dengue');
  let dengueProtocolActive = false;

  function createDengueRecordItem(record) {
    const item = document.createElement('li');
    const code = document.createElement('strong');
    code.textContent = record.code;
    item.append(code, document.createTextNode(` — chegada: ${record.arrival}.`));
    const symptomLabel = document.createElement('label');
    symptomLabel.className = 'demo-checkbox dengue-symptom-field';
    const symptomInput = document.createElement('input');
    symptomInput.type = 'checkbox';
    symptomInput.checked = record.symptoms;
    symptomInput.dataset.symptomCode = record.code;
    symptomInput.addEventListener('change', () => {
      record.symptoms = symptomInput.checked;
      renderDengueQueue();
      document.querySelector(`[data-symptom-code="${record.code}"]`)?.focus();
    });
    symptomLabel.append(symptomInput, document.createTextNode('Relato fictício de sintomas compatíveis com dengue'));
    item.append(symptomLabel);
    if (record.routineNonUrgent && !record.symptoms) {
      item.append(document.createTextNode(' Consulta de rotina não urgente, sinalizada para revisão somente no cenário ativo.'));
    }
    return item;
  }

  function renderDengueQueue() {
    if (!dengueQueue) return;
    dengueQueue.replaceChildren();
    if (routineReviewList) routineReviewList.replaceChildren();

    let records = dengueRecords;
    let routineRecords = [];
    if (dengueProtocolActive) {
      records = [...dengueRecords].sort((a, b) => {
        if (a.symptoms !== b.symptoms) return a.symptoms ? -1 : 1;
        return a.arrival.localeCompare(b.arrival) || a.code.localeCompare(b.code);
      });
      routineRecords = records.filter((record) => record.routineNonUrgent && !record.symptoms);
      records = records.filter((record) => !routineRecords.includes(record));
    }

    records.forEach((record) => dengueQueue.append(createDengueRecordItem(record)));
    routineRecords.forEach((record) => routineReviewList?.append(createDengueRecordItem(record)));
    if (routineReviewSection) routineReviewSection.hidden = !dengueProtocolActive || routineRecords.length === 0;
    if (activateDengue) activateDengue.hidden = dengueProtocolActive;
    if (deactivateDengue) deactivateDengue.hidden = !dengueProtocolActive;

    if (dengueProtocolActive) {
      const symptomCount = dengueRecords.filter((record) => record.symptoms).length;
      setDemoMessage(dengueSummary, `Simulação ativa. ${symptomCount} registro(s) com relato de sintomas aparecem primeiro para avaliação profissional; ${routineRecords.length} consulta(s) de rotina foram separadas para revisão ou reagendamento simulado. Nenhum diagnóstico ou reagendamento real foi feito.`);
    } else {
      setDemoMessage(dengueSummary, 'Modo de demonstração desativado. A lista foi restaurada à ordem inicial.');
    }
  }

  activateDengue?.addEventListener('click', () => dengueConfirmation?.showModal());
  document.getElementById('cancel-dengue')?.addEventListener('click', () => dengueConfirmation?.close());
  document.getElementById('confirm-dengue')?.addEventListener('click', () => {
    dengueProtocolActive = true;
    dengueConfirmation?.close();
    renderDengueQueue();
  });
  deactivateDengue?.addEventListener('click', () => {
    dengueProtocolActive = false;
    renderDengueQueue();
  });
  renderDengueQueue();

  /* ---------- Cenários fictícios de faltas consecutivas ---------- */
  const absenceScenarios = {
    'sem-bloqueio': [
      { appointmentAt: '2026-04-01T12:00:00Z', status: 'compareceu' },
      { appointmentAt: '2026-04-05T12:00:00Z', status: 'falta' },
      { appointmentAt: '2026-04-09T12:00:00Z', status: 'compareceu' }
    ],
    'uma-falta': [
      { appointmentAt: '2026-04-02T12:00:00Z', status: 'falta' }
    ],
    'duas-faltas': [
      { appointmentAt: '2026-04-02T12:00:00Z', status: 'falta' },
      { appointmentAt: '2026-04-11T12:00:00Z', status: 'falta' }
    ],
    'cancelamento-valido': [
      { appointmentAt: '2026-04-02T12:00:00Z', status: 'falta' },
      { appointmentAt: '2026-04-11T12:00:00Z', status: 'cancelamento', canceledAt: '2026-04-10T12:00:00Z' },
      { appointmentAt: '2026-04-20T12:00:00Z', status: 'falta' }
    ],
    'cancelamento-tardio': [
      { appointmentAt: '2026-04-02T12:00:00Z', status: 'falta' },
      { appointmentAt: '2026-04-11T12:00:00Z', status: 'cancelamento', canceledAt: '2026-04-10T16:00:00Z' },
      { appointmentAt: '2026-04-20T12:00:00Z', status: 'falta' }
    ]
  };
  const absenceScenarioSelect = document.getElementById('absence-scenario');
  const absenceHistory = document.getElementById('absence-history');
  const absenceResult = document.getElementById('absence-result');
  const advanceBooking = document.getElementById('advance-booking');
  const bookingDemoResult = document.getElementById('booking-demo-result');
  const inPersonGuidance = document.getElementById('in-person-guidance');

  function describeAbsenceRecord(record) {
    const date = formatDemoDate(record.appointmentAt);
    if (record.status === 'falta') {
      if (hasValidPriorCancellation(record)) return `${date} — cancelamento registrado com pelo menos 24 horas; não contado como falta.`;
      if (record.canceledAt) return `${date} — tentativa de cancelamento com menos de 24 horas; ocorrência neutra nesta demonstração, não contada como falta e interrompe a sequência.`;
      return `${date} — falta sem cancelamento prévio registrado; considerada nesta regra fictícia.`;
    }
    if (record.status === 'compareceu') return `${date} — comparecimento; interrompe a sequência de faltas.`;
    const hoursBefore = (Date.parse(record.appointmentAt) - Date.parse(record.canceledAt)) / (60 * 60 * 1000);
    if (hasValidPriorCancellation(record)) return `${date} — cancelamento com ${hoursBefore} horas de antecedência; válido na demonstração e não conta como falta.`;
    return `${date} — cancelamento com ${hoursBefore} horas de antecedência; tratado como neutro nesta demonstração, não conta como falta e interrompe a sequência.`;
  }

  function renderAbsenceScenario() {
    if (!absenceScenarioSelect || !absenceHistory) return;
    const records = absenceScenarios[absenceScenarioSelect.value] || absenceScenarios['sem-bloqueio'];
    const result = evaluateAbsenceRestriction(records);
    absenceHistory.replaceChildren();
    [...records].sort((a, b) => Date.parse(a.appointmentAt) - Date.parse(b.appointmentAt)).forEach((record) => {
      const item = document.createElement('li');
      item.textContent = describeAbsenceRecord(record);
      absenceHistory.append(item);
    });

    if (result.blocked) {
      const dates = result.consecutiveAbsences.map((record) => formatDemoDate(record.appointmentAt)).join(' e ');
      setDemoMessage(absenceResult, `Restrição demonstrativa de 30 dias atingida por duas faltas consecutivas (${dates}). Início: ${formatDemoDate(result.startsOn)}. Término: ${formatDemoDate(result.endsOn)}. O bloqueio vale apenas para este fluxo fictício; não é uma regra oficial nem altera acesso real.`, 'blocked');
      if (advanceBooking) advanceBooking.disabled = true;
      if (inPersonGuidance) inPersonGuidance.hidden = false;
    } else {
      const absenceCount = result.consecutiveAbsences.length;
      setDemoMessage(absenceResult, `Sem restrição neste cenário. ${absenceCount} falta(s) consecutiva(s) considerada(s); são necessárias duas para acionar a regra ilustrativa. Cancelamentos não viram faltas automaticamente.`);
      if (advanceBooking) advanceBooking.disabled = false;
      if (inPersonGuidance) inPersonGuidance.hidden = true;
    }
    setDemoMessage(bookingDemoResult, '');
  }

  absenceScenarioSelect?.addEventListener('change', renderAbsenceScenario);
  advanceBooking?.addEventListener('click', () => {
    if (advanceBooking.disabled) return;
    setDemoMessage(bookingDemoResult, 'Avanço simulado permitido para este cenário. Nenhum agendamento foi criado.');
  });
  document.getElementById('reset-absence-demo')?.addEventListener('click', () => {
    if (absenceScenarioSelect) absenceScenarioSelect.value = 'sem-bloqueio';
    renderAbsenceScenario();
    absenceScenarioSelect?.focus();
  });
  renderAbsenceScenario();

});
