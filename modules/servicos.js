// ============================================================
// Serviços Module — CRUD for Services & Products
// ============================================================

export async function renderServicos(container) {
  const { data: servicos, error } = await window.db
    .from('servicos')
    .select('*')
    .order('tipo')
    .order('nome');

  if (error) {
    showToast('Erro ao carregar serviços: ' + error.message, 'error');
    container.innerHTML = '<p class="text-muted text-center">Erro ao carregar dados</p>';
    return;
  }

  const ativos = (servicos || []).filter(s => s.ativo);
  const inativos = (servicos || []).filter(s => !s.ativo);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h2>${ativos.length} ativos · ${inativos.length} inativos</h2>
      </div>
      <button class="btn btn-primary" id="btn-novo-servico">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Novo Serviço / Produto
      </button>
    </div>

    <div class="filter-bar">
      <select class="form-select" id="filter-tipo" style="max-width:180px">
        <option value="">Todos os Tipos</option>
        <option value="servico">Serviços</option>
        <option value="produto">Produtos</option>
      </select>
      <input type="text" class="form-input" id="filter-servicos" placeholder="Buscar por nome..." style="max-width:280px">
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th class="text-right">Preço</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="servicos-tbody">
            ${renderServicoRows(servicos || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-novo-servico').addEventListener('click', () => openServicoModal());

  // Filters
  const applyFilters = () => {
    const tipo = document.getElementById('filter-tipo').value;
    const term = document.getElementById('filter-servicos').value.toLowerCase();
    let filtered = servicos || [];
    if (tipo) filtered = filtered.filter(s => s.tipo === tipo);
    if (term) filtered = filtered.filter(s => s.nome.toLowerCase().includes(term));
    document.getElementById('servicos-tbody').innerHTML = renderServicoRows(filtered);
    attachServicoEvents();
  };

  document.getElementById('filter-tipo').addEventListener('change', applyFilters);
  document.getElementById('filter-servicos').addEventListener('input', applyFilters);

  attachServicoEvents();
}

function renderServicoRows(servicos) {
  if (servicos.length === 0) {
    return '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">Nenhum serviço/produto encontrado</td></tr>';
  }
  return servicos.map(s => `
    <tr style="${!s.ativo ? 'opacity:0.5' : ''}">
      <td class="font-bold">${s.nome}</td>
      <td><span class="badge badge-${s.tipo === 'servico' ? 'info' : 'neutral'}">${s.tipo}</span></td>
      <td class="text-muted">${s.descricao || '—'}</td>
      <td class="text-right font-bold">${formatCurrency(s.preco)}</td>
      <td><span class="badge badge-${s.ativo ? 'success' : 'danger'}">${s.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary btn-edit-servico" data-id="${s.id}" title="Editar">✏️</button>
          <button class="btn btn-sm btn-secondary btn-toggle-servico" data-id="${s.id}" data-ativo="${s.ativo}" title="${s.ativo ? 'Desativar' : 'Ativar'}">${s.ativo ? '🚫' : '✅'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function attachServicoEvents() {
  document.querySelectorAll('.btn-edit-servico').forEach(btn => {
    btn.addEventListener('click', () => openServicoModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-toggle-servico').forEach(btn => {
    btn.addEventListener('click', () => toggleServico(btn.dataset.id, btn.dataset.ativo === 'true'));
  });
}

async function openServicoModal(id = null) {
  let servico = { nome: '', descricao: '', tipo: 'servico', preco: '' };

  if (id) {
    const { data } = await window.db.from('servicos').select('*').eq('id', id).single();
    if (data) servico = data;
  }

  const body = `
    <div class="form-group">
      <label class="form-label">Nome *</label>
      <input type="text" class="form-input" id="f-serv-nome" value="${servico.nome}" placeholder="Ex: Consulta Inicial">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tipo *</label>
        <select class="form-select" id="f-serv-tipo">
          <option value="servico" ${servico.tipo === 'servico' ? 'selected' : ''}>Serviço</option>
          <option value="produto" ${servico.tipo === 'produto' ? 'selected' : ''}>Produto</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Preço (R$) *</label>
        <input type="number" class="form-input" id="f-serv-preco" value="${servico.preco}" step="0.01" min="0" placeholder="0.00">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-textarea" id="f-serv-desc" rows="2">${servico.descricao || ''}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="btn-salvar-servico">Salvar</button>
  `;

  openModal(id ? 'Editar Serviço/Produto' : 'Novo Serviço/Produto', body, footer);

  document.getElementById('btn-salvar-servico').addEventListener('click', async () => {
    const payload = {
      nome: document.getElementById('f-serv-nome').value.trim(),
      tipo: document.getElementById('f-serv-tipo').value,
      preco: parseFloat(document.getElementById('f-serv-preco').value) || 0,
      descricao: document.getElementById('f-serv-desc').value.trim() || null,
    };

    if (!payload.nome || payload.preco <= 0) {
      showToast('Nome e preço são obrigatórios', 'warning');
      return;
    }

    let error;
    if (id) {
      ({ error } = await window.db.from('servicos').update(payload).eq('id', id));
    } else {
      ({ error } = await window.db.from('servicos').insert(payload));
    }

    if (error) {
      showToast('Erro: ' + error.message, 'error');
    } else {
      showToast(id ? 'Serviço atualizado!' : 'Serviço cadastrado!', 'success');
      closeModal();
      refreshPage();
    }
  });
}

async function toggleServico(id, currentAtivo) {
  const confirmMsg = currentAtivo ? 'Desativar este serviço/produto?' : 'Ativar este serviço/produto?';
  const confirmed = await window.customConfirm(confirmMsg);
  if (!confirmed) return;

  const { error } = await window.db.from('servicos').update({ ativo: !currentAtivo }).eq('id', id);
  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    showToast(currentAtivo ? 'Serviço desativado' : 'Serviço ativado', 'success');
    refreshPage();
  }
}
