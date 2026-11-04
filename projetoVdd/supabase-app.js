import { supabaseClient, supabaseConfigured } from './supabase-client.js';

const now = new Date();
const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const requiredAuthPages = new Set(['entrar-fila.html', 'consultas.html']);

function setStatus(element, text, tone = '') {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('is-error', tone === 'error');
  element.classList.toggle('is-success', tone === 'success');
  element.classList.toggle('is-warning', tone === 'warning');
}

function getSafePageName() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  return requiredAuthPages.has(page) ? page : 'index.html';
}

function showConfigurationError() {
  const message = 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e reinicie o servidor.';
  setStatus(document.getElementById('queue-form-result'), message, 'error');
  setStatus(document.getElementById('consultas-empty'), message, 'error');
  const emptyState = document.getElementById('consultas-empty');
  if (emptyState) emptyState.classList.add('visible');
}

function safeMessageForCode(code) {
  if (code === '23505') return 'Já existe um cadastro ativo para esses dados e essa especialidade.';
  if (code === '42501' || code === 'PGRST301') return 'Sua sessão expirou ou não tem permissão. Entre novamente.';
  if (code === '22023') return 'Revise os campos informados e tente novamente.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}

async function requireOperatorSession() {
  if (!supabaseConfigured || !supabaseClient) {
    showConfigurationError();
    return false;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.replace(`acesso.html?next=${encodeURIComponent(getSafePageName())}`);
    return false;
  }

  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { error: signOutError } = await supabaseClient.auth.signOut();
      if (signOutError) {
        button.disabled = false;
        return;
      }
      window.location.replace('acesso.html');
    });
  });
  return true;
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

async function loadQueueCatalogs() {
  const queueForm = document.getElementById('queue-form');
  if (!queueForm) return;

  const specialtySelect = document.getElementById('especialidade');
  const stateSelect = document.getElementById('estado');
  const citySelect = document.getElementById('cidade');
  const unitSelect = document.getElementById('ubs');
  const formStatus = document.getElementById('queue-form-result');

  const [specialtiesResult, citiesResult, unitsResult] = await Promise.all([
    supabaseClient.from('especialidades').select('id,nome,slug').order('nome'),
    supabaseClient.from('cidades').select('id,nome,uf,slug').order('nome'),
    supabaseClient.from('unidades_saude').select('id,nome,cidade_id').order('nome')
  ]);

  const failed = [specialtiesResult, citiesResult, unitsResult].find((result) => result.error);
  if (failed) {
    setStatus(formStatus, 'Não foi possível carregar as opções. Atualize a página e tente novamente.', 'error');
    return;
  }

  const specialties = specialtiesResult.data || [];
  const cities = citiesResult.data || [];
  const units = unitsResult.data || [];

  specialtySelect.replaceChildren(new Option('Selecione a especialidade', ''));
  specialties.forEach((row) => addOption(specialtySelect, row.id, row.nome));

  const stateValues = [...new Set(cities.map((row) => row.uf))].sort();
  stateSelect.replaceChildren(new Option('Selecione o estado', ''));
  stateValues.forEach((state) => addOption(stateSelect, state, state));
  citySelect.replaceChildren(new Option('Selecione a cidade', ''));
  unitSelect.replaceChildren(new Option('Selecione uma UBS de referência (opcional)', ''));

  const updateCities = () => {
    citySelect.replaceChildren(new Option('Selecione a cidade', ''));
    cities.filter((city) => city.uf === stateSelect.value).forEach((city) => {
      addOption(citySelect, city.id, city.nome);
    });
    updateUnits();
  };

  const updateUnits = () => {
    unitSelect.replaceChildren(new Option('Selecione uma UBS de referência (opcional)', ''));
    units.filter((unit) => unit.cidade_id === citySelect.value).forEach((unit) => {
      addOption(unitSelect, unit.id, unit.nome);
    });
  };

  stateSelect.addEventListener('change', updateCities);
  citySelect.addEventListener('change', updateUnits);
  stateSelect.disabled = false;
  citySelect.disabled = false;
  unitSelect.disabled = false;

  queueForm.addEventListener('consub:queue-submit', async (event) => {
    const { formData } = event.detail || {};
    if (!(formData instanceof FormData)) return;

    const submitButton = queueForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setStatus(formStatus, 'Salvando cadastro…');

    const patient = {
      nome_completo: String(formData.get('nome') || '').trim(),
      cpf: String(formData.get('cpf') || '').replace(/\D/g, ''),
      data_nascimento: String(formData.get('nascimento') || ''),
      telefone: String(formData.get('telefone') || '').replace(/\D/g, ''),
      email: String(formData.get('email') || '').trim(),
      cns: String(formData.get('cns') || '').replace(/\D/g, ''),
      telefone_responsavel: String(formData.get('telefone-familiar') || '').replace(/\D/g, '')
    };
    const registration = {
      especialidade_id: String(formData.get('especialidade') || ''),
      cidade_id: String(formData.get('cidade') || ''),
      unidade_referencia_id: String(formData.get('ubs') || ''),
      urgencia: String(formData.get('urgencia') || 'normal'),
      descricao: String(formData.get('descricao') || '').trim(),
      aceite: formData.get('consent') === 'on'
    };

    try {
      const { error } = await supabaseClient.rpc('registrar_inscricao_fila', {
        p_paciente: patient,
        p_inscricao: registration
      });
      if (error) throw error;

      setStatus(formStatus, 'Cadastro registrado com sucesso.', 'success');
      queueForm.reset();
      updateCities();
      updateUnits();
    } catch (error) {
      setStatus(formStatus, safeMessageForCode(error.code), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function buildInfoRow(label, value) {
  const row = document.createElement('div');
  const text = document.createElement('span');
  text.textContent = `${label}: ${value}`;
  row.append(text);
  return row;
}

function createConsultationCard(record) {
  const specialty = record.especialidades;
  const unit = record.unidades_saude;
  const city = unit?.cidades;
  const professional = record.profissionais_saude;
  const date = new Date(record.data_hora);
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
  const timeLabel = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(date);
  const cityLabel = city ? `${city.nome} — ${city.uf}` : '';

  const card = document.createElement('article');
  card.className = 'consulta-card';
  card.dataset.specialty = specialty?.slug || '';
  card.dataset.city = city?.slug || '';
  card.dataset.demoDate = record.data_hora.slice(0, 10);
  card.dataset.consultaId = record.id;
  card.dataset.search = [specialty?.nome, professional?.nome, cityLabel, unit?.nome].filter(Boolean).join(' ').toLowerCase();

  const header = document.createElement('div');
  header.className = 'consulta-card-head';
  const title = document.createElement('h3');
  title.textContent = specialty?.nome || 'Consulta';
  const vacancies = document.createElement('span');
  const vacancyClass = Math.min(record.vagas_disponiveis, 4);
  vacancies.className = `pill vagas-${vacancyClass}`;
  vacancies.textContent = `${record.vagas_disponiveis} ${record.vagas_disponiveis === 1 ? 'vaga' : 'vagas'}`;
  header.append(title, vacancies);

  const info = document.createElement('div');
  info.className = 'consulta-info';
  info.append(
    buildInfoRow('Profissional', professional?.nome || 'A definir'),
    buildInfoRow('Data', dateLabel),
    buildInfoRow('Horário', timeLabel),
    buildInfoRow('Unidade', [unit?.nome, cityLabel].filter(Boolean).join(' — '))
  );

  const tag = document.createElement('span');
  tag.className = record.urgencia === 'moderada' ? 'tag tag-mod' : 'tag tag-none';
  tag.textContent = record.urgencia === 'moderada' ? 'Urgência moderada' : 'Disponível';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-vaga';
  button.textContent = 'Solicitar consulta';

  card.append(header, info, tag, button);
  return card;
}

async function loadConsultations() {
  const grid = document.querySelector('.consultas-grid');
  const emptyState = document.getElementById('consultas-empty');
  if (!grid) return;

  const { data, error } = await supabaseClient
    .from('consultas')
    .select('id,data_hora,vagas_disponiveis,urgencia,especialidades(nome,slug),unidades_saude(nome,cidades(nome,uf,slug)),profissionais_saude(nome)')
    .eq('status', 'disponivel')
    .gt('vagas_disponiveis', 0)
    .gte('data_hora', new Date().toISOString())
    .order('data_hora');

  if (error) {
    grid.replaceChildren();
    grid.hidden = true;
    if (emptyState) {
      emptyState.textContent = 'Não foi possível carregar as consultas. Atualize a página e tente novamente.';
      emptyState.classList.add('visible');
    }
    return;
  }

  grid.replaceChildren(...(data || []).map(createConsultationCard));
  grid.hidden = false;
  if (emptyState) {
    emptyState.textContent = 'Nenhuma consulta encontrada com esses filtros.';
    emptyState.classList.toggle('visible', !data?.length);
  }
}

async function loadTransportCapacity() {
  const dateSelect = document.getElementById('transport-date');
  if (!dateSelect) return;

  const { data, error } = await supabaseClient
    .from('capacidade_transporte')
    .select('data,capacidade,ocupados')
    .gte('data', todayIso)
    .order('data');

  if (error) {
    setStatus(document.getElementById('transport-availability'), 'Não foi possível consultar a capacidade de transporte.', 'error');
    return;
  }

  window.ConSubTransportCapacity = Object.fromEntries(
    (data || []).map((row) => [row.data, { capacity: row.capacidade, occupied: row.ocupados }])
  );
  dateSelect.replaceChildren();
  (data || []).forEach((row) => {
    const option = document.createElement('option');
    option.value = row.data;
    option.textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${row.data}T12:00:00`));
    dateSelect.append(option);
  });
}

function listenForConsultationRequests() {
  window.addEventListener('consub:consultation-request', async (event) => {
    const { consultationId, transport } = event.detail || {};
    const form = document.getElementById('vaga-demo-form');
    const result = document.getElementById('vaga-demo-result');
    const submitButton = form?.querySelector('button[type="submit"]');
    if (!consultationId || !form) {
      setStatus(result, 'Selecione uma consulta antes de continuar.', 'error');
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setStatus(result, 'Registrando pedido…');
    try {
      const { error } = await supabaseClient.rpc('registrar_solicitacao_consulta', {
        p_consulta_id: consultationId,
        p_transporte: transport || null
      });
      if (error) throw error;
      setStatus(result, transport
        ? 'Pedido de consulta e transporte registrado com sucesso.'
        : 'Pedido de consulta registrado com sucesso.', 'success');
    } catch (error) {
      setStatus(result, safeMessageForCode(error.code), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (!requiredAuthPages.has(page)) return;
  if (!await requireOperatorSession()) return;

  if (page === 'entrar-fila.html') await loadQueueCatalogs();
  if (page === 'consultas.html') {
    await loadTransportCapacity();
    listenForConsultationRequests();
    await loadConsultations();
  }
});
