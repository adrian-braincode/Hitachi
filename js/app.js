/**
 * app.js — Lógica principal de la interfaz
 * Cálculo de Bajas — Hitachi Rail
 */

const App = {
  _chart: null,
  _activeTab: 'B',            // escenario activo por defecto: B = sin temerarias
  _resultadosActuales: null,
  _configActual: null,
  _empresasActuales: null,
  _debounceTimer: null,
  _resultsVisible: false,

  /* ── Init ───────────────────────────────────────────────────── */
  init() {
    this._bindActions();
    this._bindRealtime();
    this._defaultRows();
    this._updatePmaxHint();
    this._renderSavedScenarios();
  },

  _updatePmaxHint() {
    const eco = parseFloat(document.getElementById('pmaxEco').value) || 0;
    const tec = parseFloat(document.getElementById('pmaxTec').value) || 0;
    const hint = document.getElementById('pmaxTotalHint');
    if (!hint) return;
    const total = eco + tec;
    hint.textContent = `Total criterios: ${total} pts`;
    hint.style.color = Math.abs(total - 100) < 0.01 ? 'var(--success)' : 'var(--warning)';
  },

  /* ── Actions ────────────────────────────────────────────────── */
  _bindActions() {
    document.getElementById('btnAddRow').addEventListener('click', () => this._addRow());
    document.getElementById('btnCalcular').addEventListener('click', () => this.calcular());
    document.getElementById('btnLimpiar').addEventListener('click', () => this.limpiar());
    document.getElementById('btnGuardar').addEventListener('click', () => this._saveScenario());
    document.getElementById('btnOptimo').addEventListener('click', () => this.calcularOptimo());
    document.getElementById('btnPrint').addEventListener('click', () => window.print());

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        this._activeTab = id;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('tab-btn--active', b.dataset.tab === id));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('tab-panel--active', p.id === 'tab-' + id));
      });
    });

    // Sync importe ↔ baja in empresas table
    document.getElementById('empresasBody').addEventListener('input', e => {
      const td   = e.target.closest('td');
      const tr   = e.target.closest('tr');
      if (!td || !tr) return;
      const idx  = Array.from(td.parentNode.children).indexOf(td);
      const pres = Calc.parseNum(document.getElementById('presupuesto').value);

      if (!isNaN(pres) && pres > 0) {
        const inputs = tr.querySelectorAll('input[type=number], input[type=text]');
        // col 1 = importe, col 2 = baja%
        if (idx === 1 && e.target === inputs[1]) {
          const imp = parseFloat(e.target.value);
          if (!isNaN(imp) && imp > 0) {
            inputs[2].value = Math.max(0, (1 - imp / pres) * 100).toFixed(2);
          }
        }
        if (idx === 2 && e.target === inputs[2]) {
          const baja = parseFloat(e.target.value);
          if (!isNaN(baja)) {
            inputs[1].value = Math.round(pres * (1 - baja / 100));
          }
        }
      }
    });
  },

  /* ── Real-time recalculation ────────────────────────────────── */
  _bindRealtime() {
    const debounce = () => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        if (this._resultsVisible) this.calcular(true);
      }, 450);
    };
    document.getElementById('configForm').addEventListener('input', debounce);
    document.getElementById('licitacionForm').addEventListener('input', debounce);
    document.getElementById('empresasBody').addEventListener('input', debounce);
  },

  /* ── Empresa rows ───────────────────────────────────────────── */
  _defaultRows() {
    [
      { nombre: 'CAF',          esHitachi: false },
      { nombre: 'ENYSE',        esHitachi: false },
      { nombre: 'SIEMENS',      esHitachi: false },
      { nombre: 'ALSTOM',       esHitachi: false },
      { nombre: 'Hitachi Rail', esHitachi: true  },
    ].forEach(d => this._addRow(d));
  },

  _addRow(data = {}) {
    const tbody = document.getElementById('empresasBody');
    const tr = document.createElement('tr');
    const uid = `t-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const estado = data.estado || 'valida';

    tr.innerHTML = `
      <td><input type="text"   class="input input--sm" placeholder="Nombre" value="${this._esc(data.nombre||'')}" autocomplete="off"/></td>
      <td><input type="number" class="input input--sm" placeholder="—" step="1000" min="0" value="${data.importe ? Math.round(data.importe) : ''}" title="Importe ofertado en €"/></td>
      <td><input type="number" class="input input--sm" placeholder="0.00" step="0.01" min="0.01" max="99.99" value="${data.baja != null && data.baja !== '' ? Number(data.baja).toFixed(2) : ''}"/></td>
      <td><input type="number" class="input input--sm" placeholder="0.00" step="0.01" min="0"    value="${data.valoracionTecnica != null && data.valoracionTecnica !== '' ? Number(data.valoracionTecnica) : ''}"/></td>
      <td><input type="number" class="input input--sm" placeholder="0.0"  step="0.1"  min="0"    value="${data.experiencia != null && data.experiencia !== '' ? Number(data.experiencia) : '0'}"/></td>
      <td>
        <select class="input input--sm estado-sel">
          <option value="valida"    ${estado==='valida'    ?'selected':''}>Válida</option>
          <option value="pendiente" ${estado==='pendiente' ?'selected':''}>Pendiente</option>
          <option value="excluida"  ${estado==='excluida'  ?'selected':''}>Excluida</option>
        </select>
      </td>
      <td class="text-center">
        <label class="toggle" title="Es Hitachi Rail">
          <input type="checkbox" class="toggle__inp" id="${uid}" ${data.esHitachi?'checked':''} />
          <span class="toggle__track"></span>
        </label>
      </td>
      <td class="text-center">
        <button class="btn-icon" title="Eliminar fila" onclick="this.closest('tr').remove()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
    return tr;
  },

  _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  /* ── Get form data ──────────────────────────────────────────── */
  _getFormData() {
    const presupuesto  = Calc.parseNum(document.getElementById('presupuesto').value);
    const pmaxEco      = parseFloat(document.getElementById('pmaxEco').value);
    const pmaxTec      = parseFloat(document.getElementById('pmaxTec').value);
    const umbralMinTec = parseFloat(document.getElementById('umbralMinTec').value);

    const licitacion = {
      nombre:   document.getElementById('licNombre').value.trim(),
      codigo:   document.getElementById('licCodigo').value.trim(),
      entidad:  document.getElementById('licEntidad').value.trim(),
      fecha:    document.getElementById('licFecha').value,
      estado:   document.getElementById('licEstado').value,
    };

    const rows = document.querySelectorAll('#empresasBody tr');
    const empresas = [];
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      const sel    = tr.querySelector('select.estado-sel');
      const nombre     = inputs[0].value.trim();
      const importe    = parseFloat(inputs[1].value);
      const baja       = parseFloat(inputs[2].value);
      const valoracion = parseFloat(inputs[3].value) || 0;
      const experiencia = parseFloat(inputs[4].value) || 0;
      const esHitachi  = inputs[5].checked;
      const estado     = sel ? sel.value : 'valida';
      if (nombre && !isNaN(baja) && baja > 0) {
        empresas.push({ nombre, baja, importe: isNaN(importe) ? null : importe, valoracionTecnica: valoracion, experiencia, esHitachi, estado });
      }
    });

    return { config: { presupuesto, pmaxEco, pmaxTec, umbralMinTec }, licitacion, empresas };
  },

  /* ── Calcular ───────────────────────────────────────────────── */
  calcular(silent = false) {
    const { config, licitacion, empresas } = this._getFormData();

    if (!config.presupuesto || isNaN(config.presupuesto) || config.presupuesto <= 0) {
      if (!silent) this._toast('Introduce el presupuesto de licitación.'); return;
    }
    if (isNaN(config.pmaxEco) || config.pmaxEco <= 0) {
      if (!silent) this._toast('Introduce la puntuación máxima económica.'); return;
    }
    if (empresas.filter(e => e.estado !== 'excluida').length < 2) {
      if (!silent) this._toast('Introduce al menos 2 empresas con baja > 0.'); return;
    }

    const btn = document.getElementById('btnCalcular');
    if (!silent) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Calculando…'; }

    const run = () => {
      try {
        const res = Calc.calcular(config, empresas);
        if (!res) { if (!silent) this._toast('Error de cálculo. Revisa los datos.'); return; }

        this._resultadosActuales = res;
        this._configActual       = config;
        this._empresasActuales   = empresas;
        this._licitacionActual   = licitacion;

        this._renderStats(res);
        this._renderEscenario('A', res, config);
        this._renderEscenario('B', res, config);
        this._renderChart(res);
        this._renderRisk(res);

        const hayHitachi = empresas.some(e => e.esHitachi || /hitachi/i.test(e.nombre));
        document.getElementById('optimoCard').hidden = !hayHitachi;
        document.getElementById('simuladorCard').hidden = !hayHitachi;
        document.getElementById('optimoResult').innerHTML = '';
        document.getElementById('sensBody').innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:20px">Haz clic en "Generar tabla" para ver el análisis de sensibilidad.</td></tr>';

        const section = document.getElementById('resultsSection');
        section.hidden = false;
        this._resultsVisible = true;
        if (!silent) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

        document.getElementById('btnGuardar').disabled = false;
      } catch (err) {
        if (!silent) this._toast('Error inesperado: ' + err.message);
      } finally {
        if (!silent) {
          btn.disabled = false;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Calcular`;
        }
      }
    };

    if (silent) run(); else setTimeout(run, 30);
  },

  /* ── Render stats ───────────────────────────────────────────── */
  _renderStats(res) {
    const { stats, boMaxNoTem } = res;
    const pct = (v, d=2) => v != null ? v.toFixed(d)+'%' : '—';
    document.getElementById('statBM').textContent       = pct(stats.BM);
    document.getElementById('statSigma').textContent    = pct(stats.sigma);
    document.getElementById('statBR').textContent       = pct(stats.BR);
    document.getElementById('statUmbral').textContent   = pct(stats.umbralTemeridad);
    document.getElementById('statRango').textContent    = pct(stats.rangoAnormalidad);
    document.getElementById('statBoRef').textContent    = pct(boMaxNoTem);
    document.getElementById('statN').textContent        = stats.n;
  },

  /* ── Render escenario A o B ─────────────────────────────────── */
  _renderEscenario(esc, res, cfg) {
    const pgKey = esc === 'A' ? 'pg_A' : 'pg_B';
    const peKey = esc === 'A' ? 'pe_A' : 'pe_B';

    const sorted = [...res.resultados].sort((a, b) => {
      const pa = a[pgKey] ?? (esc==='A' ? (a.pg_B ?? -999) : -999);
      const pb = b[pgKey] ?? (esc==='A' ? (b.pg_B ?? -999) : -999);
      return pb - pa;
    });

    // Winner banner
    const winner = sorted.find(e => e[pgKey] !== null);
    const wBanner = document.getElementById(`winner${esc}`);
    if (winner && wBanner) {
      const isHR = winner.esHitachi || /hitachi/i.test(winner.nombre);
      wBanner.innerHTML = `
        <span class="trophy">🏆</span>
        <div>
          <div class="winner-banner__label">Oferta ganadora</div>
          <div class="winner-banner__name">
            ${isHR ? '<span class="hr-badge">HR</span>' : ''}
            ${winner.nombre}
          </div>
        </div>
        <div class="winner-banner__pts">${winner[pgKey]?.toFixed(2)} pts globales</div>
      `;
    }

    // Table
    const tbody = document.getElementById(`tbody${esc}`);
    if (!tbody) return;
    tbody.innerHTML = '';

    sorted.forEach((e, idx) => {
      const rank = idx + 1;
      const isWin     = rank === 1 && e[pgKey] !== null;
      const isHitachi = e.esHitachi || /hitachi/i.test(e.nombre);
      const classes   = [
        isWin     ? 'row--winner'   : '',
        isHitachi ? 'row--hitachi'  : '',
        e.esTemeraria && esc==='B' ? 'row--temeraria' : '',
        e.estado === 'excluida' ? 'row--excluida' : '',
      ].filter(Boolean).join(' ');

      const fmt   = (v, d=2) => v != null ? v.toFixed(d) : '—';
      const pct   = v => v != null ? v.toFixed(2)+'%' : '—';
      const money = v => v != null ? new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v) : '—';

      let rankEl = `<span>${rank}</span>`;
      if (rank===1) rankEl=`<span class="rank-1">1</span>`;
      else if (rank===2) rankEl=`<span class="rank-2">2</span>`;
      else if (rank===3) rankEl=`<span class="rank-3">3</span>`;

      const pgCell = e[pgKey] != null
        ? `<strong>${fmt(e[pgKey])}</strong>`
        : `<span class="badge badge--danger">No cumple umbral</span>`;

      const estadoBadge = e.esTemeraria
        ? `<span class="badge badge--danger ml-4">Temeraria</span>`
        : (e.estado === 'excluida' ? `<span class="badge badge--gray">Excluida</span>` : '');

      const tr = document.createElement('tr');
      tr.className = classes;
      tr.innerHTML = `
        <td class="text-center">${rankEl}</td>
        <td style="white-space:nowrap">
          ${isHitachi ? '<span class="hr-badge">HR</span>' : ''}
          ${e.nombre}${estadoBadge}
          ${isWin ? ' <span class="badge badge--success">Ganadora</span>' : ''}
        </td>
        <td class="text-right mono">${pct(e.baja)}</td>
        <td class="text-right">${money(e.precio)}</td>
        <td class="text-right mono">${fmt(e.pt)}</td>
        <td class="text-right mono ${esc==='B' && e.esTemeraria ? 'text-muted' : ''}">${fmt(e[peKey])}</td>
        <td class="text-right">${pgCell}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  /* ── Chart ──────────────────────────────────────────────────── */
  _renderChart(res) {
    if (typeof Chart === 'undefined') return;
    if (this._chart) { this._chart.destroy(); this._chart = null; }

    const sorted = [...res.resultados].sort((a,b) =>
      (b.pg_B ?? b.pg_A ?? -999) - (a.pg_B ?? a.pg_A ?? -999)
    );

    const labels = sorted.map(e => e.nombre);
    const pg_B   = sorted.map(e => e.pg_B);
    const pg_A   = sorted.map(e => e.pg_A);

    const colors = sorted.map(e => {
      if (e.esHitachi || /hitachi/i.test(e.nombre)) return 'rgba(230,0,18,0.85)';
      if (e.esTemeraria)                              return 'rgba(150,150,150,0.4)';
      return 'rgba(45,45,45,0.72)';
    });
    const colorsFaint = colors.map(c =>
      c.replace('0.85','0.2').replace('0.72','0.18').replace('0.4','0.12')
    );

    const h = Math.max(240, sorted.length * 46 + 80);
    document.querySelector('.chart-container').style.height = h + 'px';

    const ctx = document.getElementById('pgChart').getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'PG — Esc. B (sin temerarias)',
            data: pg_B,
            backgroundColor: colors,
            borderColor: colors.map(c => c.replace('0.85','1').replace('0.72','1').replace('0.4','0.6')),
            borderWidth: 1, borderRadius: 4,
          },
          {
            label: 'PG — Esc. A (todas las ofertas)',
            data: pg_A,
            backgroundColor: colorsFaint,
            borderColor: colorsFaint,
            borderWidth: 1, borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'system-ui', size: 11 } } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw != null ? c.raw.toFixed(2)+' pts' : 'N/A'}` } },
        },
        scales: {
          x: { title: { display: true, text: 'Puntuación Global (pts)', font:{size:11} }, grid: { color: 'rgba(0,0,0,.05)' } },
          y: { grid: { display: false }, ticks: { font: { family:'system-ui', size:12 } } },
        },
      },
    });
  },

  /* ── Risk indicators ────────────────────────────────────────── */
  _renderRisk(res) {
    const container = document.getElementById('riskGrid');
    if (!container) return;
    container.innerHTML = '';

    const umbral = res.stats.umbralTemeridad;
    const sorted = [...res.resultados].sort((a,b) => b.baja - a.baja);

    sorted.forEach(e => {
      const r = e.riesgo || Calc.nivelRiesgo(e.baja, umbral);
      const pct = Math.min(100, (e.baja / umbral) * 100);
      const claseCard = r.clase === 'danger' ? 'risk-card--danger' : r.clase === 'warning' ? 'risk-card--warning' : 'risk-card--success';
      const clasebar  = `risk-bar--${r.clase}`;
      const isHR = e.esHitachi || /hitachi/i.test(e.nombre);

      const div = document.createElement('div');
      div.className = `risk-card ${claseCard}`;
      div.innerHTML = `
        <div class="risk-card__name">${isHR ? '<span class="hr-badge" style="margin-right:4px">HR</span>' : ''}${e.nombre}</div>
        <div class="risk-card__baja">${e.baja.toFixed(2)}%</div>
        <div class="risk-bar-wrap"><div class="risk-bar ${clasebar}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="risk-card__info">
          <span class="badge badge--${r.clase}">${r.nivel}</span>
          ${r.distancia > 0 ? `· A ${r.distancia.toFixed(2)}% del umbral (${umbral.toFixed(2)}%)` : '· Supera el umbral de temeridad'}
        </div>
      `;
      container.appendChild(div);
    });
  },

  /* ── Tabla de sensibilidad ──────────────────────────────────── */
  renderSensibilidad() {
    const { config, empresas } = this._getFormData();
    const hitachi      = empresas.find(e => e.esHitachi || /hitachi/i.test(e.nombre));
    const competidores = empresas.filter(e => !(e.esHitachi || /hitachi/i.test(e.nombre)));

    if (!hitachi) { this._toast('Marca la empresa de Hitachi Rail con el toggle.'); return; }

    const btn = document.getElementById('btnSensibilidad');
    btn.disabled = true; btn.textContent = 'Generando…';

    setTimeout(() => {
      try {
        const rows = Calc.tablaSensibilidad(config, competidores, hitachi, 0.1);
        const tbody = document.getElementById('sensBody');
        tbody.innerHTML = '';

        const optIdx = rows.findIndex(r => r.gana);

        rows.forEach((row, i) => {
          const tr = document.createElement('tr');
          let cls = '';
          if (row.esTemeraria) cls = 'row--temeraria';
          else if (i === optIdx) cls = 'row--optimo';
          else if (row.gana)    cls = 'row--gana';
          tr.className = cls + ' sens-table';

          const money = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
          const dif   = row.diferencia;
          const difCell = `<span style="color:${dif>=0?'var(--success)':'var(--danger)'};font-weight:${dif>=0?700:400}">${dif>=0?'+':''}${dif.toFixed(2)}</span>`;
          const posCell = row.esTemeraria
            ? `<span class="badge badge--danger">Temeraria</span>`
            : (row.posicion===1 ? '<span class="badge badge--success">1ª ✓</span>' : `${row.posicion}ª`);

          tr.innerHTML = `
            <td class="mono ${i===optIdx?'fw-bold':''}">${row.baja.toFixed(2)}%${i===optIdx?' ★':''}</td>
            <td class="text-right">${money(row.precio)}</td>
            <td class="text-right mono">${row.pt.toFixed(2)}</td>
            <td class="text-right mono">${row.esTemeraria?'—':row.pe.toFixed(2)}</td>
            <td class="text-right mono ${i===optIdx?'fw-bold':''}">${row.pg!=null?row.pg.toFixed(2):'—'}</td>
            <td class="text-right mono">${row.pgMaxOtros.toFixed(2)}</td>
            <td class="text-right">${difCell}</td>
            <td class="text-center">${posCell}</td>
            <td class="text-center">${row.esTemeraria?'⚠️':'✓'}</td>
          `;
          tbody.appendChild(tr);
        });

        // Scroll to optimo row
        const opRow = tbody.querySelector('.row--optimo');
        if (opRow) opRow.scrollIntoView({ block: 'nearest' });
      } catch (err) {
        this._toast('Error al generar la tabla: ' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Generar tabla';
      }
    }, 30);
  },

  /* ── Baja óptima ────────────────────────────────────────────── */
  calcularOptimo() {
    const { config, empresas } = this._getFormData();
    const hitachi      = empresas.find(e => e.esHitachi || /hitachi/i.test(e.nombre));
    const competidores = empresas.filter(e => !(e.esHitachi || /hitachi/i.test(e.nombre)));

    if (!hitachi) { this._toast('Marca la empresa de Hitachi Rail con el toggle.'); return; }

    const btn = document.getElementById('btnOptimo');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Calculando…';

    setTimeout(() => {
      try {
        const res = Calc.bajaOptima(config, competidores, hitachi, 0.05);
        this._renderOptimo(res, config);
      } catch(e) { this._toast('Error: ' + e.message); }
      finally { btn.disabled = false; btn.textContent = 'Calcular baja óptima'; }
    }, 30);
  },

  _renderOptimo(res, cfg) {
    const el = document.getElementById('optimoResult');
    if (res.error) { el.innerHTML = `<div class="alert alert--error"><strong>Sin solución:</strong> ${res.error}</div>`; return; }
    if (!res.gana) {
      el.innerHTML = `
        <div class="alert alert--warning">
          <strong>Atención:</strong> ${res.razon}
          ${res.bajaTemeridad ? `<br><small>Umbral de temeridad: <strong>${res.bajaTemeridad.toFixed(2)}%</strong></small>` : ''}
        </div>`;
      return;
    }
    const precio = cfg.presupuesto * (1 - res.bajaOptima / 100);
    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi kpi--highlight">
          <div class="kpi__lbl">Baja mínima para ganar</div>
          <div class="kpi__val kpi__val--red">${res.bajaOptima.toFixed(2)}%</div>
        </div>
        <div class="kpi">
          <div class="kpi__lbl">Precio ofertado</div>
          <div class="kpi__val" style="font-size:1.05rem">${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(precio)}</div>
        </div>
        <div class="kpi">
          <div class="kpi__lbl">Ahorro s/ presupuesto</div>
          <div class="kpi__val" style="font-size:1.05rem">${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(cfg.presupuesto - precio)}</div>
        </div>
        <div class="kpi">
          <div class="kpi__lbl">PG Hitachi</div>
          <div class="kpi__val kpi__val--red">${res.pgHitachi.toFixed(2)} pts</div>
        </div>
        <div class="kpi">
          <div class="kpi__lbl">PG máx. competencia</div>
          <div class="kpi__val">${res.pgMaxOtros.toFixed(2)} pts</div>
        </div>
        <div class="kpi kpi--green">
          <div class="kpi__lbl">Ventaja sobre rival</div>
          <div class="kpi__val kpi__val--green">+${res.diferencia.toFixed(2)} pts</div>
        </div>
      </div>
    `;
    if (res.resultado) this._renderChart(res.resultado);
  },

  /* ── Save / load scenarios ──────────────────────────────────── */
  _saveScenario() {
    if (!this._resultadosActuales) { this._toast('Primero calcula los resultados.'); return; }

    const nombre = prompt('Nombre del escenario:', this._licitacionActual?.nombre || `Escenario ${new Date().toLocaleDateString('es-ES')}`);
    if (!nombre) return;

    const escenarios = JSON.parse(localStorage.getItem('hr_escenarios') || '[]');
    escenarios.unshift({
      id: Date.now(),
      nombre,
      fecha: new Date().toLocaleDateString('es-ES'),
      licitacion: this._licitacionActual,
      config:  this._configActual,
      empresas: this._empresasActuales.map(e => ({ ...e })),
      resumen: {
        nEmpresas: this._resultadosActuales.resultados.length,
        BM: this._resultadosActuales.stats.BM,
        umbral: this._resultadosActuales.stats.umbralTemeridad,
        ganador: this._resultadosActuales.resultados.sort((a,b)=>(b.pg_B||0)-(a.pg_B||0))[0]?.nombre,
      },
    });
    // Max 20 scenarios
    if (escenarios.length > 20) escenarios.pop();
    localStorage.setItem('hr_escenarios', JSON.stringify(escenarios));
    this._renderSavedScenarios();
    this._toastOk('Escenario guardado.');
  },

  _renderSavedScenarios() {
    const escenarios = JSON.parse(localStorage.getItem('hr_escenarios') || '[]');
    const card    = document.getElementById('scenariosCard');
    const list    = document.getElementById('scenariosList');
    if (!card || !list) return;

    if (!escenarios.length) { card.hidden = true; return; }
    card.hidden = false;
    list.innerHTML = '';

    escenarios.forEach(sc => {
      const div = document.createElement('div');
      div.className = 'scenario-item';
      div.title = 'Clic para cargar este escenario';
      div.innerHTML = `
        <div class="scenario-item__name">${this._esc(sc.nombre)}</div>
        <div class="scenario-item__meta">${sc.fecha} · ${sc.licitacion?.entidad || ''} · ${sc.licitacion?.codigo || ''}</div>
        <div class="scenario-item__stats">
          <span>💼 ${sc.resumen.nEmpresas} empresas &nbsp;|&nbsp; BM: ${sc.resumen.BM?.toFixed(2)}%</span>
          <span>🏆 ${sc.resumen.ganador || '—'} &nbsp;|&nbsp; Umbral: ${sc.resumen.umbral?.toFixed(2)}%</span>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn btn--outline-red btn--sm" onclick="App._loadScenario(${sc.id})">Cargar</button>
          <button class="btn btn--ghost btn--sm"       onclick="App._deleteScenario(${sc.id})">Eliminar</button>
        </div>
      `;
      list.appendChild(div);
    });
  },

  _loadScenario(id) {
    const escenarios = JSON.parse(localStorage.getItem('hr_escenarios') || '[]');
    const sc = escenarios.find(s => s.id === id);
    if (!sc) return;

    // Rellenar licitación
    document.getElementById('licNombre').value  = sc.licitacion?.nombre  || '';
    document.getElementById('licCodigo').value  = sc.licitacion?.codigo  || '';
    document.getElementById('licEntidad').value = sc.licitacion?.entidad || '';
    document.getElementById('licFecha').value   = sc.licitacion?.fecha   || '';
    document.getElementById('licEstado').value  = sc.licitacion?.estado  || 'borrador';

    // Rellenar config
    if (sc.config.presupuesto) document.getElementById('presupuesto').value = sc.config.presupuesto.toLocaleString('es-ES',{maximumFractionDigits:2});
    document.getElementById('pmaxEco').value      = sc.config.pmaxEco;
    document.getElementById('pmaxTec').value      = sc.config.pmaxTec;
    document.getElementById('umbralMinTec').value = sc.config.umbralMinTec;

    // Rellenar empresas
    document.getElementById('empresasBody').innerHTML = '';
    sc.empresas.forEach(e => this._addRow(e));

    this._updatePmaxHint();
    this.calcular();
    this._toastOk(`Escenario "${sc.nombre}" cargado.`);
  },

  _deleteScenario(id) {
    let escenarios = JSON.parse(localStorage.getItem('hr_escenarios') || '[]');
    escenarios = escenarios.filter(s => s.id !== id);
    localStorage.setItem('hr_escenarios', JSON.stringify(escenarios));
    this._renderSavedScenarios();
  },

  /* ── Limpiar ────────────────────────────────────────────────── */
  limpiar() {
    document.getElementById('empresasBody').innerHTML = '';
    document.getElementById('resultsSection').hidden = true;
    document.getElementById('optimoResult').innerHTML = '';
    document.getElementById('sensBody').innerHTML = '';
    document.getElementById('btnGuardar').disabled = true;
    this._resultsVisible = false;
    if (this._chart) { this._chart.destroy(); this._chart = null; }
    this._defaultRows();
  },

  /* ── Toast ──────────────────────────────────────────────────── */
  _toast(msg) {
    const t = document.getElementById('errorToast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 4500);
  },
  _toastOk(msg) {
    const t = document.getElementById('successToast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
