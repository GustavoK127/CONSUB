import { supabaseClient, supabaseConfigured } from './supabase-client.js';

const form = document.getElementById('operator-login-form');
const message = document.getElementById('operator-login-message');
const submitButton = form?.querySelector('button[type="submit"]');

function showMessage(text, tone = '') {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle('is-error', tone === 'error');
  message.classList.toggle('is-success', tone === 'success');
}

async function routeSession() {
  const { data: role, error } = await supabaseClient.rpc('meu_papel');
  if (error || !role) return false;
  if (role === 'operator') {
    window.location.replace('operador.html');
    return true;
  }
  window.location.replace('minha-conta.html');
  return true;
}

async function initializeAccessPage() {
  if (!supabaseConfigured || !supabaseClient) {
    showMessage('O acesso ao Supabase ainda não está configurado.', 'error');
    if (submitButton) submitButton.disabled = true;
    return;
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (!error && data.session) await routeSession();
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
    showMessage('Não foi possível entrar. Confira o e-mail e a senha.', 'error');
    if (submitButton) submitButton.disabled = false;
    return;
  }

  const routed = await routeSession();
  if (!routed) {
    await supabaseClient.auth.signOut();
    showMessage('Esta conta não está autorizada como operador.', 'error');
    if (submitButton) submitButton.disabled = false;
  }
});
