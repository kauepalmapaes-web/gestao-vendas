// ============================================================
// Agenda Module — Agendamentos e Calendário
// ============================================================

let agendamentosData = [];
let clientesData = [];
let servicosData = [];

export async function renderAgenda(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h2 id="agenda-subtitle">Programe seus horários</h2>
      </div>
      <button class="btn btn-primary" id="btn-novo-agendamento">
        + Novo Agendamento
      </button>
    </div>

    <div class="filter-bar">
      <input type="date" class="form-input" id="filtro-data-agenda" />
      <select class="form-select" id="filtro-status-agenda">
        <option value="todos">Todos os Revezamentos</option>
        <option value="agendado">Agendado</option>
        <option value="concluido">Concluído</option>
        <option value="cancelado">Cancelado</option>
        <option value="no_show">Não Compareceu</option>
      </select>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Data e Hora</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Status</th>
              <th class="text-right">Ação</th>
            </tr>
          </thead>
          <tbody id="agenda-tbody">
            <tr><td colspan="5" class="text-center text-muted" style="padding: 30px;">Carregando agendamentos...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filtro-data-agenda').value = today;

  document.getElementById('btn-novo-agendamento').addEventListener('click', () => openAgendamentoModal());
  document.getElementById('filtro-data-agenda').addEventListener('change', loadAgenda);
  document.getElementById('filtro-status-agenda').addEventListener('change', renderTable);

  await loadOptions();
  await loadAgenda();
}

async function loadOptions() {
  const [cliRes, servRes] = await Promise.all([
    window.db.from('clientes').select('id, nome').order('nome'),
    window.db.from('servicos').select('id, nome, valor_padrao').order('nome')
  ]);
  clientesData = cliRes.data || [];
  servicosData = servRes.data || [];
}

async function loadAgenda() {
  const dataFiltro = document.getElementById('filtro-data-agenda').value;
  if (!dataFiltro) return;

  const startOfDay = \`\${dataFiltro}T00:00:00.000Z\`;
  const endOfDay = \`\${dataFiltro}T23:59:59.999Z\`;

  const { data, error } = await window.db
    .from('agendamentos')
    .select('*, clientes(nome, telefone), servicos(nome, valor_padrao)')
    .gte('data_hora_inicio', startOfDay)
    .lte('data_hora_inicio', endOfDay)
    .order('data_hora_inicio', { ascending: true });

  if (error) {
    window.showToast('Erro ao carregar agendamentos', 'error');
    console.error(error);
    return;
  }

  agendamentosData = data || [];
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('agenda-tbody');
  const statusFiltro = document.getElementById('filtro-status-agenda').value;

  const filtered = agendamentosData.filter(a => statusFiltro === 'todos' || a.status === statusFiltro);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 30px;">Nenhum agendamento encontrado para este dia/filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    // format time like "14:30"
    const timeA = new Date(a.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const timeB = new Date(a.data_hora_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let statusBadge = 'neutral';
    if(a.status === 'agendado') statusBadge = 'info';
    else if(a.status === 'concluido') statusBadge = 'success';
    else if(a.status === 'cancelado') statusBadge = 'danger';
    else if(a.status === 'no_show') statusBadge = 'warning';

    const statusDisplay = {
      'agendado': 'Agendado', 'concluido': 'Concluído', 'cancelado': 'Cancelado', 'no_show': 'Faltou'
    }[a.status] || a.status;

    return \`
      <tr>
        <td class="font-bold">\${timeA} - \${timeB}</td>
        <td>
          <div class="font-bold">\${a.clientes ? a.clientes.nome : '—'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">\${a.clientes?.telefone || ''}</div>
        </td>
        <td>\${a.servicos ? a.servicos.nome : '—'}</td>
        <td><span class="badge badge-\${statusBadge}">\${statusDisplay}</span></td>
        <td class="text-right">
          <button class="btn-icon btn-concluir" data-id="\${a.id}" title="Marcar como Concluído e Gerar Venda" \${a.status === 'concluido' ? 'disabled style="opacity:0.3"' : ''}>✅</button>
          <button class="btn-icon btn-cancelar" data-id="\${a.id}" title="Cancelar" \${a.status !== 'agendado' ? 'disabled style="opacity:0.3"' : ''}>❌</button>
        </td>
      </tr>
    \`;
  }).join('');

  // Attach actions
  document.querySelectorAll('.btn-cancelar').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if(await window.customConfirm('Deseja realmente cancelar este agendamento?')) {
        const { error } = await window.db.from('agendamentos').update({ status: 'cancelado' }).eq('id', id);
        if(error) window.showToast('Erro ao cancelar', 'error');
        else { window.showToast('Agendamento cancelado', 'success'); loadAgenda(); }
      }
    });
  });

  document.querySelectorAll('.btn-concluir').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if(await window.customConfirm('Deseja finalizar o agendamento? Ele será marcado como concluído, mas a venda você deve registrar manualmente se houver pagamento agora.')) {
         const { error } = await window.db.from('agendamentos').update({ status: 'concluido' }).eq('id', id);
         if(error) window.showToast('Erro ao concluir', 'error');
         else { window.showToast('Agendamento concluído!', 'success'); loadAgenda(); }
      }
    });
  });
}

function openAgendamentoModal() {
  const cliOptions = clientesData.map(c => \`<option value="\${c.id}">\${c.nome}</option>\`).join('');
  const servOptions = servicosData.map(s => \`<option value="\${s.id}">\${s.nome} (\${window.formatCurrency(s.valor_padrao)})\option>\`).join('');
  
  // Default to the currently selected date in the filter
  const currentDate = document.getElementById('filtro-data-agenda').value || new Date().toISOString().split('T')[0];

  const bodyHTML = \`
    <div class="form-group">
      <label class="form-label">Cliente</label>
      <select class="form-select" id="ag-cliente" required>
        <option value="">Selecione o Cliente</option>
        \${cliOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Serviço</label>
      <select class="form-select" id="ag-servico" required>
        <option value="">Selecione o Serviço</option>
        \${servOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-input" id="ag-data" value="\${currentDate}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Hora Início</label>
        <input type="time" class="form-input" id="ag-hora-inicio" value="09:00" required>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Duração Prevista (minutos)</label>
      <input type="number" class="form-input" id="ag-duracao" value="60" required>
    </div>
    <div class="form-group">
      <label class="form-label">Observações</label>
      <textarea class="form-textarea" id="ag-obs" placeholder="Ex: Cliente pediu confirmação de manhã"></textarea>
    </div>
  \`;

  const footerHTML = \`
    <button class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="btn-salvar-ag" style="gap:5px"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Salvar Agendamento</button>
  \`;

  window.openModal('Novo Agendamento', bodyHTML, footerHTML);

  document.getElementById('btn-salvar-ag').addEventListener('click', async () => {
    const cliente_id = document.getElementById('ag-cliente').value;
    const servico_id = document.getElementById('ag-servico').value;
    const dataSplit = document.getElementById('ag-data').value;
    const horaInicio = document.getElementById('ag-hora-inicio').value;
    const duracao = parseInt(document.getElementById('ag-duracao').value) || 60;
    const obs = document.getElementById('ag-obs').value.trim();

    if (!cliente_id || !servico_id || !dataSplit || !horaInicio) {
      window.showToast('Preencha os campos obrigatórios', 'warning');
      return;
    }

    const { data: { user } } = await window.db.auth.getUser();

    // construct ISO timestamp
    const startObj = new Date(\`\${dataSplit}T\${horaInicio}:00\`);
    const data_hora_inicio = startObj.toISOString();
    
    startObj.setMinutes(startObj.getMinutes() + duracao);
    const data_hora_fim = startObj.toISOString();

    const { error } = await window.db.from('agendamentos').insert([{
      user_id: user.id,
      cliente_id,
      servico_id,
      data_hora_inicio,
      data_hora_fim,
      observacoes: obs,
      status: 'agendado'
    }]);

    if (error) {
      window.showToast('Erro ao salvar agendamento', 'error');
      console.error(error);
    } else {
      window.showToast('Agendado com sucesso!', 'success');
      window.closeModal();
      
      // Update filter to the date chosen and reload
      document.getElementById('filtro-data-agenda').value = dataSplit;
      loadAgenda();
    }
  });
}
