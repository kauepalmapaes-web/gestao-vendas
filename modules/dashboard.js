// ============================================================
// Dashboard Module — KPIs, Charts, Recent Activity
// ============================================================

export async function renderDashboard(container) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Fetch all data in parallel
  const [fatRes, servRes, pendRes, atenRes, totalCliRes] = await Promise.all([
    window.db.from('v_faturamento_mensal').select('*').limit(12),
    window.db.from('v_faturamento_por_servico').select('*').limit(10),
    window.db.from('vendas').select('id, valor_total').eq('status', 'pendente'),
    window.db.from('v_ultimos_atendimentos').select('*').limit(8),
    window.db.from('clientes').select('id', { count: 'exact', head: true }),
  ]);

  const faturamentos = fatRes.data || [];
  const topServicos = servRes.data || [];
  const pendentes = pendRes.data || [];
  const atendimentos = atenRes.data || [];
  const totalClientes = totalCliRes.count || 0;

  // Current month stats — fix timezone: parse the date string directly
  const mesCorrente = faturamentos.find(f => {
    // f.mes is like "2026-03-01 00:00:00+00" or "2026-03-01T00:00:00+00:00"
    const parts = f.mes.substring(0, 10).split('-'); // ['2026','03','01']
    const fYear = parseInt(parts[0]);
    const fMonth = parseInt(parts[1]) - 1; // convert to 0-indexed
    return fYear === currentYear && fMonth === currentMonth;
  });

  // Also calculate from vendas directly as fallback
  let faturamentoMes = 0;
  let vendasMes = 0;
  let clientesMes = 0;

  if (mesCorrente) {
    faturamentoMes = parseFloat(mesCorrente.faturamento) || 0;
    vendasMes = parseInt(mesCorrente.total_vendas) || 0;
    clientesMes = parseInt(mesCorrente.total_clientes) || 0;
  }

  // If view didn't return data, query vendas directly
  if (faturamentoMes === 0 && faturamentos.length === 0) {
    const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const { data: vendasDiretas } = await window.db
      .from('vendas')
      .select('id, valor_total, cliente_id')
      .neq('status', 'cancelado')
      .gte('data_venda', startOfMonth);

    if (vendasDiretas && vendasDiretas.length > 0) {
      faturamentoMes = vendasDiretas.reduce((s, v) => s + parseFloat(v.valor_total), 0);
      vendasMes = vendasDiretas.length;
      clientesMes = new Set(vendasDiretas.map(v => v.cliente_id)).size;
    }
  }

  const ticketMedio = vendasMes > 0 ? faturamentoMes / vendasMes : 0;
  const totalPendente = pendentes.reduce((s, p) => s + parseFloat(p.valor_total), 0);

  container.innerHTML = `
    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card success">
        <div class="kpi-icon green">💰</div>
        <div class="kpi-value">${formatCurrency(faturamentoMes)}</div>
        <div class="kpi-label">Faturamento do Mês</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon purple">📊</div>
        <div class="kpi-value">${formatCurrency(ticketMedio)}</div>
        <div class="kpi-label">Ticket Médio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon blue">👥</div>
        <div class="kpi-value">${clientesMes}</div>
        <div class="kpi-label">Clientes no Mês</div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-icon yellow">⏳</div>
        <div class="kpi-value">${formatCurrency(totalPendente)}</div>
        <div class="kpi-label">Pagamentos Pendentes</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Evolução Mensal</div>
            <div class="card-subtitle">Faturamento dos últimos 12 meses</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="chart-evolucao"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Top Serviços</div>
            <div class="card-subtitle">Ranking por receita gerada</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="chart-servicos"></canvas>
        </div>
      </div>
    </div>

    <!-- Recent Activity / Vendas Recentes -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Vendas Recentes</div>
          <div class="card-subtitle">Últimas transações registradas</div>
        </div>
      </div>
      <div class="table-wrapper" id="vendas-recentes-table">
        <!-- loaded below -->
      </div>
    </div>

    <!-- Últimos Atendimentos -->
    <div class="card mt-4">
      <div class="card-header">
        <div>
          <div class="card-title">Últimos Atendimentos</div>
          <div class="card-subtitle">${atendimentos.length} registros recentes</div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Data</th>
              <th>Descrição</th>
              <th>Profissional</th>
              <th class="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${atendimentos.length === 0 ? `
              <tr><td colspan="5" class="text-center text-muted" style="padding:30px">Nenhum atendimento registrado</td></tr>
            ` : atendimentos.map(a => `
              <tr>
                <td class="font-bold">${a.cliente_nome}</td>
                <td>${formatDate(a.data_atendimento)}</td>
                <td>${truncate(a.descricao, 50)}</td>
                <td>${a.profissional || '—'}</td>
                <td class="text-right">${a.valor_total ? formatCurrency(a.valor_total) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Load vendas recentes table
  await loadVendasRecentes();

  // --- Render Charts ---
  renderEvolucaoChart(faturamentos);
  renderServicosChart(topServicos);
}

async function loadVendasRecentes() {
  const { data: vendas } = await window.db
    .from('vendas')
    .select('*, clientes(nome)')
    .order('data_venda', { ascending: false })
    .limit(10);

  const table = document.getElementById('vendas-recentes-table');
  if (!table) return;

  if (!vendas || vendas.length === 0) {
    table.innerHTML = '<p class="text-muted text-center" style="padding:30px">Nenhuma venda registrada</p>';
    return;
  }

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Cliente</th>
          <th>Data</th>
          <th class="text-right">Valor</th>
          <th>Status</th>
          <th>Pagamento</th>
        </tr>
      </thead>
      <tbody>
        ${vendas.map(v => {
          const badge = v.status === 'pago' ? 'success' : v.status === 'cancelado' ? 'danger' : 'warning';
          return `
            <tr>
              <td class="text-muted">#${v.id}</td>
              <td class="font-bold">${v.clientes?.nome || '—'}</td>
              <td>${formatDate(v.data_venda)}</td>
              <td class="text-right font-bold">${formatCurrency(v.valor_total)}</td>
              <td><span class="badge badge-${badge}">${v.status}</span></td>
              <td>${v.forma_pagamento || '—'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function truncate(str, maxLen) {
  if (!str) return '—';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

function renderEvolucaoChart(faturamentos) {
  const canvas = document.getElementById('chart-evolucao');
  if (!canvas || faturamentos.length === 0) return;

  const sorted = [...faturamentos].sort((a, b) => {
    return a.mes.localeCompare(b.mes);
  });
  const labels = sorted.map(f => {
    const parts = f.mes.substring(0, 10).split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  });
  const values = sorted.map(f => parseFloat(f.faturamento));

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Faturamento',
        data: values,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: v => formatCurrency(v)
          }
        }
      }
    }
  });
}

function renderServicosChart(topServicos) {
  const canvas = document.getElementById('chart-servicos');
  if (!canvas || topServicos.length === 0) return;

  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#ef4444'];

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: topServicos.map(s => s.nome),
      datasets: [{
        label: 'Receita',
        data: topServicos.map(s => parseFloat(s.total_faturado)),
        backgroundColor: topServicos.map((_, i) => colors[i % colors.length] + '33'),
        borderColor: topServicos.map((_, i) => colors[i % colors.length]),
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => formatCurrency(ctx.parsed.x)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: v => formatCurrency(v)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        }
      }
    }
  });
}
