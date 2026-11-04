import { supabaseClient, supabaseConfigured } from './supabase-client.js';

const form = document.getElementById('operator-login-form');
const message = document.getElementById('operator-login-message');
const submitButton = form?.querySelector('button[type="submit"]');

function safeNextPath() {
  const allowed = new Set(['index.html', 'consultas.html', 'entrar-fila.html']);
  const requested = new URLSearchParams(window.location.search).get('next');
  return allowed.has(requested) ? requested : 'index.html';
}

function showMessage(text, tone = '') {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle('is-error', tone === 'error');
  message.classList.toggle('is-success', tone === 'success');
}

async function initializeAccessPage() {
  if (!supabaseConfigured) {
    showMessage('Configure o endereço e a chave pública do projeto Supabase no arquivo .env.local.', 'error');
    if (submitButton) submitButton.disabled = true;
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) window.location.replace(safeNextPath());
}

initializeAccessPage();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient || !form.reportValidity()) return;

  if (submitButton) submitButton.disabled = true;
  showMessage('Verificando acesso…');

  const formData = new FormData(form);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || '')
  });

  if (error) {
    showMessage('Não foi possível entrar. Confira as credenciais e tente novamente.', 'error');
    if (submitButton) submitButton.disabled = false;
    return;
  }

  window.location.replace(safeNextPath());
});
