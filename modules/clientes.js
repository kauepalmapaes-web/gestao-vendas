// ============================================================
// Clientes Module — CRUD, Search, View Profile
// ============================================================

export async function renderClientes(container) {
  const { data: clientes, error } = await window.db
    .from('clientes')
    .select('*')
    .order('nome');

  if (error) {
    showToast('Erro ao carregar clientes: ' + error.message, 'error');
    container.innerHTML = '<p class="text-muted text-center">Erro ao carregar dados</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h2>${clientes.length} clientes cadastrados</h2>
      </div>
      <button class="btn btn-primary" id="btn-novo-cliente">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Novo Cliente
      </button>
    </div>

    <div class="filter-bar">
      <input type="text" class="form-input" id="filter-clientes" placeholder="Buscar por nome ou CPF..." style="max-width:360px">
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Cadastro</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="clientes-tbody">
            ${renderClienteRows(clientes)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-novo-cliente').addEventListener('click', () => openClienteModal());

  document.getElementById('filter-clientes').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = clientes.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      (c.cpf && c.cpf.includes(term))
    );
    document.getElementById('clientes-tbody').innerHTML = renderClienteRows(filtered);
    attachRowEvents();
  });

  attachRowEvents();
}

function renderClienteRows(clientes) {
  if (clientes.length === 0) {
    return '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">Nenhum cliente encontrado</td></tr>';
  }
  return clientes.map(c => `
    <tr>
      <td class="font-bold">${c.nome}</td>
      <td>${c.cpf || '—'}</td>
      <td>${c.telefone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td>${formatDate(c.created_at?.substring(0, 10))}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary btn-edit-cliente" data-id="${c.id}" title="Editar">✏️</button>
          <button class="btn btn-sm btn-secondary btn-view-cliente" data-id="${c.id}" title="Ver Perfil">👁️</button>
          <button class="btn btn-sm btn-danger btn-del-cliente" data-id="${c.id}" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function attachRowEvents() {
  document.querySelectorAll('.btn-edit-cliente').forEach(btn => {
    btn.addEventListener('click', () => openClienteModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-view-cliente').forEach(btn => {
    btn.addEventListener('click', () => viewClienteProfile(btn.dataset.id));
  });
  document.querySelectorAll('.btn-del-cliente').forEach(btn => {
    btn.addEventListener('click', () => deleteCliente(btn.dataset.id));
  });
}

async function openClienteModal(id = null) {
  let cliente = { nome: '', cpf: '', email: '', telefone: '', data_nascimento: '', endereco: '', observacoes: '' };

  if (id) {
    const { data } = await window.db.from('clientes').select('*').eq('id', id).single();
    if (data) cliente = data;
  }

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input type="text" class="form-input" id="f-nome" value="${cliente.nome}" required>
      </div>
      <div class="form-group">
        <label class="form-label">CPF</label>
        <input type="text" class="form-input" id="f-cpf" value="${cliente.cpf || ''}" placeholder="000.000.000-00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="f-email" value="${cliente.email || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input type="text" class="form-input" id="f-telefone" value="${cliente.telefone || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data de Nascimento</label>
        <input type="date" class="form-input" id="f-nascimento" value="${cliente.data_nascimento || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Endereço</label>
        <input type="text" class="form-input" id="f-endereco" value="${cliente.endereco || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observações</label>
      <textarea class="form-textarea" id="f-obs">${cliente.observacoes || ''}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="btn-salvar-cliente">Salvar</button>
  `;

  openModal(id ? 'Editar Cliente' : 'Novo Cliente', body, footer);

  document.getElementById('btn-salvar-cliente').addEventListener('click', async () => {
    const payload = {
      nome: document.getElementById('f-nome').value.trim(),
      cpf: document.getElementById('f-cpf').value.trim() || null,
      email: document.getElementById('f-email').value.trim() || null,
      telefone: document.getElementById('f-telefone').value.trim() || null,
      data_nascimento: document.getElementById('f-nascimento').value || null,
      endereco: document.getElementById('f-endereco').value.trim() || null,
      observacoes: document.getElementById('f-obs').value.trim() || null,
    };

    if (!payload.nome) {
      showToast('Nome é obrigatório', 'warning');
      return;
    }

    let error;
    if (id) {
      ({ error } = await window.db.from('clientes').update(payload).eq('id', id));
    } else {
      ({ error } = await window.db.from('clientes').insert(payload));
    }

    if (error) {
      showToast('Erro: ' + error.message, 'error');
    } else {
      showToast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'success');
      closeModal();
      refreshPage();
    }
  });
}

async function viewClienteProfile(id) {
  const [{ data: cliente }, { data: prontuarios }, { data: vendas }] = await Promise.all([
    window.db.from('clientes').select('*').eq('id', id).single(),
    window.db.from('prontuarios').select('*').eq('cliente_id', id).order('data_atendimento', { ascending: false }).limit(10),
    window.db.from('vendas').select('*').eq('cliente_id', id).order('data_venda', { ascending: false }).limit(10),
  ]);

  if (!cliente) return;

  const body = `
    <div style="margin-bottom:20px">
      <p><strong>CPF:</strong> ${cliente.cpf || '—'} &nbsp;&nbsp; <strong>Telefone:</strong> ${cliente.telefone || '—'}</p>
      <p><strong>Email:</strong> ${cliente.email || '—'} &nbsp;&nbsp; <strong>Nascimento:</strong> ${formatDate(cliente.data_nascimento)}</p>
      <p><strong>Endereço:</strong> ${cliente.endereco || '—'}</p>
      ${cliente.observacoes ? `<p class="text-muted mt-2">${cliente.observacoes}</p>` : ''}
    </div>

    <h3 style="font-size:0.95rem;margin-bottom:12px">📋 Prontuários (${(prontuarios || []).length})</h3>
    ${(prontuarios && prontuarios.length > 0) ? `
      <div class="timeline" style="margin-bottom:20px">
        ${prontuarios.map(p => `
          <div class="timeline-item">
            <div class="timeline-dot">📋</div>
            <div class="timeline-content">
              <h4>${formatDate(p.data_atendimento)} — ${p.profissional || 'Sem profissional'}</h4>
              <p>${p.descricao}</p>
              ${p.receita ? `<p style="margin-top:4px"><strong>Receita:</strong> ${p.receita}</p>` : ''}
              ${p.prescricao ? `<p><strong>Prescrição:</strong> ${p.prescricao}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-muted mb-4">Nenhum prontuário registrado</p>'}

    <h3 style="font-size:0.95rem;margin-bottom:12px">🛒 Vendas (${(vendas || []).length})</h3>
    ${(vendas && vendas.length > 0) ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Data</th><th>Valor</th><th>Status</th><th>Pagamento</th></tr></thead>
          <tbody>
            ${vendas.map(v => `
              <tr>
                <td>${formatDate(v.data_venda)}</td>
                <td class="font-bold">${formatCurrency(v.valor_total)}</td>
                <td><span class="badge badge-${v.status === 'pago' ? 'success' : v.status === 'cancelado' ? 'danger' : 'warning'}">${v.status}</span></td>
                <td>${v.forma_pagamento || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<p class="text-muted">Nenhuma venda registrada</p>'}
  `;

  openModal(`👤 ${cliente.nome}`, body, '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>');
}

async function deleteCliente(id) {
  const confirmed = await window.customConfirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.');
  if (!confirmed) return;

  const { error } = await window.db.from('clientes').delete().eq('id', id);
  if (error) {
    showToast('Erro ao excluir: ' + error.message, 'error');
  } else {
    showToast('Cliente excluído', 'success');
    refreshPage();
  }
}
