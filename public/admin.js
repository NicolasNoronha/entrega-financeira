const API_BASE_URL = (window.APP_CONFIG?.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, '');
const state = {
  token: localStorage.getItem('admin_token') || localStorage.getItem('token'),
  users: [],
  filter: ''
};

const elements = {
  login: document.querySelector('#admin-login'),
  panel: document.querySelector('#admin-panel'),
  form: document.querySelector('#admin-login-form'),
  message: document.querySelector('#admin-login-message'),
  users: document.querySelector('#admin-users'),
  toast: document.querySelector('#toast-message')
};

function apiUrl(path) {
  return path.startsWith('/api/') ? `${API_BASE_URL}${path.slice(4)}` : `${API_BASE_URL}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.message || 'Erro inesperado.');
  return data;
}

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden', 'toast-success', 'toast-error');
  elements.toast.classList.add(type === 'error' ? 'toast-error' : 'toast-success');
  setTimeout(() => elements.toast.classList.add('hidden'), 2600);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-';
}

function count(status) {
  return state.users.filter((user) => user.subscription_status === status).length;
}

function render() {
  document.querySelector('#count-active').textContent = count('active');
  document.querySelector('#count-trial').textContent = count('trial');
  document.querySelector('#count-expiring').textContent = state.users.filter((user) => user.expires_soon).length;
  document.querySelector('#count-total').textContent = state.users.length;

  elements.users.innerHTML = state.users.map((user) => `
    <article class="admin-user-card">
      <div class="admin-user-main">
        <div>
          <strong>${user.nome}</strong>
          <span>${user.email}</span>
        </div>
        <span class="admin-badge ${user.expires_soon ? 'warning' : ''}">${user.subscription_status}</span>
      </div>
      <div class="admin-user-meta">
        <span>Vence em <strong>${formatDate(user.access_expires_at)}</strong></span>
        <span><strong>${user.days_remaining}</strong> dias restantes</span>
      </div>
      <div class="admin-actions">
        <button data-grant="7" data-user="${user.id}" type="button">+7 dias</button>
        <button data-grant="30" data-user="${user.id}" type="button">+30 dias</button>
        <button data-status="active" data-user="${user.id}" type="button">Ativar</button>
        <button class="danger" data-status="canceled" data-user="${user.id}" type="button">Cancelar</button>
      </div>
    </article>
  `).join('');
}

async function loadUsers() {
  const qs = state.filter ? `?status=${state.filter}` : '';
  const data = await request(`/api/admin/users${qs}`);
  state.users = data.users;
  elements.login.classList.add('hidden');
  elements.panel.classList.remove('hidden');
  render();
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.message.textContent = '';
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#admin-email').value,
        senha: document.querySelector('#admin-password').value
      })
    });
    state.token = data.token;
    localStorage.setItem('admin_token', data.token);
    await loadUsers();
  } catch (error) {
    elements.message.textContent = error.message;
  }
});

document.addEventListener('click', async (event) => {
  const filterButton = event.target.closest('[data-admin-filter]');
  if (filterButton) {
    state.filter = filterButton.dataset.adminFilter;
    document.querySelectorAll('[data-admin-filter]').forEach((button) => button.classList.toggle('active', button === filterButton));
    await loadUsers();
    return;
  }

  const grantButton = event.target.closest('[data-grant]');
  if (grantButton) {
    await request(`/api/admin/users/${grantButton.dataset.user}/grant`, {
      method: 'POST',
      body: JSON.stringify({ days: Number(grantButton.dataset.grant), notes: 'Liberado manualmente pelo admin' })
    });
    showToast(`Liberado +${grantButton.dataset.grant} dias.`);
    await loadUsers();
    return;
  }

  const statusButton = event.target.closest('[data-status]');
  if (statusButton) {
    await request(`/api/admin/users/${statusButton.dataset.user}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusButton.dataset.status })
    });
    showToast('Status atualizado.');
    await loadUsers();
  }
});

if (state.token) {
  loadUsers().catch(() => localStorage.removeItem('admin_token'));
}