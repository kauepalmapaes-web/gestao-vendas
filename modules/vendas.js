// ============================================================
// Vendas Module — Create Sale, Select Client, Add Items
// ============================================================

export async function renderVendas(container) {
  const { data: vendas, error } = await window.db
    .from('vendas')
    .select(`
      *,
      clientes ( id, nome ),
      itens_venda ( id, quantidade, preco_unitario, subtotal, servicos ( nome, tipo ) )
    `)
    .order('data_venda', { ascending: false });

  if (error) {
    showToast('Erro ao carregar vendas: ' + error.message, 'error');
    container.innerHTML = '<p class="text-muted text-center">Erro ao carregar dados</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h2>${(vendas || []).length} vendas registradas</h2>
      </div>
      <button class="btn btn-primary" id="btn-nova-venda">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nova Venda
      </button>
    </div>

    <div class="filter-bar">
      <select class="form-select" id="filter-status" style="max-width:180px">
        <option value="">Todos os Status</option>
        <option value="pendente">Pendente</option>
        <option value="pago">Pago</option>
        <option value="cancelado">Cancelado</option>
      </select>
      <input type="date" class="form-input" id="filter-data-ini" style="max-width:180px" placeholder="Data início">
      <input type="date" class="form-input" id="filter-data-fim" style="max-width:180px" placeholder="Data fim">
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th class="text-right">Valor</th>
              <th>Status</th>
              <th>Pagamento</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="vendas-tbody">
            ${renderVendaRows(vendas || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-nova-venda').addEventListener('click', () => openVendaModal());

  // Filters
  const applyFilters = () => {
    const status = document.getElementById('filter-status').value;
    const dataIni = document.getElementById('filter-data-ini').value;
    const dataFim = document.getElementById('filter-data-fim').value;

    let filtered = vendas || [];
    if (status) filtered = filtered.filter(v => v.status === status);
    if (dataIni) filtered = filtered.filter(v => v.data_venda >= dataIni);
    if (dataFim) filtered = filtered.filter(v => v.data_venda <= dataFim);

    document.getElementById('vendas-tbody').innerHTML = renderVendaRows(filtered);
    attachVendaEvents();
  };

  document.getElementById('filter-status').addEventListener('change', applyFilters);
  document.getElementById('filter-data-ini').addEventListener('change', applyFilters);
  document.getElementById('filter-data-fim').addEventListener('change', applyFilters);

  attachVendaEvents();
}

function renderVendaRows(vendas) {
  if (vendas.length === 0) {
    return '<tr><td colspan="8" class="text-center text-muted" style="padding:30px">Nenhuma venda encontrada</td></tr>';
  }
  return vendas.map(v => {
    const nItens = (v.itens_venda || []).length;
    const statusBadge = v.status === 'pago' ? 'success' : v.status === 'cancelado' ? 'danger' : 'warning';
    // Show contextual action button based on current status
    let actionBtn = '';
    if (v.status === 'pendente') {
      actionBtn = `<button class="btn btn-sm btn-success btn-status-venda" data-id="${v.id}" data-newstatus="pago" title="Marcar como Pago">✅ Pago</button>`;
    } else if (v.status === 'pago') {
      actionBtn = `<button class="btn btn-sm btn-secondary btn-status-venda" data-id="${v.id}" data-newstatus="pendente" title="Voltar para Pendente" style="opacity:0.7">↩️ Pendente</button>`;
    } else {
      actionBtn = `<button class="btn btn-sm btn-secondary btn-status-venda" data-id="${v.id}" data-newstatus="pendente" title="Reabrir como Pendente">↩️ Reabrir</button>`;
    }
    return `
      <tr>
        <td class="text-muted">#${v.id}</td>
        <td>${formatDate(v.data_venda)}</td>
        <td class="font-bold">${v.clientes?.nome || '—'}</td>
        <td>${nItens} ${nItens === 1 ? 'item' : 'itens'}</td>
        <td class="text-right font-bold">${formatCurrency(v.valor_total)}</td>
        <td><span class="badge badge-${statusBadge}">${v.status}</span></td>
        <td>${v.forma_pagamento || '—'}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary btn-view-venda" data-id="${v.id}" title="Detalhes">👁️</button>
            ${actionBtn}
            ${v.status !== 'cancelado' ? `<button class="btn btn-sm btn-danger btn-cancel-venda" data-id="${v.id}" title="Cancelar">✕</button>` : ''}
            <button class="btn btn-sm btn-danger btn-del-venda" data-id="${v.id}" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function attachVendaEvents() {
  document.querySelectorAll('.btn-view-venda').forEach(btn => {
    btn.addEventListener('click', () => viewVendaDetails(btn.dataset.id));
  });
  document.querySelectorAll('.btn-status-venda').forEach(btn => {
    btn.addEventListener('click', () => changeVendaStatus(btn.dataset.id, btn.dataset.newstatus));
  });
  document.querySelectorAll('.btn-cancel-venda').forEach(btn => {
    btn.addEventListener('click', () => changeVendaStatus(btn.dataset.id, 'cancelado'));
  });
  document.querySelectorAll('.btn-del-venda').forEach(btn => {
    btn.addEventListener('click', () => deleteVenda(btn.dataset.id));
  });
}

// --- Modal: Nova Venda ---
let vendaItens = [];

async function openVendaModal() {
  vendaItens = [];

  const [{ data: clientes }, { data: servicos }] = await Promise.all([
    window.db.from('clientes').select('id, nome').order('nome'),
    window.db.from('servicos').select('*').eq('ativo', true).order('nome'),
  ]);

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Cliente *</label>
        <select class="form-select" id="f-venda-cliente">
          <option value="">Selecione um cliente...</option>
          ${(clientes || []).map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data da Venda</label>
        <input type="date" class="form-input" id="f-venda-data" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Forma de Pagamento</label>
        <select class="form-select" id="f-venda-pagamento">
          <option value="">Selecione...</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="Cartão Crédito">Cartão Crédito</option>
          <option value="Cartão Débito">Cartão Débito</option>
          <option value="Boleto">Boleto</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="f-venda-status">
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
      </div>
    </div>

    <hr style="border-color:var(--border-color);margin:16px 0">

    <div class="form-label" style="margin-bottom:12px">ADICIONAR ITENS</div>
    <div class="form-row" style="grid-template-columns: 1fr auto auto">
      <select class="form-select" id="f-item-servico">
        <option value="">Selecione serviço/produto...</option>
        ${(servicos || []).map(s => `<option value="${s.id}" data-preco="${s.preco}" data-nome="${s.nome}">${s.nome} — ${formatCurrency(s.preco)} (${s.tipo})</option>`).join('')}
      </select>
      <input type="number" class="form-input" id="f-item-qty" value="1" min="1" style="width:70px">
      <button class="btn btn-primary btn-sm" id="btn-add-item">+ Adicionar</button>
    </div>

    <div class="items-list" id="venda-itens-list" style="margin-top:12px">
      <p class="text-muted text-center" id="no-items-msg" style="padding:16px">Nenhum item adicionado</p>
    </div>

    <div class="total-row">
      <span class="total-label">TOTAL</span>
      <span class="total-value" id="venda-total">R$ 0,00</span>
    </div>

    <div class="form-group mt-4">
      <label class="form-label">Observações</label>
      <textarea class="form-textarea" id="f-venda-obs" rows="2"></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" id="btn-salvar-venda">💾 Finalizar Venda</button>
  `;

  openModal('Nova Venda', body, footer);

  // Add item
  document.getElementById('btn-add-item').addEventListener('click', () => {
    const sel = document.getElementById('f-item-servico');
    const opt = sel.options[sel.selectedIndex];
    const qty = parseInt(document.getElementById('f-item-qty').value) || 1;

    if (!sel.value) {
      showToast('Selecione um serviço ou produto', 'warning');
      return;
    }

    vendaItens.push({
      servico_id: parseInt(sel.value),
      nome: opt.dataset.nome,
      preco_unitario: parseFloat(opt.dataset.preco),
      quantidade: qty,
    });

    renderItensVenda();
    sel.value = '';
    document.getElementById('f-item-qty').value = 1;
  });

  // Save
  document.getElementById('btn-salvar-venda').addEventListener('click', () => salvarVenda());
}

function renderItensVenda() {
  const list = document.getElementById('venda-itens-list');
  const noMsg = document.getElementById('no-items-msg');

  if (vendaItens.length === 0) {
    list.innerHTML = '<p class="text-muted text-center" id="no-items-msg" style="padding:16px">Nenhum item adicionado</p>';
    document.getElementById('venda-total').textContent = 'R$ 0,00';
    return;
  }

  list.innerHTML = vendaItens.map((item, i) => `
    <div class="item-row">
      <span class="item-name">${item.nome}</span>
      <span class="text-muted">×${item.quantidade}</span>
      <span class="item-price">${formatCurrency(item.preco_unitario * item.quantidade)}</span>
      <button class="item-remove" onclick="window._removeItem(${i})">✕</button>
    </div>
  `).join('');

  const total = vendaItens.reduce((s, it) => s + it.preco_unitario * it.quantidade, 0);
  document.getElementById('venda-total').textContent = formatCurrency(total);
}

window._removeItem = function(idx) {
  vendaItens.splice(idx, 1);
  renderItensVenda();
};

async function salvarVenda() {
  const clienteId = document.getElementById('f-venda-cliente').value;
  const dataVenda = document.getElementById('f-venda-data').value;
  const formaPag = document.getElementById('f-venda-pagamento').value || null;
  const status = document.getElementById('f-venda-status').value;
  const obs = document.getElementById('f-venda-obs').value.trim() || null;

  if (!clienteId) { showToast('Selecione um cliente', 'warning'); return; }
  if (vendaItens.length === 0) { showToast('Adicione pelo menos um item', 'warning'); return; }

  const valorTotal = vendaItens.reduce((s, it) => s + it.preco_unitario * it.quantidade, 0);

  // Insert venda
  const { data: venda, error: errVenda } = await window.db
    .from('vendas')
    .insert({
      cliente_id: parseInt(clienteId),
      data_venda: dataVenda,
      valor_total: valorTotal,
      status: status,
      forma_pagamento: formaPag,
      observacoes: obs,
    })
    .select('id')
    .single();

  if (errVenda) {
    showToast('Erro ao criar venda: ' + errVenda.message, 'error');
    return;
  }

  // Insert itens
  const itensPayload = vendaItens.map(item => ({
    venda_id: venda.id,
    servico_id: item.servico_id,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
  }));

  const { error: errItens } = await window.db.from('itens_venda').insert(itensPayload);

  if (errItens) {
    showToast('Erro ao adicionar itens: ' + errItens.message, 'error');
    return;
  }

  // Generate Atendimento (Prontuário) automatically for "Últimos Atendimentos" tracking
  const desc = obs ? `Venda efetuada. Obs: ${obs}` : `Venda de ${vendaItens.length} item(ns).`;
  const { error: errPront } = await window.db.from('prontuarios').insert({
    cliente_id: parseInt(clienteId),
    venda_id: venda.id,
    data_atendimento: dataVenda,
    descricao: desc,
    profissional: 'Gestão'
  });

  if (errPront) {
    console.error('Erro ao criar atendimento da venda:', errPront);
  }

  showToast(`Venda #${venda.id} criada — ${formatCurrency(valorTotal)}`, 'success');
  closeModal();
  refreshPage();
}

async function viewVendaDetails(id) {
  const { data: v } = await window.db
    .from('vendas')
    .select(`
      *,
      clientes ( nome ),
      itens_venda ( id, quantidade, preco_unitario, subtotal, servicos ( nome, tipo ) )
    `)
    .eq('id', id)
    .single();

  if (!v) return;

  const statusBadge = v.status === 'pago' ? 'success' : v.status === 'cancelado' ? 'danger' : 'warning';

  const body = `
    <div style="display:grid;gap:12px;margin-bottom:20px">
      <div class="form-row">
        <div><span class="form-label">Cliente</span><p class="font-bold">${v.clientes?.nome}</p></div>
        <div><span class="form-label">Data</span><p>${formatDate(v.data_venda)}</p></div>
      </div>
      <div class="form-row">
        <div><span class="form-label">Status</span><p><span class="badge badge-${statusBadge}">${v.status}</span></p></div>
        <div><span class="form-label">Pagamento</span><p>${v.forma_pagamento || '—'}</p></div>
      </div>
      ${v.observacoes ? `<div><span class="form-label">Observações</span><p class="text-muted">${v.observacoes}</p></div>` : ''}
    </div>

    <div class="form-label" style="margin-bottom:8px">ITENS</div>
    <div class="items-list">
      ${(v.itens_venda || []).map(it => `
        <div class="item-row">
          <span class="item-name">${it.servicos?.nome || '—'} <span class="badge badge-neutral" style="margin-left:4px">${it.servicos?.tipo}</span></span>
          <span class="text-muted">×${it.quantidade}</span>
          <span class="item-price">${formatCurrency(it.subtotal)}</span>
        </div>
      `).join('')}
    </div>

    <div class="total-row">
      <span class="total-label">TOTAL</span>
      <span class="total-value">${formatCurrency(v.valor_total)}</span>
    </div>
  `;

  openModal(`🛒 Venda #${v.id}`, body, '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>');
}

async function changeVendaStatus(id, newStatus) {
  const labels = { pendente: '⏳ Pendente', pago: '✅ Pago', cancelado: '❌ Cancelado' };
  const confirmMsg = `Alterar status da Venda #${id} para "${labels[newStatus]}"?`;

  const confirmed = await window.customConfirm(confirmMsg);
  if (!confirmed) return;

  const { error } = await window.db.from('vendas').update({ status: newStatus }).eq('id', id);
  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    showToast(`Venda #${id} → ${labels[newStatus]}`, 'success');
    refreshPage();
  }
}

async function deleteVenda(id) {
  const confirmed = await window.customConfirm('Excluir esta venda e todos os itens?');
  if (!confirmed) return;
  const { error } = await window.db.from('vendas').delete().eq('id', id);
  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    showToast('Venda excluída', 'success');
    refreshPage();
  }
}
