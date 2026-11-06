import { supabaseClient, supabaseConfigured } from './supabase-client.js';

const message = document.getElementById('user-auth-message');
const loginForm = document.getElementById('user-login-form');
const signupForm = document.getElementById('user-signup-form');
const title = document.getElementById('auth-title');
const intro = document.getElementById('auth-intro');
const loginButton = document.querySelector('[data-auth-view="login"]');
const signupButton = document.querySelector('[data-auth-view="signup"]');

function showMessage(text, tone = '') {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle('is-error', tone === 'error');
  message.classList.toggle('is-success', tone === 'success');
}

function setView(view) {
  const isSignup = view === 'signup';
  loginForm.hidden = isSignup;
  signupForm.hidden = !isSignup;
  loginButton?.classList.toggle('is-active', !isSignup);
  signupButton?.classList.toggle('is-active', isSignup);
  loginButton?.setAttribute('aria-pressed', String(!isSignup));
  signupButton?.setAttribute('aria-pressed', String(isSignup));
  title.textContent = isSignup ? 'Criar conta de usuário' : 'Acesso do usuário';
  intro.textContent = isSignup
    ? 'Crie sua conta para cadastrar seu perfil e acompanhar seus pedidos.'
    : 'Entre para consultar seu perfil e seus pedidos.';
  showMessage('');
}

function safeNextPath() {
  const allowed = new Set(['minha-conta.html', 'entrar-fila.html', 'consultas.html']);
  const requested = new URLSearchParams(window.location.search).get('next');
  return allowed.has(requested) ? requested : 'minha-conta.html';
}

function messageForAuthError(error) {
  if (error?.code === 'email_address_not_authorized') {
    return 'Para este protótipo, use um e-mail cadastrado como membro da equipe do projeto Supabase.';
  }
  if (error?.code === 'over_email_send_rate_limit' || error?.status === 429) {
    return 'O limite de e-mails de confirmação foi atingido. Aguarde antes de tentar novamente.';
  }
  if (error?.code === 'weak_password') return 'Escolha uma senha mais forte.';
  if (error?.code === 'user_already_exists' || error?.code === 'email_exists') {
    return 'Não foi possível criar a conta com esse e-mail. Tente entrar ou use outro endereço.';
  }
  return 'Não foi possível concluir a operação. Confira os dados e tente novamente.';
}

async function routeSignedInUser() {
  const { data: role, error } = await supabaseClient.rpc('meu_papel');
  if (error || !role) {
    showMessage('Sua conta ainda não está habilitada. Fale com o responsável pelo projeto.', 'error');
    return;
  }
  window.location.replace(role === 'operator' ? 'operador.html' : safeNextPath());
}

loginButton?.addEventListener('click', () => setView('login'));
signupButton?.addEventListener('click', () => setView('signup'));

if (!supabaseConfigured || !supabaseClient) {
  showMessage('O acesso ao banco ainda não está configurado neste projeto.', 'error');
  [loginForm, signupForm].forEach((form) => {
    if (form) form.querySelector('button[type="submit"]').disabled = true;
  });
} else {
  const params = new URLSearchParams(window.location.search);
  if (params.has('verified')) {
    setView('login');
    showMessage('E-mail confirmado. Entre com seu e-mail e senha.', 'success');
  }

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) routeSignedInUser();
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    showMessage('Verificando acesso…');
    const formData = new FormData(loginForm);
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || '')
    });
    if (error) {
      showMessage(messageForAuthError(error), 'error');
      submit.disabled = false;
      return;
    }
    await routeSignedInUser();
  });

  signupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!signupForm.reportValidity()) return;
    const formData = new FormData(signupForm);
    const password = String(formData.get('password') || '');
    if (password !== String(formData.get('password_confirmation') || '')) {
      showMessage('As senhas não coincidem.', 'error');
      signupForm.querySelector('#user-signup-confirm')?.focus();
      return;
    }

    const submit = signupForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    showMessage('Criando sua conta…');
    const confirmationUrl = new URL('conta.html?verified=1', window.location.href).toString();
    const { data, error } = await supabaseClient.auth.signUp({
      email: String(formData.get('email') || '').trim(),
      password,
      options: { emailRedirectTo: confirmationUrl }
    });
    if (error) {
      showMessage(messageForAuthError(error), 'error');
      submit.disabled = false;
      return;
    }

    if (data.session) {
      await routeSignedInUser();
      return;
    }
    showMessage('Conta criada. Confira seu e-mail e confirme o endereço antes de entrar.', 'success');
    signupForm.reset();
    setView('login');
    showMessage('Conta criada. Confira seu e-mail e confirme o endereço antes de entrar.', 'success');
    submit.disabled = false;
  });
}
