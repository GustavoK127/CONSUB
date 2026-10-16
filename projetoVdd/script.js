// =========================================================
// ConSub — interações compartilhadas
// =========================================================

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

  /* ---------- Botão "Quero esta Vaga" ---------- */
  document.querySelectorAll('.btn-vaga').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.consulta-card');
      const specialty = card ? card.querySelector('h3').textContent : 'a consulta';
      alert('Solicitação enviada! Você receberá a confirmação de "' + specialty + '" por SMS em instantes.');
    });
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

});
