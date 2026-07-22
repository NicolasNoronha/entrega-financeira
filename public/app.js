const pageParams = new URLSearchParams(window.location.search);

const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  mode: 'login',
  type: 'Receita',
  view: 'dashboard',
  vehicles: [],
  transactions: [],
  routeSuggestions: [],
  visibleTransactions: 10,
  categoryPeriod: 'mes',
  subscription: null,
  editingTransactionId: null,
  editingVehicleId: null,
  paymentReturn: pageParams.get('payment'),
  paymentId: pageParams.get('payment_id') || pageParams.get('collection_id'),
  paymentReturnHandled: false
};

const LOCKED_VIEW = 'subscription';

const categories = {
  Receita: ['Rota', 'Shopee', 'Bonus', 'Diaria', 'Reembolso', 'Outros ganhos'],
  Despesa: ['Combustivel', 'Manutencao', 'Alimentacao', 'Internet/Celular', 'Pedagio', 'Estacionamento', 'Multas', 'Lavagem', 'Equipamentos', 'Outros gastos']
};

const API_BASE_URL = (window.APP_CONFIG?.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, '');

function apiUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/api/')) return `${API_BASE_URL}${path.slice(4)}`;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

async function openExternalUrl(url) {
  const capacitorBrowser = window.Capacitor?.Plugins?.Browser;

  if (capacitorBrowser?.open) {
    await capacitorBrowser.open({ url });
    return;
  }

  window.location.href = url;
}

const api = {
  async request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {})
      }
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'Erro inesperado.');
      error.status = response.status;
      error.code = data.code;
      if (response.status === 402 || data.code === 'SUBSCRIPTION_EXPIRED') {
        handleSubscriptionExpired(error.message);
      }
      throw error;
    }

    return data;
  }
};

const elements = {
  authScreen: document.querySelector('#auth-screen'),
  appScreen: document.querySelector('#app-screen'),
  loginTab: document.querySelector('#login-tab'),
  registerTab: document.querySelector('#register-tab'),
  authTitle: document.querySelector('#auth-title'),
  authCopy: document.querySelector('#auth-copy'),
  authSubmit: document.querySelector('#auth-submit'),
  nameField: document.querySelector('#name-field'),
  authForm: document.querySelector('#auth-form'),
  authMessage: document.querySelector('#auth-message'),
  rememberEmail: document.querySelector('#remember-email'),
  toast: document.querySelector('#toast-message'),
  pullRefresh: document.querySelector('#pull-refresh'),
  userName: document.querySelector('#user-name'),
  logoutButton: document.querySelector('#logout-button'),
  installButton: document.querySelector('#install-button'),
  offlineBanner: document.querySelector('#offline-banner'),
  transactionForm: document.querySelector('#transaction-form'),
  transactionMessage: document.querySelector('#transaction-message'),
  transactionList: document.querySelector('#transaction-list'),
  transactionCount: document.querySelector('#transaction-count'),
  transactionFilterDate: document.querySelector('#transaction-filter-date'),
  showMoreTransactions: document.querySelector('#show-more-transactions'),
  subscriptionCard: document.querySelector('#subscription-card'),
  subscriptionTitle: document.querySelector('#subscription-title'),
  subscriptionCopy: document.querySelector('#subscription-copy'),
  subscriptionBadge: document.querySelector('#subscription-badge'),
  subscriptionStatusLabel: document.querySelector('#subscription-status-label'),
  subscriptionDaysLabel: document.querySelector('#subscription-days-label'),
  subscriptionTrialEnd: document.querySelector('#subscription-trial-end'),
  subscriptionAccessEnd: document.querySelector('#subscription-access-end'),
  renewSubscription: document.querySelector('#renew-subscription'),
  category: document.querySelector('#category'),
  reportCategory: document.querySelector('#report-category'),
  transactionVehicle: document.querySelector('#transaction-vehicle'),
  reportVehicle: document.querySelector('#report-vehicle'),
  routeOptions: document.querySelector('#route-options'),
  routeName: document.querySelector('#route-name'),
  cityField: document.querySelector('#city-field'),
  cityNeighborhood: document.querySelector('#city-neighborhood'),
  packagesReceived: document.querySelector('#packages-received'),
  routeHours: document.querySelector('#route-hours'),
  periodField: document.querySelector('#period-field'),
  receivedPackagesField: document.querySelector('#received-packages-field'),
  deliveredPackagesField: document.querySelector('#delivered-packages-field'),
  routeHoursField: document.querySelector('#route-hours-field'),
  transactionSubmit: document.querySelector('#transaction-submit'),
  transactionCancelEdit: document.querySelector('#transaction-cancel-edit'),
  categoryPeriodLabel: document.querySelector('#category-period-label'),
  expenseShortcuts: document.querySelector('#expense-shortcuts'),
  date: document.querySelector('#date'),
  kmStart: document.querySelector('#km-start'),
  kmEnd: document.querySelector('#km-end'),
  kmTotal: document.querySelector('#km-total'),
  reportForm: document.querySelector('#report-form'),
  vehicleForm: document.querySelector('#vehicle-form'),
  vehicleList: document.querySelector('#vehicle-list'),
  vehicleCount: document.querySelector('#vehicle-count'),
  vehicleMessage: document.querySelector('#vehicle-message'),
  vehicleSubmit: document.querySelector('#vehicle-submit'),
  vehicleCancelEdit: document.querySelector('#vehicle-cancel-edit'),
  simulatorForm: document.querySelector('#simulator-form'),
  routeKmFields: document.querySelector('#route-km-fields'),
  routeFields: document.querySelector('#route-fields'),
  packageVehicleFields: document.querySelector('#package-vehicle-fields')
};

let deferredInstallPrompt = null;

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function showToast(message, type = 'success') {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden', 'toast-success', 'toast-error');
  elements.toast.classList.add(type === 'error' ? 'toast-error' : 'toast-success');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2800);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatKm(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function fillSelect(select, options, placeholder = null) {
  if (!select) return;

  select.innerHTML = '';

  if (placeholder) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }

  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value ?? item;
    option.textContent = item.label ?? item;
    select.appendChild(option);
  });
}

function updateCategorySelects() {
  fillSelect(elements.category, categories[state.type]);
  fillSelect(elements.reportCategory, [...categories.Receita, ...categories.Despesa], 'Todas');
}

function updateVehicleSelects() {
  const vehicleOptions = state.vehicles.map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.modelo}${vehicle.placa ? ` - ${vehicle.placa}` : ''}`
  }));

  fillSelect(elements.transactionVehicle, vehicleOptions, 'Sem veiculo');
  fillSelect(elements.reportVehicle, vehicleOptions, 'Todos');

  if (state.vehicles.length === 1) {
    elements.transactionVehicle.value = state.vehicles[0].id;
  }
}

async function updateRouteSuggestions() {
  if (!elements.routeOptions) return;

  const selectedDate = elements.date?.value;
  let source = state.transactions;
  let routes = source
    .filter((item) => item.tipo === 'Receita')
    .filter((item) => !selectedDate || String(item.data).slice(0, 10) === selectedDate)
    .filter((item) => item.rota_nome);

  if (selectedDate && state.token && routes.length === 0) {
    try {
      const data = await api.request(`/api/transactions?startDate=${selectedDate}&endDate=${selectedDate}`);
      source = data.transactions;
      routes = source.filter((item) => item.tipo === 'Receita' && item.rota_nome);
    } catch (error) {
      routes = [];
    }
  }

  routes = routes.map((item) => ({
    rota: item.rota_nome,
    cidade: item.cidade_bairro || ''
  }));
  const unique = Array.from(new Map(routes.map((item) => [`${item.rota}|${item.cidade}`, item])).values());
  state.routeSuggestions = unique;

  elements.routeOptions.innerHTML = unique
    .map((item) => `<option value="${item.rota}">${item.cidade}</option>`)
    .join('');

  if (state.type === 'Despesa' && unique.length === 1 && !elements.routeName.value) {
    elements.routeName.value = unique[0].rota;
    elements.cityNeighborhood.value = unique[0].cidade;
  }
}

function findRouteInfo(date, routeName) {
  const normalizedRoute = String(routeName || '').trim().toLowerCase();
  const suggested = state.routeSuggestions.find((item) => String(item.rota || '').trim().toLowerCase() === normalizedRoute);
  if (suggested) return { rota_nome: suggested.rota, cidade_bairro: suggested.cidade };

  return state.transactions.find((item) => (
    item.tipo === 'Receita'
    && String(item.data).slice(0, 10) === date
    && String(item.rota_nome || '').trim().toLowerCase() === normalizedRoute
  ));
}

function syncCityFromRoute() {
  if (state.type !== 'Despesa') return;
  const route = findRouteInfo(elements.date.value, elements.routeName.value);
  elements.cityNeighborhood.value = route?.cidade_bairro || '';
}

function setMode(mode) {
  state.mode = mode;
  elements.loginTab.classList.toggle('active', mode === 'login');
  elements.registerTab.classList.toggle('active', mode === 'register');
  elements.nameField.classList.toggle('hidden', mode === 'login');
  elements.authTitle.textContent = mode === 'login' ? 'Acessar painel' : 'Criar conta';
  elements.authCopy.textContent = mode === 'login'
    ? 'Veja lucro, km e despesas sem abrir planilha.'
    : 'Cadastre seus dados para comecar a registrar receitas e despesas.';
  elements.authSubmit.textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
  document.querySelector('#password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  elements.authMessage.textContent = '';
}

function showApp() {
  elements.authScreen.classList.toggle('hidden', Boolean(state.token));
  elements.appScreen.classList.toggle('hidden', !state.token);
  elements.userName.textContent = state.user?.nome || 'Entregador';
}

function persistSession({ token, user }) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showApp();
}

function setTransactionType(type) {
  state.type = type;
  document.querySelectorAll('.type-button').forEach((item) => {
    item.classList.toggle('active', item.dataset.type === type);
  });
  elements.expenseShortcuts.classList.toggle('hidden', type !== 'Despesa');
  elements.routeKmFields?.classList.toggle('hidden', type !== 'Receita');
  elements.periodField?.classList.toggle('hidden', type !== 'Receita');
  elements.receivedPackagesField?.classList.toggle('hidden', type !== 'Receita');
  elements.deliveredPackagesField?.classList.toggle('hidden', type !== 'Receita');
  elements.routeHoursField?.classList.toggle('hidden', type !== 'Receita');
  elements.cityField?.classList.toggle('hidden', type === 'Despesa');
  document.querySelector('#amount').required = true;
  document.querySelector('#amount').placeholder = '0,00';
  updateCategorySelects();
  updateRouteSuggestions().then(syncCityFromRoute);
}

function setView(view) {
  if (isSubscriptionLocked() && view !== LOCKED_VIEW) {
    view = LOCKED_VIEW;
  }

  state.view = view;
  const viewExists = Boolean(document.querySelector(`.app-view[data-view="${view}"]`));
  const nextView = viewExists ? view : 'dashboard';
  state.view = nextView;

  document.querySelectorAll('.app-view').forEach((section) => {
    section.classList.toggle('hidden', section.dataset.view !== nextView);
  });
  document.querySelectorAll('.nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.nav === nextView);
  });
}

function isSubscriptionLocked() {
  return Boolean(state.token && state.subscription && !state.subscription.is_active);
}

function handleSubscriptionExpired(message) {
  state.subscription = {
    ...(state.subscription || {}),
    subscription_status: 'expired',
    is_active: false,
    days_remaining: 0
  };
  renderSubscription();
  setView(LOCKED_VIEW);
  showToast(message || 'Renove para continuar usando o app.', 'error');
}

async function syncPaymentReturn() {
  if (!state.paymentReturn || !state.paymentId || state.paymentReturn === 'failure') return null;

  try {
    const data = await api.request('/api/subscription/sync-payment', {
      method: 'POST',
      body: JSON.stringify({ payment_id: state.paymentId })
    });

    if (data.subscription) {
      state.subscription = data.subscription;
      renderSubscription();
    }

    return data;
  } catch (error) {
    showToast('Pagamento recebido, mas a confirmacao ainda esta em processamento.', 'error');
    return null;
  }
}

async function handlePaymentReturn() {
  if (!state.paymentReturn || state.paymentReturnHandled) return;

  state.paymentReturnHandled = true;
  setView(LOCKED_VIEW);
  const syncResult = await syncPaymentReturn();

  const messages = {
    success: syncResult?.processed || state.subscription?.is_active
      ? 'Assinatura renovada com sucesso. Acesso liberado!'
      : 'Pagamento aprovado. Estamos atualizando sua assinatura.',
    pending: 'Pagamento em processamento. Assim que aprovar, o acesso sera liberado.',
    failure: 'Pagamento nao concluido. Voce pode tentar renovar novamente.'
  };
  const isFailure = state.paymentReturn === 'failure';

  showToast(messages[state.paymentReturn] || 'Retorno de pagamento recebido.', isFailure ? 'error' : 'success');

  if (window.history?.replaceState && window.location.pathname === '/app') {
    window.history.replaceState({}, document.title, '/app');
  }
}

function updateSubscriptionLock() {
  const locked = isSubscriptionLocked();
  elements.appScreen.classList.toggle('is-subscription-locked', locked);

  document.querySelectorAll('.nav-button').forEach((button) => {
    const blocked = locked && button.dataset.nav !== LOCKED_VIEW;
    button.disabled = blocked;
    button.setAttribute('aria-disabled', String(blocked));
  });

  if (locked && state.view !== LOCKED_VIEW) {
    setView(LOCKED_VIEW);
  }
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function renderSubscription() {
  const sub = state.subscription;
  if (!sub || !elements.subscriptionCard) return;

  elements.subscriptionCard.classList.remove('hidden');
  elements.subscriptionTitle.textContent = sub.subscription_status === 'trial'
    ? 'Teste gratis ativo'
    : sub.subscription_status === 'active'
      ? 'Assinatura ativa'
      : sub.subscription_status === 'canceled'
        ? 'Assinatura cancelada'
        : 'Acesso expirado';
  elements.subscriptionCopy.textContent = sub.is_active
    ? `Seu acesso vence em ${formatDate(sub.access_expires_at)} (${sub.days_remaining} dias).`
    : 'Seu acesso expirou. Renove para continuar usando o app.';
  elements.subscriptionBadge.textContent = !sub.is_active
    ? 'Renovacao necessaria'
    : sub.days_remaining <= 3
      ? 'Vence em breve'
      : sub.subscription_status;
  elements.subscriptionBadge.classList.toggle('badge-warning', !sub.is_active || sub.days_remaining <= 3);
  elements.subscriptionStatusLabel.textContent = sub.subscription_status === 'trial'
    ? 'Teste gratis'
    : sub.subscription_status === 'active'
      ? 'Pro ativo'
      : sub.subscription_status === 'canceled'
        ? 'Cancelado'
        : 'Expirado';
  elements.subscriptionDaysLabel.textContent = String(sub.days_remaining || 0);
  if (elements.subscriptionTrialEnd) elements.subscriptionTrialEnd.textContent = formatDate(sub.trial_ends_at);
  if (elements.subscriptionAccessEnd) elements.subscriptionAccessEnd.textContent = formatDate(sub.access_expires_at);
  updateSubscriptionLock();

  if (sub.is_active && sub.days_remaining <= 3) {
    showToast(`Sua assinatura vence em ${sub.days_remaining} dias.`, 'error');
  }
}

async function loadSubscription() {
  const data = await api.request('/api/subscription/status');
  state.subscription = data.subscription;
  renderSubscription();
}
async function loadDashboard() {
  const data = await api.request(`/api/transactions/dashboard?period=${state.categoryPeriod}`);
  const summary = data.summary;
  const periodLabels = { dia: 'Hoje', semana: '7 dias', mes: 'Mes atual' };

  setText('#today-revenue', currency.format(summary.receita_hoje));
  setText('#today-expense', currency.format(summary.despesa_hoje));
  setText('#today-profit', currency.format(summary.lucro_hoje));
  setText('#month-revenue', currency.format(summary.receita_mes));
  setText('#month-expense', currency.format(summary.despesa_mes));
  setText('#month-profit', currency.format(summary.lucro_mes));
  setText('#month-km', formatKm(summary.km_mes));
  setText('#profit-km', currency.format(summary.lucro_por_km));
  setText('#cost-km', currency.format(summary.gasto_por_km));
  document.querySelector('#alert-box').classList.toggle('hidden', !summary.alerta_despesa);

  if (elements.categoryPeriodLabel) elements.categoryPeriodLabel.textContent = periodLabels[state.categoryPeriod] || 'Mes atual';
  renderBars('#category-summary', summary.gastos_por_categoria, 'Sem despesas no periodo.');
}

function transactionTemplate(transaction) {
  const valueClass = transaction.tipo === 'Receita' ? 'text-emerald-300' : 'text-rose-300';
  const received = transaction.pacotes_recebidos ? ` - ${transaction.pacotes_recebidos} recebidos` : '';
  const packages = transaction.quantidade_pacotes ? ` - ${transaction.quantidade_pacotes} entregues` : '';
  const route = transaction.rota_nome ? ` - ${transaction.rota_nome}` : '';
  const city = transaction.cidade_bairro ? ` - ${transaction.cidade_bairro}` : '';
  const hours = transaction.horas_rota ? ` - ${Number(transaction.horas_rota).toLocaleString('pt-BR')}h` : '';
  const km = transaction.km_total ? ` - ${formatKm(transaction.km_total)} km` : '';

  return `
    <article class="transaction-item">
      <div>
        <strong>${transaction.descricao}</strong>
        <span>${new Date(transaction.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${transaction.categoria || 'Sem categoria'}${route}${city}${received}${packages}${hours}${km}</span>
      </div>
      <div class="text-right">
        <strong class="${valueClass}">${currency.format(Number(transaction.valor))}</strong>
        <button class="secondary-button mt-2" data-edit="${transaction.id}" type="button">Editar</button>
        <button class="delete-button mt-2" data-delete="${transaction.id}" type="button" aria-label="Excluir">x</button>
      </div>
    </article>
  `;
}

function renderTransactions() {
  const visible = state.transactions.slice(0, state.visibleTransactions);
  elements.transactionList.innerHTML = visible.map(transactionTemplate).join('');
  elements.transactionCount.textContent = `${state.transactions.length} itens`;
  elements.showMoreTransactions?.classList.toggle('hidden', state.visibleTransactions >= state.transactions.length);
  updateRouteSuggestions();
}

async function loadTransactions() {
  const selectedDate = elements.transactionFilterDate?.value;
  const query = selectedDate
    ? `startDate=${selectedDate}&endDate=${selectedDate}`
    : 'period=mes';
  const data = await api.request(`/api/transactions?${query}`);
  state.transactions = data.transactions;
  renderTransactions();
}

async function loadVehicles() {
  const data = await api.request('/api/vehicles');
  state.vehicles = data.vehicles;
  updateVehicleSelects();
  renderVehicles();
}

function renderVehicles() {
  elements.vehicleCount.textContent = `${state.vehicles.length} itens`;
  elements.vehicleList.innerHTML = state.vehicles.map((vehicle) => `
    <article class="list-item">
      <div>
        <strong>${vehicle.modelo}</strong>
        <span>${vehicle.tipo}${vehicle.placa ? ` - ${vehicle.placa}` : ''} - ${vehicle.consumo_medio || 0} km/L</span>
      </div>
      <div class="text-right">
        <button class="secondary-button" data-edit-vehicle="${vehicle.id}" type="button">Editar</button>
        <button class="delete-button mt-2" data-delete-vehicle="${vehicle.id}" type="button" aria-label="Excluir">x</button>
      </div>
    </article>
  `).join('');
}

function renderBars(selector, items, emptyText) {
  const container = document.querySelector(selector);
  if (!items || items.length === 0) {
    container.innerHTML = `<p class="text-sm text-zinc-400">${emptyText}</p>`;
    return;
  }

  const max = Math.max(...items.map((item) => Math.abs(Number(item.total || item.lucro || 0))), 1);
  container.innerHTML = items.map((item) => {
    const total = Number(item.total ?? item.lucro ?? 0);
    const width = Math.max((Math.abs(total) / max) * 100, 4);
    return `
      <div class="bar-row">
        <div class="flex items-center justify-between gap-2 text-sm">
          <strong class="text-zinc-100">${item.categoria || item.label || item.rota}</strong>
          <span class="text-zinc-400">${currency.format(total)}</span>
        </div>
        <div class="bar-line"><span style="width:${width}%"></span></div>
      </div>
    `;
  }).join('');
}

async function refresh() {
  await loadSubscription();

  if (state.paymentReturn) {
    await handlePaymentReturn();
  }

  if (isSubscriptionLocked()) {
    setView(LOCKED_VIEW);
    return;
  }

  await Promise.allSettled([loadDashboard(), loadTransactions(), loadVehicles()]);
}

let manualRefreshRunning = false;

async function manualRefresh() {
  if (!state.token || manualRefreshRunning) return;

  manualRefreshRunning = true;
  if (elements.pullRefresh) {
    elements.pullRefresh.textContent = 'Atualizando...';
    elements.pullRefresh.classList.remove('hidden', 'ready');
    elements.pullRefresh.classList.add('visible', 'loading');
  }

  try {
    await refresh();
    if (!isSubscriptionLocked()) {
      await loadReport();
    }
    showToast('App atualizado.');
  } catch (error) {
    showToast(error.message || 'Nao foi possivel atualizar agora.', 'error');
  } finally {
    manualRefreshRunning = false;
    if (elements.pullRefresh) {
      elements.pullRefresh.classList.remove('visible', 'loading', 'ready');
      elements.pullRefresh.classList.add('hidden');
      elements.pullRefresh.textContent = 'Solte para atualizar';
    }
  }
}

let lastSubscriptionFocusRefresh = 0;

async function refreshSubscriptionAfterReturn() {
  if (!state.token) return;

  const now = Date.now();
  if (now - lastSubscriptionFocusRefresh < 3000) return;
  lastSubscriptionFocusRefresh = now;

  const wasLocked = isSubscriptionLocked();
  await loadSubscription();

  if (wasLocked && !isSubscriptionLocked()) {
    showToast('Assinatura atualizada. Acesso liberado!');
    await Promise.allSettled([loadDashboard(), loadTransactions(), loadVehicles()]);
  }
}

async function loadReport(event) {
  if (event) event.preventDefault();

  const params = new URLSearchParams();
  const startDate = document.querySelector('#report-start').value;
  const endDate = document.querySelector('#report-end').value;
  const category = elements.reportCategory.value;
  const vehicle = elements.reportVehicle.value;
  const route = document.querySelector('#report-route').value;

  if (startDate && endDate) {
    params.set('startDate', startDate);
    params.set('endDate', endDate);
  } else {
    params.set('period', 'mes');
  }
  if (category) params.set('categoria', category);
  if (vehicle) params.set('veiculo_id', vehicle);
  if (route) params.set('rota', route);

  const report = await api.request(`/api/transactions/reports?${params.toString()}`);
  const summary = report.summary;

  setText('#report-revenue', currency.format(summary.receita_total));
  setText('#report-expense', currency.format(summary.despesa_total));
  setText('#report-profit', currency.format(summary.lucro_liquido));
  setText('#report-daily-average', currency.format(summary.media_lucro_por_dia));
  setText('#report-km', formatKm(summary.km_total));
  setText('#report-hourly', currency.format(summary.ganho_por_hora));
  renderBars('#report-categories', report.despesas_por_categoria, 'Sem despesas no periodo.');
  renderBars('#report-routes', report.lucro_por_rota, 'Sem rotas no periodo.');
}

function updateKmTotal() {
  const start = Number(elements.kmStart.value || 0);
  const end = Number(elements.kmEnd.value || 0);
  elements.kmTotal.value = end > start ? (end - start).toFixed(1) : '';
}

elements.loginTab.addEventListener('click', () => setMode('login'));
elements.registerTab.addEventListener('click', () => setMode('register'));

elements.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.authMessage.textContent = '';

  const body = {
    email: document.querySelector('#email').value,
    senha: document.querySelector('#password').value
  };

  if (state.mode === 'register') {
    body.nome = document.querySelector('#name').value;
  }

  try {
    const endpoint = state.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const data = await api.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    persistSession(data);
    showApp();
    await refresh();
    await loadReport();
  } catch (error) {
    elements.authMessage.textContent = error.message;
  }
});

document.querySelectorAll('.type-button').forEach((button) => {
  button.addEventListener('click', () => setTransactionType(button.dataset.type));
});

document.addEventListener('click', (event) => {
  const navButton = event.target.closest('[data-nav]');
  if (!navButton) return;

  event.preventDefault();
  setView(navButton.dataset.nav);
});

document.querySelectorAll('[data-category-period]').forEach((button) => {
  button.addEventListener('click', async () => {
    state.categoryPeriod = button.dataset.categoryPeriod;
    document.querySelectorAll('[data-category-period]').forEach((item) => {
      item.classList.toggle('active', item === button);
    });
    await loadDashboard();
  });
});

document.querySelectorAll('.shortcut-button').forEach((button) => {
  button.addEventListener('click', () => {
    setTransactionType('Despesa');
    document.querySelector('#amount').value = button.dataset.value;
    elements.category.value = button.dataset.category;
  });
});

elements.kmStart.addEventListener('input', updateKmTotal);
elements.kmEnd.addEventListener('input', updateKmTotal);
elements.date.addEventListener('change', async () => {
  await updateRouteSuggestions();
  syncCityFromRoute();
});
elements.routeName.addEventListener('input', syncCityFromRoute);
elements.transactionFilterDate?.addEventListener('change', async () => {
  state.visibleTransactions = 10;
  await loadTransactions();
});

function resetTransactionForm() {
  state.editingTransactionId = null;
  elements.transactionForm.reset();
  elements.date.value = today();
  elements.transactionSubmit.textContent = 'Salvar lancamento';
  elements.transactionCancelEdit?.classList.add('hidden');
  setTransactionType('Receita');
  if (state.vehicles.length === 1) {
    elements.transactionVehicle.value = state.vehicles[0].id;
  }
}

function editTransaction(transaction) {
  state.editingTransactionId = transaction.id;
  setTransactionType(transaction.tipo);
  document.querySelector('#amount').value = transaction.valor ?? '';
  document.querySelector('#date').value = String(transaction.data).slice(0, 10);
  elements.category.value = transaction.categoria || '';
  elements.cityNeighborhood.value = transaction.cidade_bairro || '';
  document.querySelector('#route-name').value = transaction.rota_nome || '';
  document.querySelector('#period-shift').value = transaction.periodo || '';
  elements.packagesReceived.value = transaction.pacotes_recebidos || '';
  document.querySelector('#packages').value = transaction.quantidade_pacotes || '';
  elements.routeHours.value = transaction.horas_rota || '';
  elements.transactionVehicle.value = transaction.veiculo_id || '';
  elements.kmStart.value = transaction.km_inicial || '';
  elements.kmEnd.value = transaction.km_final || '';
  elements.kmTotal.value = transaction.km_total || '';
  elements.transactionSubmit.textContent = 'Salvar alteracoes';
  elements.transactionCancelEdit?.classList.remove('hidden');
  setView('entry');
}

elements.transactionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.transactionMessage.textContent = '';

  const routeInfo = state.type === 'Despesa'
    ? findRouteInfo(elements.date.value, elements.routeName.value)
    : null;
  const cityNeighborhood = state.type === 'Despesa'
    ? (routeInfo?.cidade_bairro || elements.cityNeighborhood.value || '')
    : elements.cityNeighborhood.value;

  const body = {
    tipo: state.type,
    valor: document.querySelector('#amount').value,
    data: document.querySelector('#date').value,
    categoria: elements.category.value,
    descricao: cityNeighborhood || elements.category.value || state.type,
    cidade_bairro: cityNeighborhood,
    rota_nome: elements.routeName.value,
    periodo: state.type === 'Receita' ? document.querySelector('#period-shift').value || null : null,
    pacotes_recebidos: state.type === 'Receita' ? elements.packagesReceived.value || null : null,
    quantidade_pacotes: state.type === 'Receita' ? document.querySelector('#packages').value || null : null,
    horas_rota: state.type === 'Receita' ? elements.routeHours.value || null : null,
    veiculo_id: elements.transactionVehicle.value || null,
    km_inicial: elements.kmStart.value || null,
    km_final: elements.kmEnd.value || null,
    km_total: elements.kmTotal.value || null
  };

  try {
    const wasEditing = Boolean(state.editingTransactionId);
    const endpoint = state.editingTransactionId ? `/api/transactions/${state.editingTransactionId}` : '/api/transactions';
    await api.request(endpoint, {
      method: state.editingTransactionId ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    resetTransactionForm();
    elements.transactionMessage.textContent = wasEditing ? 'Lancamento editado.' : 'Lancamento salvo.';
    showToast('Lancamento realizado com sucesso.');
    await refresh();
  } catch (error) {
    elements.transactionMessage.textContent = error.message;
  }
});

elements.transactionCancelEdit?.addEventListener('click', resetTransactionForm);

elements.showMoreTransactions?.addEventListener('click', () => {
  state.visibleTransactions += 10;
  renderTransactions();
});

elements.transactionList.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    const transaction = state.transactions.find((item) => item.id === editButton.dataset.edit);
    if (transaction) editTransaction(transaction);
    return;
  }

  const button = event.target.closest('[data-delete]');
  if (!button) return;

  await api.request(`/api/transactions/${button.dataset.delete}`, { method: 'DELETE' });
  await refresh();
});

elements.reportForm.addEventListener('submit', loadReport);

elements.vehicleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.vehicleMessage.textContent = '';

  const body = {
    tipo: document.querySelector('#vehicle-type').value,
    modelo: document.querySelector('#vehicle-model').value,
    placa: document.querySelector('#vehicle-plate').value,
    consumo_medio: document.querySelector('#vehicle-consumption').value || null,
    tipo_combustivel: document.querySelector('#vehicle-fuel-type').value,
    valor_medio_combustivel: document.querySelector('#vehicle-fuel-price').value || null
  };

  try {
    const wasEditing = Boolean(state.editingVehicleId);
    const endpoint = state.editingVehicleId ? `/api/vehicles/${state.editingVehicleId}` : '/api/vehicles';
    await api.request(endpoint, {
      method: state.editingVehicleId ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    resetVehicleForm();
    elements.vehicleMessage.textContent = wasEditing ? 'Veiculo editado.' : 'Veiculo salvo.';
    showToast('Veiculo cadastrado com sucesso.');
    await loadVehicles();
  } catch (error) {
    elements.vehicleMessage.textContent = error.message;
  }
});

function resetVehicleForm() {
  state.editingVehicleId = null;
  elements.vehicleForm.reset();
  elements.vehicleSubmit.textContent = 'Salvar veiculo';
  elements.vehicleCancelEdit?.classList.add('hidden');
}

function editVehicle(vehicle) {
  state.editingVehicleId = vehicle.id;
  document.querySelector('#vehicle-type').value = vehicle.tipo || 'Moto';
  document.querySelector('#vehicle-model').value = vehicle.modelo || '';
  document.querySelector('#vehicle-plate').value = vehicle.placa || '';
  document.querySelector('#vehicle-consumption').value = vehicle.consumo_medio || '';
  document.querySelector('#vehicle-fuel-type').value = vehicle.tipo_combustivel || 'Gasolina';
  document.querySelector('#vehicle-fuel-price').value = vehicle.valor_medio_combustivel || '';
  elements.vehicleSubmit.textContent = 'Salvar alteracoes';
  elements.vehicleCancelEdit?.classList.remove('hidden');
}

elements.vehicleCancelEdit?.addEventListener('click', resetVehicleForm);

elements.vehicleList.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-vehicle]');
  if (editButton) {
    const vehicle = state.vehicles.find((item) => item.id === editButton.dataset.editVehicle);
    if (vehicle) editVehicle(vehicle);
    return;
  }

  const button = event.target.closest('[data-delete-vehicle]');
  if (!button) return;

  await api.request(`/api/vehicles/${button.dataset.deleteVehicle}`, { method: 'DELETE' });
  await loadVehicles();
});

elements.simulatorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const packages = Number(document.querySelector('#sim-packages').value || 0);
  const packageRate = Number(document.querySelector('#sim-package-rate').value || 0);
  const km = Number(document.querySelector('#sim-km').value || 0);
  const toll = Number(document.querySelector('#sim-toll').value || 0);
  const consumption = Number(document.querySelector('#sim-consumption').value || 0);
  const fuelPrice = Number(document.querySelector('#sim-fuel-price').value || 0);
  const extraCost = Number(document.querySelector('#sim-extra-cost').value || 0);
  const grossRevenue = (packages * packageRate) + toll;
  const fuelCost = consumption > 0 ? (km / consumption) * fuelPrice : 0;
  const profit = grossRevenue - fuelCost - extraCost;
  const revenueKm = km > 0 ? grossRevenue / km : 0;
  const profitPackage = packages > 0 ? profit / packages : 0;

  setText('#sim-gross-revenue', currency.format(grossRevenue));
  setText('#sim-fuel-cost', currency.format(fuelCost));
  setText('#sim-profit', currency.format(profit));
  setText('#sim-revenue-km', currency.format(revenueKm));
  setText('#sim-profit-package', currency.format(profitPackage));

  const decision = document.querySelector('#sim-decision');
  const goodRoute = profit > 0 && profitPackage >= 1.5 && revenueKm >= 1.2;
  decision.textContent = goodRoute
    ? 'Vale a pena: lucro por pacote e receita por km estao saudaveis.'
    : 'Atencao: margem apertada. Ajuste valor por pacote, km ou custos antes de aceitar.';
  decision.className = goodRoute
    ? 'mt-3 rounded-lg border border-emerald-400/40 bg-emerald-950/40 p-3 text-sm text-emerald-100'
    : 'mt-3 rounded-lg border border-amber-400/40 bg-amber-950/40 p-3 text-sm text-amber-100';
});


elements.renewSubscription?.addEventListener('click', async () => {
  try {
    const data = await api.request('/api/subscription/renew', {
      method: 'POST',
      body: JSON.stringify({ amount: 1, days: 30 })
    });

    if (data.payment_url) {
      await openExternalUrl(data.payment_url);
      return;
    }

    showToast(data.message || 'Pagamento criado.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.logoutButton.addEventListener('click', clearSession);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installButton.classList.remove('hidden');
});

elements.installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installButton.classList.add('hidden');
});

function updateConnectionStatus() {
  elements.offlineBanner.classList.toggle('hidden', navigator.onLine);
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('focus', () => {
  refreshSubscriptionAfterReturn().catch(() => {});
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshSubscriptionAfterReturn().catch(() => {});
  }
});

let pullStartY = 0;
let pullDistance = 0;
let pullTracking = false;

function resetPullRefresh() {
  pullStartY = 0;
  pullDistance = 0;
  pullTracking = false;
  if (!elements.pullRefresh || manualRefreshRunning) return;
  elements.pullRefresh.classList.add('hidden');
  elements.pullRefresh.classList.remove('visible', 'ready');
  elements.pullRefresh.textContent = 'Solte para atualizar';
}

document.addEventListener('touchstart', (event) => {
  if (!state.token || window.scrollY > 2 || manualRefreshRunning) return;

  pullStartY = event.touches[0].clientY;
  pullTracking = true;
}, { passive: true });

document.addEventListener('touchmove', (event) => {
  if (!pullTracking || !elements.pullRefresh) return;

  pullDistance = event.touches[0].clientY - pullStartY;
  if (pullDistance <= 18) return;

  elements.pullRefresh.classList.remove('hidden');
  elements.pullRefresh.classList.add('visible');
  elements.pullRefresh.classList.toggle('ready', pullDistance >= 80);
  elements.pullRefresh.textContent = pullDistance >= 80 ? 'Solte para atualizar' : 'Puxe para atualizar';
}, { passive: true });

document.addEventListener('touchend', () => {
  if (!pullTracking) return;

  const shouldRefresh = pullDistance >= 80;
  resetPullRefresh();
  if (shouldRefresh) {
    manualRefresh().catch(() => {});
  }
}, { passive: true });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=21').catch(() => {});
  });
}

const rememberedEmail = localStorage.getItem('remembered_email');
if (rememberedEmail) {
  document.querySelector('#email').value = rememberedEmail;
}

elements.date.value = today();
document.querySelector('#report-start').value = today().slice(0, 8) + '01';
document.querySelector('#report-end').value = today();
updateConnectionStatus();
setMode('login');
setTransactionType('Receita');
setView('dashboard');
updateCategorySelects();
showApp();

if (state.token) {
  refresh()
    .then(() => {
      if (!isSubscriptionLocked()) return loadReport();
      return null;
    })
    .catch(clearSession);
}



