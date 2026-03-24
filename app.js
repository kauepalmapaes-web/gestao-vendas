// ============================================================
// GestãoPro — Main Application
// Supabase client, router, utilities
// ============================================================

// --- Supabase Config ---
const SUPABASE_URL = 'https://qfrsktdectlwlyfpsuzl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O2o2QthySnYnuqhW-Qxu_A_TlhQa4Ww';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Module Imports ---
import { renderDashboard } from './modules/dashboard.js';
import { renderClientes } from './modules/clientes.js';
import { renderProntuarios } from './modules/prontuarios.js';
import { renderVendas } from './modules/vendas.js';
import { renderServicos } from './modules/servicos.js';

// Make supabase available to modules
window.db = supabase;

// --- Auth State ---
let currentUser = null;

function updateAuthUI(session) {
  const overlay = document.getElementById('auth-overlay');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  
  if (session) {
    currentUser = session.user;
    overlay.classList.add('hidden');
    sidebar.style.display = 'flex';
    mainContent.style.display = 'flex';
    
    // Convert email back to username for display
    const username = currentUser.email.split('@')[0].toUpperCase();
    
    document.getElementById('user-email-display').textContent = username;
    document.getElementById('user-avatar-char').textContent = username.charAt(0);
    
    // Check if admin
    supabase.from('user_roles').select('role').eq('user_id', currentUser.id).single()
      .then(({data}) => {
        if (data && data.role === 'admin') {
          const ud = document.querySelector('.user-details');
          if (!document.getElementById('admin-badge')) {
            const b = document.createElement('span');
            b.id = 'admin-badge';
            b.className = 'badge badge-warning';
            b.style.fontSize = '10px';
            b.style.marginTop = '2px';
            b.textContent = 'ADMIN';
            ud.appendChild(b);
          }
        }
      });
      
    // Initial render on successful login
    navigate('dashboard');
  } else {
    currentUser = null;
    overlay.classList.remove('hidden');
    sidebar.style.display = 'none';
    mainContent.style.display = 'none';
  }
}

// Initial session check and subscribe
supabase.auth.getSession().then(({ data: { session } }) => {
  updateAuthUI(session);
});

supabase.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session);
});

// --- Router ---
const routes = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  clientes: { title: 'Clientes', render: renderClientes },
  prontuarios: { title: 'Prontuários', render: renderProntuarios },
  vendas: { title: 'Vendas', render: renderVendas },
  servicos: { title: 'Serviços & Produtos', render: renderServicos },
};

let currentPage = 'dashboard';

function navigate(page) {
  if (!routes[page]) return;
  currentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update title
  document.getElementById('page-title').textContent = routes[page].title;

  // Render page
  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  routes[page].render(content);

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('active');
}

// --- Modal System ---
window.openModal = function(title, bodyHTML, footerHTML = '') {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML;
  overlay.classList.add('active');
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('active');
  if (typeof window._resolveConfirm === 'function') {
    window._resolveConfirm(false);
  }
};

window.customConfirm = function(message, title = 'Confirmação') {
  return new Promise((resolve) => {
    const bodyHTML = `<div style="padding: 20px 10px; text-align: center; font-size: 1.1rem; color: var(--text-color);">${message}</div>`;
    const footerHTML = `
      <div style="display: flex; gap: 12px; justify-content: center; width: 100%;">
        <button class="btn btn-secondary" onclick="window._resolveConfirm(false)">Cancelar</button>
        <button class="btn btn-primary" onclick="window._resolveConfirm(true)">Confirmar</button>
      </div>
    `;
    
    window._resolveConfirm = (result) => {
      window._resolveConfirm = null;
      closeModal();
      resolve(result);
    };

    window.openModal(title, bodyHTML, footerHTML);
  });
};

// --- Toast System ---
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// --- Currency Formatter ---
window.formatCurrency = function(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

// --- Date Formatter ---
window.formatDate = function(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

// --- Refresh current page helper ---
window.refreshPage = function() {
  navigate(currentPage);
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });

  // Mobile menu toggle
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.toggle('active');
  });

  // Mobile sidebar overlay click
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // ESC closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // --- Auth Event Listeners ---
  let isLoginMode = true;
  const toggleBtn = document.getElementById('btn-auth-toggle');
  const submitBtn = document.getElementById('btn-auth-submit');
  const subtitle = document.getElementById('auth-subtitle');
  const toggleText = document.getElementById('auth-toggle-text');

  toggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      subtitle.textContent = 'Faça login para acessar o painel';
      submitBtn.textContent = 'Entrar';
      toggleText.textContent = 'Não tem uma conta?';
      toggleBtn.textContent = 'Cadastre-se';
    } else {
      subtitle.textContent = 'Crie sua conta para começar';
      submitBtn.textContent = 'Criar Conta';
      toggleText.textContent = 'Já tem uma conta?';
      toggleBtn.textContent = 'Fazer Login';
    }
  });

  submitBtn.addEventListener('click', async () => {
    let username = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value;

    if (!username || !password) {
      showToast('Preencha usuário e senha', 'warning');
      return;
    }
    
    // Append dummy domain to use Supabase Auth with usernames
    const email = `${username}@gestaopro.com.br`;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Aguarde...';

    const { error } = isLoginMode 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      showToast('Erro: ' + error.message, 'error');
    } else if (!isLoginMode) {
      showToast('Cadastro realizado! Faça login.', 'success');
      toggleBtn.click(); // switch to login mode
    } else {
      showToast('Login efetuado!', 'success');
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = isLoginMode ? 'Entrar' : 'Criar Conta';
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    showToast('Você saiu do sistema', 'info');
  });

});
