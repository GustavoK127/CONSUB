import { supabaseClient, supabaseConfigured } from './supabase-client.js';

const userPages = new Set(['minha-conta.html', 'entrar-fila.html', 'consultas.html']);
const operatorPages = new Set(['operador.html']);
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const todayIso = new Date().toISOString().slice(0, 10);

function statusMessage(element, message, tone = '') {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-error', tone === 'error');
  element.classList.toggle('is-success', tone === 'success');
  element.classList.toggle('is-warning', tone === 'warning');
}

function safeError(error) {
  if (error?.code === '23505') return 'Este registro já existe ou conflita com outro registro ativo.';
  if (error?.code === '42501') return 'Sua conta não tem permissão para esta ação.';
  if (error?.code === 'P0002') return 'O registro não foi encontrado ou não está mais disponível.';
  if (error?.code === '22023') return error.message || 'Confira os dados informados.';
  if (error?.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function createCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value == null || value === '' ? '—' : String(value);
  return cell;
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function selectRowsByIds(table, columns, ids) {
  return ids.length
    ? supabaseClient.from(table).select(columns).in('id', ids)
    : Promise.resolve({ data: [], error: null });
}

async function getCurrentRole() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !sessionData.session) return null;
  const { data, error } = await supabaseClient.rpc('meu_papel');
  if (error) return null;
  return data || null;
}

async function protectCurrentPage() {
  if (!userPages.has(currentPage) && !operatorPages.has(currentPage)) return true;
  if (!supabaseConfigured || !supabaseClient) {
    window.location.replace('conta.html');
    return false;
  }
  const role = await getCurrentRole();
  if (!role) {
    window.location.replace(`conta.html?next=${encodeURIComponent(currentPage)}`);
    return false;
  }
  if (operatorPages.has(currentPage) && role !== 'operator') {
    window.location.replace('minha-conta.html');
    return false;
  }
  if (userPages.has(currentPage) && role !== 'user') {
    window.location.replace(role === 'operator' ? 'operador.html' : 'conta.html');
    return false;
  }
  return true;
}

function registerLogoutButtons() {
  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        button.disabled = false;
        window.alert('Não foi possível encerrar a sessão. Tente novamente.');
        return;
      }
      window.location.replace('conta.html');
    });
  });
}

function profileFromForm(formData) {
  return {
    nome_completo: String(formData.get('nome_completo') ?? formData.get('nome') ?? '').trim(),
    cpf: phoneDigits(formData.get('cpf')),
    data_nascimento: String(formData.get('data_nascimento') ?? formData.get('nascimento') ?? ''),
    telefone: phoneDigits(formData.get('telefone')),
    email: String(formData.get('email') || '').trim() || null,
    cns: phoneDigits(formData.get('cns')) || null,
    telefone_responsavel: phoneDigits(formData.get('telefone_responsavel') ?? formData.get('telefone-familiar')) || null
  };
}

async function fetchMyProfile() {
  const { data, error } = await supabaseClient.rpc('meu_perfil');
  if (error) throw error;
  return data?.[0] || null;
}

function fillProfileForm(form, profile, emailFallback = '') {
  if (!form || !profile) return;
  const fields = {
    nome_completo: profile.nome_completo,
    nome: profile.nome_completo,
    cpf: profile.cpf,
    data_nascimento: profile.data_nascimento,
    nascimento: profile.data_nascimento,
    telefone: profile.telefone,
    email: profile.email || emailFallback,
    cns: profile.cns,
    telefone_responsavel: profile.telefone_responsavel,
    'telefone-familiar': profile.telefone_responsavel
  };
  for (const [name, value] of Object.entries(fields)) {
    const field = form.elements.namedItem(name);
    if (field && value != null) field.value = value;
  }
}

async function initializeMyAccount() {
  const form = document.getElementById('profile-form');
  const result = document.getElementById('profile-result');
  try {
    const [{ data: session }, profile] = await Promise.all([
      supabaseClient.auth.getSession(),
      fetchMyProfile()
    ]);
    fillProfileForm(form, profile, session.session?.user?.email || '');
    if (!profile) {
      if (form?.elements.namedItem('email')) form.elements.namedItem('email').value = session.session?.user?.email || '';
      statusMessage(result, 'Complete seu perfil para registrar pedidos de consulta.');
    }
  } catch (error) {
    statusMessage(result, safeError(error), 'error');
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    statusMessage(result, 'Salvando perfil…');
    try {
      const profile = profileFromForm(new FormData(form));
      const existing = await fetchMyProfile();
      const { error } = existing
        ? await supabaseClient.rpc('atualizar_meu_perfil', { p_paciente: profile })
        : await supabaseClient.rpc('criar_meu_perfil', { p_paciente: profile });
      if (error) throw error;
      statusMessage(result, 'Seu perfil foi salvo.', 'success');
    } catch (error) {
      statusMessage(result, safeError(error), 'error');
    } finally {
      submit.disabled = false;
    }
  });

  await Promise.all([loadMyQueue(), loadMyConsultationRequests()]);
}

async function loadMyQueue() {
  const target = document.getElementById('my-queue-records');
  if (!target) return;
  target.textContent = 'Carregando inscrições…';
  const { data, error } = await supabaseClient
    .from('inscricoes_fila')
    .select('id,especialidade_id,cidade_id,unidade_referencia_id,urgencia,descricao,status,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    statusMessage(target, safeError(error), 'error');
    return;
  }
  if (!data?.length) {
    target.textContent = 'Você ainda não tem inscrições.';
    return;
  }
  const ids = (field) => [...new Set(data.map((row) => row[field]).filter(Boolean))];
  const [specialties, cities, units] = await Promise.all([
    selectRowsByIds('especialidades', 'id,nome', ids('especialidade_id')),
    selectRowsByIds('cidades', 'id,nome,uf', ids('cidade_id')),
    selectRowsByIds('unidades_saude', 'id,nome', ids('unidade_referencia_id'))
  ]);
  const failed = [specialties, cities, units].find((result) => result.error);
  if (failed) {
    target.textContent = 'Não foi possível carregar os detalhes das inscrições.';
    return;
  }
  const specialtyById = new Map((specialties.data || []).map((row) => [row.id, row.nome]));
  const cityById = new Map((cities.data || []).map((row) => [row.id, `${row.nome} — ${row.uf}`]));
  const unitById = new Map((units.data || []).map((row) => [row.id, row.nome]));
  target.replaceChildren(...data.map((row) => {
    const card = document.createElement('article');
    card.className = 'record-card';
    const title = document.createElement('h3');
    title.textContent = specialtyById.get(row.especialidade_id) || 'Inscrição na fila';
    const details = document.createElement('p');
    details.textContent = `${cityById.get(row.cidade_id) || 'Local não informado'}${unitById.has(row.unidade_referencia_id) ? ` · ${unitById.get(row.unidade_referencia_id)}` : ''} · Urgência ${row.urgencia} · ${row.status}`;
    const created = document.createElement('p');
    created.textContent = `Registrada em ${formatDateTime(row.created_at)}${row.descricao ? ` · ${row.descricao}` : ''}`;
    card.append(title, details, created);
    if (row.status === 'ativa') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-secondary';
      cancel.textContent = 'Cancelar inscrição';
      cancel.addEventListener('click', async () => {
        cancel.disabled = true;
        const { error: cancelError } = await supabaseClient.rpc('cancelar_inscricao_fila', { p_inscricao_id: row.id });
        if (cancelError) {
          cancel.disabled = false;
          window.alert(safeError(cancelError));
          return;
        }
        await loadMyQueue();
      });
      card.append(cancel);
    }
    return card;
  }));
}

async function loadMyConsultationRequests() {
  const target = document.getElementById('my-consultation-records');
  if (!target) return;
  target.textContent = 'Carregando pedidos…';
  const { data, error } = await supabaseClient
    .from('solicitacoes_consulta')
    .select('id,consulta_id,status,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    statusMessage(target, safeError(error), 'error');
    return;
  }
  if (!data?.length) {
    target.textContent = 'Você ainda não tem pedidos de consulta.';
    return;
  }
  const consultationIds = [...new Set(data.map((row) => row.consulta_id))];
  const [{ data: consultations, error: consultationError }, { data: transportRows, error: transportError }] = await Promise.all([
    supabaseClient.from('consultas').select('id,data_hora,especialidade_id,unidade_id').in('id', consultationIds),
    supabaseClient.from('solicitacoes_transporte').select('solicitacao_consulta_id,data,ponto_embarque,passageiros,area_rural,comunidade_rural').in('solicitacao_consulta_id', data.map((row) => row.id))
  ]);
  if (consultationError || transportError) {
    target.textContent = 'Não foi possível carregar os detalhes dos pedidos.';
    return;
  }
  const consultRows = consultations || [];
  const [specialties, units] = await Promise.all([
    selectRowsByIds('especialidades', 'id,nome', [...new Set(consultRows.map((row) => row.especialidade_id))]),
    selectRowsByIds('unidades_saude', 'id,nome', [...new Set(consultRows.map((row) => row.unidade_id))])
  ]);
  if (specialties.error || units.error) {
    target.textContent = 'Não foi possível carregar os detalhes dos pedidos.';
    return;
  }
  const consultById = new Map(consultRows.map((row) => [row.id, row]));
  const specialtyById = new Map((specialties.data || []).map((row) => [row.id, row.nome]));
  const unitById = new Map((units.data || []).map((row) => [row.id, row.nome]));
  const transportByRequest = new Map((transportRows || []).map((row) => [row.solicitacao_consulta_id, row]));
  target.replaceChildren(...data.map((row) => {
    const consultation = consultById.get(row.consulta_id);
    const card = document.createElement('article');
    card.className = 'record-card';
    const title = document.createElement('h3');
    title.textContent = specialtyById.get(consultation?.especialidade_id) || 'Pedido de consulta';
    const details = document.createElement('p');
    details.textContent = `${formatDateTime(consultation?.data_hora)} · ${unitById.get(consultation?.unidade_id) || 'Unidade não informada'} · Status: ${row.status}`;
    const created = document.createElement('p');
    const transport = transportByRequest.get(row.id);
    created.textContent = `Pedido enviado em ${formatDateTime(row.created_at)}${transport ? ` · Transporte solicitado para ${formatDate(transport.data)}, ${transport.passageiros} passageiro(s), embarque: ${transport.ponto_embarque}` : ''}`;
    card.append(title, details, created);
    if (row.status === 'solicitada') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-secondary';
      cancel.textContent = 'Cancelar pedido';
      cancel.addEventListener('click', async () => {
        cancel.disabled = true;
        const { error: cancelError } = await supabaseClient.rpc('cancelar_solicitacao_consulta', { p_solicitacao_id: row.id });
        if (cancelError) {
          cancel.disabled = false;
          window.alert(safeError(cancelError));
          return;
        }
        await loadMyConsultationRequests();
      });
      card.append(cancel);
    }
    return card;
  }));
}

async function loadQueueCatalogs() {
  const queueForm = document.getElementById('queue-form');
  if (!queueForm) return;
  const specialtySelect = document.getElementById('especialidade');
  const stateSelect = document.getElementById('estado');
  const citySelect = document.getElementById('cidade');
  const unitSelect = document.getElementById('ubs');
  const formStatus = document.getElementById('queue-form-result');

  const [specialties, cities, units] = await Promise.all([
    supabaseClient.from('especialidades').select('id,nome').order('nome'),
    supabaseClient.from('cidades').select('id,nome,uf').order('nome'),
    supabaseClient.from('unidades_saude').select('id,nome,cidade_id').order('nome')
  ]);
  const failed = [specialties, cities, units].find((result) => result.error);
  if (failed) {
    statusMessage(formStatus, 'Não foi possível carregar as opções. Atualize a página e tente novamente.', 'error');
    return;
  }
  const cityRows = cities.data || [];
  const unitRows = units.data || [];
  specialtySelect.replaceChildren(new Option('Selecione a especialidade', ''));
  (specialties.data || []).forEach((row) => addOption(specialtySelect, row.id, row.nome));
  stateSelect.replaceChildren(new Option('Selecione o estado', ''));
  [...new Set(cityRows.map((row) => row.uf))].sort().forEach((uf) => addOption(stateSelect, uf, uf));
  citySelect.replaceChildren(new Option('Selecione a cidade', ''));
  unitSelect.replaceChildren(new Option('Selecione uma UBS de referência (opcional)', ''));
  const updateCities = () => {
    citySelect.replaceChildren(new Option('Selecione a cidade', ''));
    cityRows.filter((city) => city.uf === stateSelect.value).forEach((city) => addOption(citySelect, city.id, city.nome));
    updateUnits();
  };
  const updateUnits = () => {
    unitSelect.replaceChildren(new Option('Selecione uma UBS de referência (opcional)', ''));
    unitRows.filter((unit) => unit.cidade_id === citySelect.value).forEach((unit) => addOption(unitSelect, unit.id, unit.nome));
  };
  stateSelect.addEventListener('change', updateCities);
  citySelect.addEventListener('change', updateUnits);
  [specialtySelect, stateSelect, citySelect, unitSelect].forEach((field) => { field.disabled = false; });

  try {
    const profile = await fetchMyProfile();
    fillProfileForm(queueForm, profile);
  } catch { /* The form remains usable; the save reports the authorization error if needed. */ }

  queueForm.addEventListener('consub:queue-submit', async (event) => {
    const formData = event.detail?.formData || new FormData(queueForm);
    const profile = profileFromForm(formData);
    const urgency = String(formData.get('urgencia') || 'normal');
    const payload = {
      p_paciente: profile,
      p_inscricao: {
        especialidade_id: String(formData.get('especialidade') || ''),
        cidade_id: String(formData.get('cidade') || ''),
        unidade_referencia_id: String(formData.get('ubs') || '') || null,
        urgencia: urgency,
        descricao: String(formData.get('descricao') || '').trim() || null,
        aceite: formData.get('consent') === 'on'
      }
    };
    const submit = queueForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    statusMessage(formStatus, 'Registrando sua inscrição…');
    const { error } = await supabaseClient.rpc('registrar_inscricao_fila', payload);
    if (error) statusMessage(formStatus, safeError(error), 'error');
    else statusMessage(formStatus, 'Sua inscrição foi registrada. Você pode acompanhá-la em Minha conta.', 'success');
    if (submit) submit.disabled = false;
  });
}

function buildConsultationCard(record, lookups) {
  const specialty = lookups.specialties.get(record.especialidade_id);
  const unit = lookups.units.get(record.unidade_id);
  const city = unit ? lookups.cities.get(unit.cidade_id) : null;
  const professional = lookups.professionals.get(record.profissional_id);
  const date = new Date(record.data_hora);
  const card = document.createElement('article');
  card.className = 'consulta-card';
  card.dataset.consultaId = record.id;
  card.dataset.demoDate = record.data_hora.slice(0, 10);
  card.dataset.specialty = specialty?.slug || '';
  card.dataset.city = city?.slug || '';
  card.dataset.search = [specialty?.nome, professional?.nome, city?.nome, unit?.nome].filter(Boolean).join(' ').toLowerCase();
  const header = document.createElement('div');
  header.className = 'consulta-card-head';
  const title = document.createElement('h3');
  title.textContent = specialty?.nome || 'Consulta';
  const vacancies = document.createElement('span');
  vacancies.className = `pill vagas-${Math.min(record.vagas_disponiveis, 4)}`;
  vacancies.textContent = `${record.vagas_disponiveis} ${record.vagas_disponiveis === 1 ? 'vaga' : 'vagas'}`;
  header.append(title, vacancies);
  const info = document.createElement('div');
  info.className = 'consulta-info';
  for (const [label, value] of [
    ['Profissional', professional?.nome || 'A definir'],
    ['Data', new Intl.DateTimeFormat('pt-BR').format(date)],
    ['Horário', new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)],
    ['Unidade', [unit?.nome, city ? `${city.nome} — ${city.uf}` : null].filter(Boolean).join(' · ')]
  ]) {
    const row = document.createElement('div');
    row.className = 'consulta-info-row';
    const labelElement = document.createElement('strong');
    labelElement.textContent = `${label}: `;
    row.append(labelElement, document.createTextNode(value || '—'));
    info.append(row);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-vaga';
  button.textContent = 'Solicitar consulta';
  card.append(header, info, button);
  return card;
}

async function loadConsultations() {
  const grid = document.querySelector('.consultas-grid');
  const emptyState = document.getElementById('consultas-empty');
  if (!grid) return;
  statusMessage(emptyState, 'Carregando consultas…');
  const { data, error } = await supabaseClient.from('consultas')
    .select('id,data_hora,vagas_disponiveis,urgencia,especialidade_id,unidade_id,profissional_id')
    .eq('status', 'disponivel').gt('vagas_disponiveis', 0).gte('data_hora', new Date().toISOString()).order('data_hora');
  if (error) {
    grid.hidden = true;
    statusMessage(emptyState, 'Não foi possível carregar as consultas. Atualize a página e tente novamente.', 'error');
    emptyState?.classList.add('visible');
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    grid.replaceChildren();
    grid.hidden = true;
    if (emptyState) {
      emptyState.textContent = 'Nenhuma consulta encontrada com esses filtros.';
      emptyState.classList.add('visible');
    }
    return;
  }
  const idValues = (key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];
  const [specialties, units, professionals] = await Promise.all([
    selectRowsByIds('especialidades', 'id,nome,slug', idValues('especialidade_id')),
    selectRowsByIds('unidades_saude', 'id,nome,cidade_id', idValues('unidade_id')),
    selectRowsByIds('profissionais_saude', 'id,nome', idValues('profissional_id'))
  ]);
  if (specialties.error || units.error || professionals.error) {
    grid.hidden = true;
    statusMessage(emptyState, 'Não foi possível carregar os detalhes das consultas.', 'error');
    emptyState?.classList.add('visible');
    return;
  }
  const unitRows = units.data || [];
  const { data: cities, error: cityError } = await supabaseClient.from('cidades').select('id,nome,uf,slug').in('id', [...new Set(unitRows.map((row) => row.cidade_id))]);
  if (cityError) {
    grid.hidden = true;
    statusMessage(emptyState, 'Não foi possível carregar as localidades das consultas.', 'error');
    emptyState?.classList.add('visible');
    return;
  }
  const mapById = (values) => new Map((values || []).map((row) => [row.id, row]));
  const lookups = { specialties: mapById(specialties.data), units: mapById(unitRows), cities: mapById(cities), professionals: mapById(professionals.data) };
  grid.replaceChildren(...rows.map((row) => buildConsultationCard(row, lookups)));
  grid.hidden = false;
  if (emptyState) {
    emptyState.textContent = rows.length ? '' : 'Nenhuma consulta encontrada com esses filtros.';
    emptyState.classList.toggle('visible', rows.length === 0);
  }
}

async function loadTransportCapacity() {
  const dateSelect = document.getElementById('transport-date');
  if (!dateSelect) return;
  const { data, error } = await supabaseClient.from('capacidade_transporte')
    .select('data,capacidade,ocupados').gte('data', todayIso).order('data');
  if (error) {
    statusMessage(document.getElementById('transport-availability'), 'Não foi possível consultar a capacidade de transporte.', 'error');
    return;
  }
  window.ConSubTransportCapacity = Object.fromEntries((data || []).map((row) => [row.data, { capacity: row.capacidade, occupied: row.ocupados }]));
  dateSelect.replaceChildren(new Option('Selecione uma data', ''));
  (data || []).forEach((row) => addOption(dateSelect, row.data, formatDate(row.data)));
}

function listenForConsultationRequests() {
  window.addEventListener('consub:consultation-request', async (event) => {
    const { consultationId, transport } = event.detail || {};
    const form = document.getElementById('vaga-demo-form');
    const result = document.getElementById('vaga-demo-result');
    const submit = form?.querySelector('button[type="submit"]');
    if (!consultationId || !form) {
      statusMessage(result, 'Selecione uma consulta antes de continuar.', 'error');
      return;
    }
    if (submit) submit.disabled = true;
    statusMessage(result, 'Registrando seu pedido…');
    const { error } = await supabaseClient.rpc('registrar_solicitacao_consulta', {
      p_consulta_id: consultationId,
      p_transporte: transport || null
    });
    if (error) statusMessage(result, safeError(error), 'error');
    else {
      statusMessage(result, transport ? 'Pedido de consulta e de transporte registrados. A vaga não foi reservada.' : 'Pedido registrado. A vaga não foi reservada.', 'success');
      window.setTimeout(() => window.location.assign('minha-conta.html'), 1000);
    }
    if (submit) submit.disabled = false;
  });
}

const operatorDefinitions = {
  patients: {
    table: 'pacientes', target: 'operator-patients-body', title: 'perfil de paciente',
    fields: [
      ['nome_completo', 'Nome completo', 'text'], ['cpf', 'CPF (11 dígitos)', 'text'], ['data_nascimento', 'Data de nascimento', 'date'],
      ['telefone', 'Telefone', 'text'], ['email', 'E-mail de contato', 'email'], ['cns', 'CNS', 'text'], ['telefone_responsavel', 'Telefone do responsável', 'text']
    ]
  },
  queue: {
    table: 'inscricoes_fila', target: 'operator-queue-body', title: 'inscrição',
    fields: [
      ['urgencia', 'Urgência', 'select', [['normal', 'Normal'], ['moderada', 'Moderada'], ['alta', 'Alta']]],
      ['status', 'Status', 'select', [['ativa', 'Ativa'], ['cancelada', 'Cancelada'], ['atendida', 'Atendida']]],
      ['descricao', 'Descrição', 'textarea']
    ]
  },
  requests: {
    table: 'solicitacoes_consulta', target: 'operator-consultations-body', title: 'pedido de consulta',
    fields: [['status', 'Status', 'select', [['solicitada', 'Solicitada'], ['cancelada', 'Cancelada']]]]
  },
  transport: {
    table: 'solicitacoes_transporte', target: 'operator-transport-body', title: 'pedido de transporte',
    fields: [
      ['data', 'Data', 'date'], ['ponto_embarque', 'Ponto de embarque', 'text'],
      ['passageiros', 'Passageiros', 'number'], ['area_rural', 'Área rural', 'checkbox'], ['comunidade_rural', 'Comunidade rural', 'text']
    ]
  }
};

let activeOperatorEdit = null;

function openOperatorEdit(kind, row) {
  const definition = operatorDefinitions[kind];
  const dialog = document.getElementById('operator-edit-dialog');
  const form = document.getElementById('operator-edit-form');
  const fields = document.getElementById('operator-edit-fields');
  const result = document.getElementById('operator-edit-result');
  activeOperatorEdit = { kind, id: row.id };
  document.getElementById('operator-edit-title').textContent = `Editar ${definition.title}`;
  fields.replaceChildren();
  statusMessage(result, '');
  definition.fields.forEach(([name, label, type, options]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.htmlFor = `operator-edit-${name}`;
    let input;
    if (type === 'select') {
      input = document.createElement('select');
      options.forEach(([value, text]) => addOption(input, value, text));
    } else if (type === 'textarea') input = document.createElement('textarea');
    else input = document.createElement('input');
    input.id = `operator-edit-${name}`;
    input.name = name;
    if (!['select', 'textarea'].includes(type)) input.type = type;
    input.required = ['nome_completo', 'cpf', 'data_nascimento', 'telefone', 'status', 'urgencia', 'ponto_embarque', 'passageiros'].includes(name);
    if (type === 'checkbox') input.checked = Boolean(row[name]);
    else input.value = row[name] ?? '';
    wrapper.append(labelElement, input);
    fields.append(wrapper);
  });
  dialog.showModal();
}

function actionButtons(kind, row) {
  const cell = document.createElement('td');
  cell.className = 'table-actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn-secondary';
  edit.textContent = 'Editar';
  edit.addEventListener('click', () => openOperatorEdit(kind, row));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn-danger';
  remove.textContent = 'Excluir';
  remove.addEventListener('click', async () => {
    const definition = operatorDefinitions[kind];
    if (!window.confirm(`Excluir este ${definition.title}? A ação não pode ser desfeita.`)) return;
    remove.disabled = true;
    const { error } = await supabaseClient.from(definition.table).delete().eq('id', row.id);
    if (error) {
      remove.disabled = false;
      statusMessage(document.getElementById('operator-dashboard-status'), safeError(error), 'error');
      return;
    }
    await loadOperatorDashboard();
  });
  cell.append(edit, remove);
  return cell;
}

function renderTable(targetId, rows, columns, kind) {
  const target = document.getElementById(targetId);
  target.replaceChildren();
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns.length + 1;
    cell.textContent = 'Nenhum registro encontrado.';
    row.append(cell);
    target.append(row);
    return;
  }
  rows.forEach((record) => {
    const row = document.createElement('tr');
    columns.forEach(([key, formatter]) => row.append(createCell(formatter ? formatter(record) : record[key])));
    row.append(actionButtons(kind, record));
    target.append(row);
  });
}

async function loadOperatorDashboard() {
  const status = document.getElementById('operator-dashboard-status');
  statusMessage(status, 'Carregando registros…');
  const [patients, queue, requests, transports, specialties, cities, units, consultations] = await Promise.all([
    supabaseClient.from('pacientes').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('inscricoes_fila').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('solicitacoes_consulta').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('solicitacoes_transporte').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('especialidades').select('id,nome'),
    supabaseClient.from('cidades').select('id,nome,uf'),
    supabaseClient.from('unidades_saude').select('id,nome,cidade_id'),
    supabaseClient.from('consultas').select('id,data_hora,especialidade_id,unidade_id')
  ]);
  const failed = [patients, queue, requests, transports, specialties, cities, units, consultations].find((result) => result.error);
  if (failed) {
    statusMessage(status, safeError(failed.error), 'error');
    return;
  }
  const patientById = new Map((patients.data || []).map((row) => [row.id, row]));
  const specialtyById = new Map((specialties.data || []).map((row) => [row.id, row.nome]));
  const cityById = new Map((cities.data || []).map((row) => [row.id, `${row.nome} — ${row.uf}`]));
  const unitById = new Map((units.data || []).map((row) => [row.id, row]));
  const consultationById = new Map((consultations.data || []).map((row) => [row.id, row]));
  renderTable('operator-patients-body', patients.data || [], [
    ['nome_completo'], ['cpf'], ['data_nascimento', (row) => formatDate(row.data_nascimento)],
    ['telefone', (row) => [row.telefone, row.email].filter(Boolean).join(' · ')], ['owner_id']
  ], 'patients');
  renderTable('operator-queue-body', queue.data || [], [
    ['paciente_id', (row) => patientById.get(row.paciente_id)?.nome_completo || row.paciente_id],
    ['especialidade_id', (row) => specialtyById.get(row.especialidade_id)],
    ['cidade_id', (row) => cityById.get(row.cidade_id)], ['urgencia'], ['status'], ['descricao']
  ], 'queue');
  renderTable('operator-consultations-body', requests.data || [], [
    ['owner_id'],
    ['consulta_id', (row) => specialtyById.get(consultationById.get(row.consulta_id)?.especialidade_id)],
    ['consulta_id', (row) => formatDateTime(consultationById.get(row.consulta_id)?.data_hora)],
    ['consulta_id', (row) => unitById.get(consultationById.get(row.consulta_id)?.unidade_id)?.nome], ['status']
  ], 'requests');
  const requestById = new Map((requests.data || []).map((row) => [row.id, row]));
  renderTable('operator-transport-body', transports.data || [], [
    ['solicitacao_consulta_id', (row) => requestById.get(row.solicitacao_consulta_id)?.owner_id],
    ['data', (row) => formatDate(row.data)], ['ponto_embarque'], ['passageiros'],
    ['area_rural', (row) => row.area_rural ? `Sim — ${row.comunidade_rural || ''}` : 'Não']
  ], 'transport');
  statusMessage(status, 'Registros carregados.', 'success');
}

function registerOperatorEditForm() {
  const form = document.getElementById('operator-edit-form');
  const dialog = document.getElementById('operator-edit-dialog');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeOperatorEdit || !form.reportValidity()) return;
    const definition = operatorDefinitions[activeOperatorEdit.kind];
    const data = new FormData(form);
    const changes = {};
    definition.fields.forEach(([name, , type]) => {
      const field = form.elements.namedItem(name);
      if (type === 'checkbox') changes[name] = Boolean(field.checked);
      else if (type === 'number') changes[name] = Number(data.get(name));
      else changes[name] = String(data.get(name) || '').trim() || null;
    });
    const save = form.querySelector('button[type="submit"]');
    save.disabled = true;
    const result = document.getElementById('operator-edit-result');
    statusMessage(result, 'Salvando alterações…');
    const { error } = await supabaseClient.from(definition.table).update(changes).eq('id', activeOperatorEdit.id);
    save.disabled = false;
    if (error) {
      statusMessage(result, safeError(error), 'error');
      return;
    }
    if (activeOperatorEdit.kind === 'requests' && changes.status === 'cancelada') {
      const { error: transportError } = await supabaseClient.from('solicitacoes_transporte')
        .delete().eq('solicitacao_consulta_id', activeOperatorEdit.id);
      if (transportError) {
        statusMessage(result, 'O pedido foi cancelado, mas não foi possível remover o pedido de transporte associado.', 'error');
        await loadOperatorDashboard();
        return;
      }
    }
    dialog.close();
    await loadOperatorDashboard();
  });
  document.getElementById('operator-edit-close')?.addEventListener('click', () => dialog?.close());
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseConfigured || !supabaseClient) {
    if (userPages.has(currentPage) || operatorPages.has(currentPage)) {
      window.location.replace('conta.html');
    }
    return;
  }
  registerLogoutButtons();
  if (!await protectCurrentPage()) return;
  if (currentPage === 'minha-conta.html') await initializeMyAccount();
  if (currentPage === 'entrar-fila.html') await loadQueueCatalogs();
  if (currentPage === 'consultas.html') {
    const profileHint = document.getElementById('consultas-profile-hint');
    try {
      if (!await fetchMyProfile()) statusMessage(profileHint, 'Complete seu perfil em Minha conta antes de registrar um pedido.');
    } catch { /* Page-level requests still receive server authorization checks. */ }
    await Promise.all([loadTransportCapacity(), loadConsultations()]);
    listenForConsultationRequests();
  }
  if (currentPage === 'operador.html') {
    registerOperatorEditForm();
    await loadOperatorDashboard();
  }
});
