// ============================================================
// Prontuários Module — Create, View, Link to Vendas
// ============================================================

export async function renderProntuarios(container) {
  const { data: prontuarios, error } = await window.db
    .from('prontuarios')
    .select(`
      *,
      clientes ( id, nome ),
      vendas ( id, valor_total, status )
    `)
    .order('data_atendimento', { ascending: false });

  if (error) {
    showToast('Erro ao carregar prontuários: ' + error.message, 'error');
    container.innerHTML = '<p class="text-muted text-center">Erro ao carregar dados</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h2>${(prontuarios || []).length} prontuários registrados</h2>
      </div>
      <button class="btn btn-primary" id="btn-novo-prontuario">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Novo Prontuário
      </button>
    </div>

    <div class="filter-bar">
      <input type="text" class="form-input" id="filter-prontuarios" placeholder="Buscar por cliente ou descrição..." style="max-width:360px">
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Profissional</th>
              <th>Venda Vinculada</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="pront-tbody">
            ${renderProntuarioRows(prontuarios || [])}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-novo-prontuario').addEventListener('click', () => openProntuarioModal());

  document.getElementById('filter-prontuarios').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = (prontuarios || []).filter(p =>
      p.clientes?.nome?.toLowerCase().includes(term) ||
      p.descricao?.toLowerCase().includes(term)
    );
    document.getElementById('pront-tbody').innerHTML = renderProntuarioRows(filtered);
    attachProntEvents();
  });

  attachProntEvents();
}

function renderProntuarioRows(prontuarios) {
  if (prontuarios.length === 0) {
    return '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">Nenhum prontuário encontrado</td></tr>';
  }
  return prontuarios.map(p => `
    <tr>
      <td>${formatDate(p.data_atendimento)}</td>
      <td class="font-bold">${p.clientes?.nome || '—'}</td>
      <td>${truncateText(p.descricao, 40)}</td>
      <td>${p.profissional || '—'}</td>
      <td>${p.vendas ? `<span class="badge badge-${p.vendas.status === 'pago' ? 'success' : 'warning'}">${formatCurrency(p.vendas.valor_total)}</span>` : '<span class="badge badge-neutral">Sem venda</span>'}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary btn-view-pront" data-id="${p.id}" title="Ver Detalhes">👁️</button>
          <button class="btn btn-sm btn-secondary btn-edit-pront" data-id="${p.id}" title="Editar">✏️</button>
          <button class="btn btn-sm btn-danger btn-del-pront" data-id="${p.id}" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function truncateText(str, max) {
  if (!str) return '—';
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function attachProntEvents() {
  document.querySelectorAll('.btn-view-pront').forEach(btn => {
    btn.addEventListener('click', () => viewProntuario(btn.dataset.id));
  });
  document.querySelectorAll('.btn-edit-pront').forEach(btn => {
    btn.addEventListener('click', () => openProntuarioModal(btn.dataset.id));
  });
  document.querySelectorAll('.btn-del-pront').forEach(btn => {
    btn.addEventListener('click', () => deleteProntuario(btn.dataset.id));
  });
}

async function openProntuarioModal(id = null) {
  // Fetch clientes for dropdown
  const { data: clientes } = await window.db.from('clientes').select('id, nome').order('nome');

  let pront = { cliente_id: '', data_atendimento: new Date().toISOString().split('T')[0], descricao: '', receita: '', prescricao: '', profissional: '' };

  if (id) {
    const { data } = await window.db.from('prontuarios').select('*').eq('id', id).single();
    if (data) pront = data;
  }

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Cliente *</label>
        <select class="form-select" id="f-pront-cliente">
          <option value="">Selecione...</option>
          ${(clientes || []).map(c => `<option value="${c.id}" ${c.id == pront.cliente_id ? 'selected' : ''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data do Atendimento *</label>
        <input type="date" class="form-input" id="f-pront-data" value="${pront.data_atendimento}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Profissional</label>
      <input type="text" class="form-input" id="f-pront-prof" value="${pront.profissional || ''}" placeholder="Nome do profissional">
    </div>
    <div class="form-group">
      <label class="form-label">Descrição do Atendimento *</label>
      <textarea class="form-textarea" id="f-pront-desc" rows="3" placeholder="Descreva o atendimento realizado...">${pront.descricao}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Receita</label>
      <textarea class="form-textarea" id="f-pront-receita" rows="2" placeholder="Medicamentos, dosagens...">${pront.receita || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Prescrição</label>
      <textarea class="form-textarea" id="f-pront-presc" rows="2" placeholder="Orientações, recomendações...">${pront.prescricao || ''}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="btn-salvar-pront">Salvar</button>
  `;

  openModal(id ? 'Editar Prontuário' : 'Novo Prontuário', body, footer);

  document.getElementById('btn-salvar-pront').addEventListener('click', async () => {
    const payload = {
      cliente_id: document.getElementById('f-pront-cliente').value,
      data_atendimento: document.getElementById('f-pront-data').value,
      profissional: document.getElementById('f-pront-prof').value.trim() || null,
      descricao: document.getElementById('f-pront-desc').value.trim(),
      receita: document.getElementById('f-pront-receita').value.trim() || null,
      prescricao: document.getElementById('f-pront-presc').value.trim() || null,
    };

    if (!payload.cliente_id || !payload.descricao || !payload.data_atendimento) {
      showToast('Preencha os campos obrigatórios', 'warning');
      return;
    }

    let error;
    if (id) {
      ({ error } = await window.db.from('prontuarios').update(payload).eq('id', id));
    } else {
      ({ error } = await window.db.from('prontuarios').insert(payload));
    }

    if (error) {
      showToast('Erro: ' + error.message, 'error');
    } else {
      showToast(id ? 'Prontuário atualizado!' : 'Prontuário criado!', 'success');
      closeModal();
      refreshPage();
    }
  });
}

async function viewProntuario(id) {
  const { data: p } = await window.db
    .from('prontuarios')
    .select('*, clientes(nome)')
    .eq('id', id)
    .single();

  if (!p) return;

  const body = `
    <div style="display:grid;gap:16px">
      <div>
        <span class="form-label">Cliente</span>
        <p class="font-bold">${p.clientes?.nome || '—'}</p>
      </div>
      <div class="form-row">
        <div>
          <span class="form-label">Data</span>
          <p>${formatDate(p.data_atendimento)}</p>
        </div>
        <div>
          <span class="form-label">Profissional</span>
          <p>${p.profissional || '—'}</p>
        </div>
      </div>
      <div>
        <span class="form-label">Descrição</span>
        <p>${p.descricao}</p>
      </div>
      ${p.receita ? `<div><span class="form-label">Receita</span><p>${p.receita}</p></div>` : ''}
      ${p.prescricao ? `<div><span class="form-label">Prescrição</span><p>${p.prescricao}</p></div>` : ''}
    </div>
  `;

  openModal('📋 Prontuário #' + p.id, body, '<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>');
}

async function deleteProntuario(id) {
  const confirmed = await window.customConfirm('Excluir este prontuário?');
  if (!confirmed) return;
  const { error } = await window.db.from('prontuarios').delete().eq('id', id);
  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    showToast('Prontuário excluído', 'success');
    refreshPage();
  }
}
