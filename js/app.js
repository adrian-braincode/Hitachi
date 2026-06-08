/**
 * app.js — Lógica principal de la interfaz
 * Cálculo de Bajas — Hitachi Rail
 */

const App = {
  _chart: null,
  _activeTab: 'B',
  _resultadosActuales: null,
  _configActual: null,
  _empresasActuales: null,
  _licitacionActual: null,
  _debounceTimer: null,
  _resultsVisible: false,

  /* ── Init ───────────────────────────────────────────────────── */
  init() {
    this._bindActions();
    this._bindRealtime();
    this._defaultRows();
    this._updatePmaxHint();
    this._renderHistorico();
  },

  _updatePmaxHint() {
    const eco = parseFloat(document.getElementById('pmaxEco').value) || 0;
    const tec = parseFloat(document.getElementById('pmaxTec').value) || 0;
    const hint = document.getElementById('pmaxTotalHint');
    if (!hint) return;
    const total = eco + tec;
    hint.textContent = `Total: ${total} pts`;
    hint.style.color = Math.abs(total - 100) < 0.01 ? 'var(--success)' : 'var(--warning)';
  },

  /* ── Actions ────────────────────────────────────────────────── */
  _bindActions() {
    document.getElementById('btnAddRow').addEventListener('click', () => this._addRow());
    document.getElementById('btnCalcular').addEventListener('click', () => this.calcular());
    document.getElementById('btnLimpiar').addEventListener('click', () => this.limpiar());
    document.getElementById('btnGuardar').addEventListener('click', () => this._guardarHistorico());
    document.getElementById('btnInforme').addEventListener('click', () => this.generarInforme());
    document.getElementById('btnOptimo').addEventListener('click', () => this.calcularOptimo());
    document.getElementById('btnPrint').addEventListener('click', () => window.print());

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        this._activeTab = id;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('tab-btn--active', b.dataset.tab === id));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('tab-panel--active', p.id === 'tab-' + id));
      });
    });

    // Sync importe ↔ baja%
    document.getElementById('empresasBody').addEventListener('input', e => {
      const td  = e.target.closest('td');
      const tr  = e.target.closest('tr');
      if (!td || !tr) return;
      const idx  = Array.from(td.parentNode.children).indexOf(td);
      const pres = Calc.parseNum(document.getElementById('presupuesto').value);
      if (!isNaN(pres) && pres > 0) {
        const inputs = tr.querySelectorAll('input[type=number], input[type=text]');
        if (idx === 1 && e.target === inputs[1]) {
          const imp = parseFloat(e.target.value);
          if (!isNaN(imp) && imp > 0) inputs[2].value = Math.max(0, (1 - imp / pres) * 100).toFixed(2);
        }
        if (idx === 2 && e.target === inputs[2]) {
          const baja = parseFloat(e.target.value);
          if (!isNaN(baja)) inputs[1].value = Math.round(pres * (1 - baja / 100));
        }
      }
    });

    // Búsqueda en histórico
    document.getElementById('historicoSearch').addEventListener('input', e => {
      this._renderHistorico(e.target.value.trim().toLowerCase());
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
      <td><input type="number" class="input input--sm" placeholder="—" step="1000" min="0" value="${data.importe ? Math.round(data.importe) : ''}"/></td>
      <td><input type="number" class="input input--sm" placeholder="0.00" step="0.01" min="0.01" max="99.99" value="${data.baja != null && data.baja !== '' ? Number(data.baja).toFixed(2) : ''}"/></td>
      <td><input type="number" class="input input--sm" placeholder="0.00" step="0.01" min="0" value="${data.valoracionTecnica != null && data.valoracionTecnica !== '' ? Number(data.valoracionTecnica) : ''}"/></td>
      <td><input type="number" class="input input--sm" placeholder="0.0"  step="0.1"  min="0" value="${data.experiencia != null && data.experiencia !== '' ? Number(data.experiencia) : '0'}"/></td>
      <td>
        <select class="input input--sm estado-sel">
          <option value="valida"    ${estado==='valida'    ?'selected':''}>Válida</option>
          <option value="pendiente" ${estado==='pendiente' ?'selected':''}>Pendiente</option>
          <option value="excluida"  ${estado==='excluida'  ?'selected':''}>Excluida</option>
        </select>
      </td>
      <td class="text-center">
        <label class="toggle" title="Es Hitachi Rail">
          <input type="checkbox" class="toggle__inp" id="${uid}" ${data.esHitachi?'checked':''}/>
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
    const licitacion   = {
      nombre:  document.getElementById('licNombre').value.trim(),
      codigo:  document.getElementById('licCodigo').value.trim(),
      entidad: document.getElementById('licEntidad').value.trim(),
      fecha:   document.getElementById('licFecha').value,
      estado:  document.getElementById('licEstado').value,
    };
    const rows = document.querySelectorAll('#empresasBody tr');
    const empresas = [];
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      const sel    = tr.querySelector('select.estado-sel');
      const nombre      = inputs[0].value.trim();
      const importe     = parseFloat(inputs[1].value);
      const baja        = parseFloat(inputs[2].value);
      const valoracion  = parseFloat(inputs[3].value) || 0;
      const experiencia = parseFloat(inputs[4].value) || 0;
      const esHitachi   = inputs[5].checked;
      const estado      = sel ? sel.value : 'valida';
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
        document.getElementById('optimoCard').hidden    = !hayHitachi;
        document.getElementById('simuladorCard').hidden = !hayHitachi;
        document.getElementById('optimoResult').innerHTML = '';
        document.getElementById('sensBody').innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:20px">Haz clic en "Generar tabla" para ver el análisis de sensibilidad.</td></tr>';

        const section = document.getElementById('resultsSection');
        section.hidden = false;
        this._resultsVisible = true;
        if (!silent) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

        document.getElementById('btnGuardar').disabled = false;
        document.getElementById('btnInforme').disabled = false;
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
    document.getElementById('statBM').textContent     = pct(stats.BM);
    document.getElementById('statSigma').textContent  = pct(stats.sigma);
    document.getElementById('statBR').textContent     = pct(stats.BR);
    document.getElementById('statUmbral').textContent = pct(stats.umbralTemeridad);
    document.getElementById('statRango').textContent  = pct(stats.rangoAnormalidad);
    document.getElementById('statBoRef').textContent  = pct(boMaxNoTem);
    document.getElementById('statN').textContent      = stats.n;
  },

  /* ── Render escenario A o B ─────────────────────────────────── */
  _renderEscenario(esc, res, cfg) {
    const pgKey = esc === 'A' ? 'pg_A' : 'pg_B';
    const peKey = esc === 'A' ? 'pe_A' : 'pe_B';
    const sorted = [...res.resultados].sort((a, b) => {
      const pa = a[pgKey] ?? -999;
      const pb = b[pgKey] ?? -999;
      return pb - pa;
    });
    const winner  = sorted.find(e => e[pgKey] !== null);
    const wBanner = document.getElementById(`winner${esc}`);
    if (winner && wBanner) {
      const isHR = winner.esHitachi || /hitachi/i.test(winner.nombre);
      wBanner.innerHTML = `
        <span class="trophy">🏆</span>
        <div>
          <div class="winner-banner__label">Oferta ganadora</div>
          <div class="winner-banner__name">${isHR ? '<span class="hr-badge">HR</span>' : ''}${winner.nombre}</div>
        </div>
        <div class="winner-banner__pts">${winner[pgKey]?.toFixed(2)} pts globales</div>
      `;
    }
    const tbody = document.getElementById(`tbody${esc}`);
    if (!tbody) return;
    tbody.innerHTML = '';
    const money = v => v != null ? new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v) : '—';
    const fmt   = (v, d=2) => v != null ? v.toFixed(d) : '—';
    const pct   = v => v != null ? v.toFixed(2)+'%' : '—';
    sorted.forEach((e, idx) => {
      const rank = idx + 1;
      const isWin     = rank === 1 && e[pgKey] !== null;
      const isHitachi = e.esHitachi || /hitachi/i.test(e.nombre);
      const classes   = [isWin?'row--winner':'', isHitachi?'row--hitachi':'', e.esTemeraria&&esc==='B'?'row--temeraria':'', e.estado==='excluida'?'row--excluida':''].filter(Boolean).join(' ');
      let rankEl = `<span>${rank}</span>`;
      if (rank===1) rankEl='<span class="rank-1">1</span>';
      else if (rank===2) rankEl='<span class="rank-2">2</span>';
      else if (rank===3) rankEl='<span class="rank-3">3</span>';
      const pgCell = e[pgKey] != null ? `<strong>${fmt(e[pgKey])}</strong>` : `<span class="badge badge--danger">No cumple umbral</span>`;
      const estadoBadge = e.esTemeraria ? `<span class="badge badge--danger ml-4">Temeraria</span>` : (e.estado==='excluida' ? `<span class="badge badge--gray">Excluida</span>` : '');
      const tr = document.createElement('tr');
      tr.className = classes;
      tr.innerHTML = `
        <td class="text-center">${rankEl}</td>
        <td style="white-space:nowrap">${isHitachi?'<span class="hr-badge">HR</span>':''}${e.nombre}${estadoBadge}${isWin?' <span class="badge badge--success">Ganadora</span>':''}</td>
        <td class="text-right mono">${pct(e.baja)}</td>
        <td class="text-right">${money(e.precio)}</td>
        <td class="text-right mono">${fmt(e.pt)}</td>
        <td class="text-right mono ${esc==='B'&&e.esTemeraria?'text-muted':''}">${fmt(e[peKey])}</td>
        <td class="text-right">${pgCell}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  /* ── Chart ──────────────────────────────────────────────────── */
  _renderChart(res) {
    if (typeof Chart === 'undefined') return;
    if (this._chart) { this._chart.destroy(); this._chart = null; }
    const sorted = [...res.resultados].sort((a,b) => (b.pg_B??b.pg_A??-999)-(a.pg_B??a.pg_A??-999));
    const labels = sorted.map(e => e.nombre);
    const colors = sorted.map(e => e.esHitachi||/hitachi/i.test(e.nombre) ? 'rgba(230,0,18,0.85)' : e.esTemeraria ? 'rgba(150,150,150,0.4)' : 'rgba(45,45,45,0.72)');
    const colorsFaint = colors.map(c => c.replace('0.85','0.2').replace('0.72','0.18').replace('0.4','0.12'));
    const h = Math.max(240, sorted.length * 46 + 80);
    document.querySelector('.chart-container').style.height = h + 'px';
    const ctx = document.getElementById('pgChart').getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'PG — Esc. B (sin temerarias)', data:sorted.map(e=>e.pg_B), backgroundColor:colors, borderColor:colors.map(c=>c.replace('0.85','1').replace('0.72','1').replace('0.4','0.6')), borderWidth:1, borderRadius:4 },
          { label:'PG — Esc. A (todas las ofertas)', data:sorted.map(e=>e.pg_A), backgroundColor:colorsFaint, borderColor:colorsFaint, borderWidth:1, borderRadius:4 },
        ],
      },
      options: {
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'top', labels:{ font:{ family:'system-ui', size:11 } } }, tooltip:{ callbacks:{ label:c=>` ${c.dataset.label}: ${c.raw!=null?c.raw.toFixed(2)+' pts':'N/A'}` } } },
        scales:{ x:{ title:{ display:true, text:'Puntuación Global (pts)', font:{size:11} }, grid:{ color:'rgba(0,0,0,.05)' } }, y:{ grid:{ display:false }, ticks:{ font:{ family:'system-ui', size:12 } } } },
      },
    });
  },

  /* ── Risk indicators ────────────────────────────────────────── */
  _renderRisk(res) {
    const container = document.getElementById('riskGrid');
    if (!container) return;
    container.innerHTML = '';
    const umbral = res.stats.umbralTemeridad;
    [...res.resultados].sort((a,b) => b.baja - a.baja).forEach(e => {
      const r    = e.riesgo || Calc.nivelRiesgo(e.baja, umbral);
      const pct  = Math.min(100, (e.baja / umbral) * 100);
      const isHR = e.esHitachi || /hitachi/i.test(e.nombre);
      const div  = document.createElement('div');
      div.className = `risk-card risk-card--${r.clase}`;
      div.innerHTML = `
        <div class="risk-card__name">${isHR?'<span class="hr-badge" style="margin-right:4px">HR</span>':''}${e.nombre}</div>
        <div class="risk-card__baja">${e.baja.toFixed(2)}%</div>
        <div class="risk-bar-wrap"><div class="risk-bar risk-bar--${r.clase}" style="width:${pct.toFixed(1)}%"></div></div>
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
        const rows   = Calc.tablaSensibilidad(config, competidores, hitachi, 0.1);
        const tbody  = document.getElementById('sensBody');
        tbody.innerHTML = '';
        const optIdx = rows.findIndex(r => r.gana);
        const money  = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
        rows.forEach((row, i) => {
          const tr  = document.createElement('tr');
          const cls = row.esTemeraria ? 'row--temeraria' : i===optIdx ? 'row--optimo' : row.gana ? 'row--gana' : '';
          tr.className = cls;
          const dif = row.diferencia;
          tr.innerHTML = `
            <td class="mono ${i===optIdx?'fw-bold':''}">${row.baja.toFixed(2)}%${i===optIdx?' ★':''}</td>
            <td class="text-right">${money(row.precio)}</td>
            <td class="text-right mono">${row.pt.toFixed(2)}</td>
            <td class="text-right mono">${row.esTemeraria?'—':row.pe.toFixed(2)}</td>
            <td class="text-right mono ${i===optIdx?'fw-bold':''}">${row.pg!=null?row.pg.toFixed(2):'—'}</td>
            <td class="text-right mono">${row.pgMaxOtros.toFixed(2)}</td>
            <td class="text-right"><span style="color:${dif>=0?'var(--success)':'var(--danger)'};font-weight:${dif>=0?700:400}">${dif>=0?'+':''}${dif.toFixed(2)}</span></td>
            <td class="text-center">${row.esTemeraria?'<span class="badge badge--danger">Temeraria</span>':(row.posicion===1?'<span class="badge badge--success">1ª ✓</span>':row.posicion+'ª')}</td>
            <td class="text-center">${row.esTemeraria?'⚠️':'✓'}</td>
          `;
          tbody.appendChild(tr);
        });
        const opRow = tbody.querySelector('.row--optimo');
        if (opRow) opRow.scrollIntoView({ block: 'nearest' });
      } catch (err) { this._toast('Error: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = 'Generar tabla'; }
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
    if (!res.gana) { el.innerHTML = `<div class="alert alert--warning"><strong>Atención:</strong> ${res.razon}${res.bajaTemeridad?`<br><small>Umbral de temeridad: <strong>${res.bajaTemeridad.toFixed(2)}%</strong></small>`:''}</div>`; return; }
    const precio = cfg.presupuesto * (1 - res.bajaOptima / 100);
    const eur    = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi kpi--highlight"><div class="kpi__lbl">Baja mínima para ganar</div><div class="kpi__val kpi__val--red">${res.bajaOptima.toFixed(2)}%</div></div>
        <div class="kpi"><div class="kpi__lbl">Precio ofertado</div><div class="kpi__val" style="font-size:1.05rem">${eur(precio)}</div></div>
        <div class="kpi"><div class="kpi__lbl">Ahorro s/ presupuesto</div><div class="kpi__val" style="font-size:1.05rem">${eur(cfg.presupuesto-precio)}</div></div>
        <div class="kpi"><div class="kpi__lbl">PG Hitachi</div><div class="kpi__val kpi__val--red">${res.pgHitachi.toFixed(2)} pts</div></div>
        <div class="kpi"><div class="kpi__lbl">PG máx. competencia</div><div class="kpi__val">${res.pgMaxOtros.toFixed(2)} pts</div></div>
        <div class="kpi kpi--green"><div class="kpi__lbl">Ventaja sobre rival</div><div class="kpi__val kpi__val--green">+${res.diferencia.toFixed(2)} pts</div></div>
      </div>
    `;
    if (res.resultado) this._renderChart(res.resultado);
  },

  /* ══════════════════════════════════════════════════════════════
     HISTÓRICO
  ══════════════════════════════════════════════════════════════ */
  _guardarHistorico() {
    if (!this._resultadosActuales) { this._toast('Primero calcula los resultados.'); return; }
    const nombre = prompt('Nombre para guardar en el histórico:', this._licitacionActual?.nombre || `Licitación ${new Date().toLocaleDateString('es-ES')}`);
    if (!nombre) return;

    const res      = this._resultadosActuales;
    const ganador  = [...res.resultados].sort((a,b)=>(b.pg_B||0)-(a.pg_B||0))[0];
    const hitachi  = res.resultados.find(e => e.esHitachi || /hitachi/i.test(e.nombre));
    const nTem     = res.resultados.filter(e => e.esTemeraria).length;

    const registro = {
      id:        Date.now(),
      nombre,
      fechaGuardado: new Date().toLocaleDateString('es-ES'),
      licitacion: { ...this._licitacionActual },
      config:     { ...this._configActual },
      empresas:   this._empresasActuales.map(e => ({ ...e })),
      resumen: {
        nEmpresas:    res.resultados.length,
        nTemerarias:  nTem,
        BM:           res.stats.BM,
        sigma:        res.stats.sigma,
        BR:           res.stats.BR,
        umbral:       res.stats.umbralTemeridad,
        ganador:      ganador?.nombre || '—',
        ganadorPG:    ganador?.pg_B   || null,
        hitachiPG:    hitachi?.pg_B   || null,
        hitachiBaja:  hitachi?.baja   || null,
        hitachiPos:   ganador ? ([...res.resultados].filter(e=>e.pg_B!=null).sort((a,b)=>b.pg_B-a.pg_B).findIndex(e=>e.esHitachi||/hitachi/i.test(e.nombre))+1) : null,
      },
    };

    const historico = JSON.parse(localStorage.getItem('hr_historico') || '[]');
    historico.unshift(registro);
    if (historico.length > 50) historico.pop();
    localStorage.setItem('hr_historico', JSON.stringify(historico));
    this._renderHistorico();
    this._toastOk('Guardado en el histórico.');
  },

  _renderHistorico(filtro = '') {
    const card = document.getElementById('historicoCard');
    const list = document.getElementById('historicoStats');
    const body = document.getElementById('historicoList');
    if (!card || !body) return;

    let historico = JSON.parse(localStorage.getItem('hr_historico') || '[]');
    if (!historico.length) { card.hidden = true; return; }
    card.hidden = false;

    // Stats rápidos
    const totalLic   = historico.length;
    const ganadasHR  = historico.filter(h => /hitachi/i.test(h.resumen.ganador)).length;
    const bmMedia    = historico.reduce((s,h)=>s+(h.resumen.BM||0),0) / totalLic;
    if (list) list.innerHTML = `
      <div class="historico-kpi-row">
        <div class="historico-kpi"><span class="historico-kpi__val">${totalLic}</span><span class="historico-kpi__lbl">Licitaciones</span></div>
        <div class="historico-kpi"><span class="historico-kpi__val" style="color:var(--success)">${ganadasHR}</span><span class="historico-kpi__lbl">Hitachi ganó</span></div>
        <div class="historico-kpi"><span class="historico-kpi__val" style="color:var(--danger)">${totalLic-ganadasHR}</span><span class="historico-kpi__lbl">No ganó</span></div>
        <div class="historico-kpi"><span class="historico-kpi__val">${bmMedia.toFixed(2)}%</span><span class="historico-kpi__lbl">BM media</span></div>
      </div>
    `;

    // Filtro
    if (filtro) historico = historico.filter(h =>
      h.nombre.toLowerCase().includes(filtro) ||
      (h.licitacion?.entidad||'').toLowerCase().includes(filtro) ||
      (h.licitacion?.codigo||'').toLowerCase().includes(filtro)
    );

    body.innerHTML = '';
    if (!historico.length) {
      body.innerHTML = '<p class="text-muted" style="padding:16px">Sin resultados para esa búsqueda.</p>';
      return;
    }

    historico.forEach(h => {
      const ganaHR   = /hitachi/i.test(h.resumen.ganador);
      const posHR    = h.resumen.hitachiPos;
      const div = document.createElement('div');
      div.className = 'scenario-item';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div class="scenario-item__name">${this._esc(h.nombre)}</div>
          <span class="badge badge--${ganaHR?'success':'gray'}">${ganaHR?'✓ Hitachi ganó':`${posHR?posHR+'ª posición':'—'}`}</span>
        </div>
        <div class="scenario-item__meta">${h.fechaGuardado} · ${h.licitacion?.entidad||'—'} · ${h.licitacion?.codigo||'—'}</div>
        <div class="scenario-item__stats">
          <span>👥 ${h.resumen.nEmpresas} empresas · ${h.resumen.nTemerarias} temerarias</span>
          <span>📊 BM: ${h.resumen.BM?.toFixed(2)}% · Umbral: ${h.resumen.umbral?.toFixed(2)}%</span>
          <span>🏆 Ganador: <strong>${this._esc(h.resumen.ganador)}</strong> · ${h.resumen.ganadorPG?.toFixed(2)||'—'} pts</span>
          ${h.resumen.hitachiPG!=null?`<span>🔴 Hitachi: ${h.resumen.hitachiPG.toFixed(2)} pts · Baja ${h.resumen.hitachiBaja?.toFixed(2)}%</span>`:''}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--outline-red btn--sm" onclick="App._cargarHistorico(${h.id})">Cargar</button>
          <button class="btn btn--ghost btn--sm"       onclick="App._eliminarHistorico(${h.id})">Eliminar</button>
        </div>
      `;
      body.appendChild(div);
    });
  },

  _cargarHistorico(id) {
    const historico = JSON.parse(localStorage.getItem('hr_historico') || '[]');
    const h = historico.find(x => x.id === id);
    if (!h) return;
    document.getElementById('licNombre').value  = h.licitacion?.nombre  || '';
    document.getElementById('licCodigo').value  = h.licitacion?.codigo  || '';
    document.getElementById('licEntidad').value = h.licitacion?.entidad || '';
    document.getElementById('licFecha').value   = h.licitacion?.fecha   || '';
    document.getElementById('licEstado').value  = h.licitacion?.estado  || 'borrador';
    if (h.config.presupuesto) document.getElementById('presupuesto').value = h.config.presupuesto.toLocaleString('es-ES',{maximumFractionDigits:2});
    document.getElementById('pmaxEco').value      = h.config.pmaxEco;
    document.getElementById('pmaxTec').value      = h.config.pmaxTec;
    document.getElementById('umbralMinTec').value = h.config.umbralMinTec;
    document.getElementById('empresasBody').innerHTML = '';
    h.empresas.forEach(e => this._addRow(e));
    this._updatePmaxHint();
    this.calcular();
    this._toastOk(`"${h.nombre}" cargado del histórico.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _eliminarHistorico(id) {
    let historico = JSON.parse(localStorage.getItem('hr_historico') || '[]');
    historico = historico.filter(h => h.id !== id);
    localStorage.setItem('hr_historico', JSON.stringify(historico));
    this._renderHistorico(document.getElementById('historicoSearch').value.trim().toLowerCase());
  },

  _borrarHistorico() {
    if (!confirm('¿Borrar todo el histórico? Esta acción no se puede deshacer.')) return;
    localStorage.removeItem('hr_historico');
    this._renderHistorico();
  },

  /* ══════════════════════════════════════════════════════════════
     INFORME EJECUTIVO
  ══════════════════════════════════════════════════════════════ */
  generarInforme() {
    if (!this._resultadosActuales) { this._toast('Primero calcula los resultados.'); return; }

    const res  = this._resultadosActuales;
    const cfg  = this._configActual;
    const lic  = this._licitacionActual || {};
    const eur  = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
    const pct  = (v,d=2) => v!=null ? v.toFixed(d)+'%' : '—';
    const fmt  = (v,d=2) => v!=null ? v.toFixed(d) : '—';
    const hoy  = new Date().toLocaleDateString('es-ES', {year:'numeric',month:'long',day:'numeric'});

    const sorted = [...res.resultados].sort((a,b) => (b.pg_B??-999)-(a.pg_B??-999));
    const ganador = sorted[0];
    const hitachi = res.resultados.find(e => e.esHitachi || /hitachi/i.test(e.nombre));

    const filas = sorted.map((e, i) => {
      const rank = i+1;
      const isHR = e.esHitachi || /hitachi/i.test(e.nombre);
      const medal = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank+'.';
      const bgRow = isHR ? 'background:#fff5f5' : rank===1 ? 'background:#f0faf4' : '';
      const pgVal = e.pg_B != null ? `<strong>${fmt(e.pg_B)}</strong>` : '<em style="color:#999">No cumple</em>';
      const temBadge = e.esTemeraria ? ' <span style="background:#fce8e6;color:#c62828;font-size:10px;padding:1px 5px;border-radius:10px;font-weight:700">TEMERARIA</span>' : '';
      return `<tr style="${bgRow}">
        <td style="text-align:center;padding:8px 10px">${medal}</td>
        <td style="padding:8px 10px;font-weight:${isHR?700:400}">${isHR?'<span style="background:#e60012;color:#fff;font-size:10px;padding:1px 5px;border-radius:2px;margin-right:4px;font-weight:800">HR</span>':''}${e.nombre}${temBadge}</td>
        <td style="text-align:right;padding:8px 10px;font-family:monospace">${pct(e.baja)}</td>
        <td style="text-align:right;padding:8px 10px">${e.precio!=null?eur(e.precio):'—'}</td>
        <td style="text-align:right;padding:8px 10px;font-family:monospace">${fmt(e.pt)}</td>
        <td style="text-align:right;padding:8px 10px;font-family:monospace">${e.esTemeraria?'<span style="color:#aaa">—</span>':fmt(e.pe_B)}</td>
        <td style="text-align:right;padding:8px 10px">${pgVal}</td>
      </tr>`;
    }).join('');

    const riesgos = [...res.resultados].sort((a,b)=>b.baja-a.baja).map(e => {
      const r   = e.riesgo || Calc.nivelRiesgo(e.baja, res.stats.umbralTemeridad);
      const col = r.clase==='danger'?'#c62828':r.clase==='warning'?'#a1810a':'#1a7f3c';
      const bg  = r.clase==='danger'?'#fce8e6':r.clase==='warning'?'#fff8e1':'#e6f4ea';
      const isHR = e.esHitachi||/hitachi/i.test(e.nombre);
      return `<div style="background:${bg};border-left:4px solid ${col};border-radius:6px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div style="font-weight:700;font-size:13px">${isHR?'<span style="background:#e60012;color:#fff;font-size:9px;padding:1px 4px;border-radius:2px;margin-right:4px">HR</span>':''}${e.nombre}</div>
          <div style="font-size:12px;color:#555;margin-top:3px">${r.distancia>0?`A ${r.distancia.toFixed(2)}% del umbral`:'Supera el umbral de temeridad'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.2rem;font-weight:800;color:#1a1a1a">${e.baja.toFixed(2)}%</div>
          <div style="font-size:11px;font-weight:700;color:${col}">${r.nivel}</div>
        </div>
      </div>`;
    }).join('');

    // Conclusiones automáticas
    const conclusiones = [];
    if (ganador) {
      const ganaHR = ganador.esHitachi || /hitachi/i.test(ganador.nombre);
      if (ganaHR) conclusiones.push(`<li style="color:#1a7f3c"><strong>Hitachi Rail lidera el ranking</strong> con ${fmt(ganador.pg_B)} puntos globales en el escenario B.</li>`);
      else {
        conclusiones.push(`<li>La oferta ganadora es <strong>${ganador.nombre}</strong> con ${fmt(ganador.pg_B)} puntos globales.</li>`);
        if (hitachi) {
          const diff = (ganador.pg_B||0) - (hitachi.pg_B||0);
          conclusiones.push(`<li>Hitachi Rail necesitaría <strong>${diff.toFixed(2)} puntos adicionales</strong> para superar al líder.</li>`);
        }
      }
    }
    const nTem = res.resultados.filter(e => e.esTemeraria).length;
    if (nTem > 0) conclusiones.push(`<li><strong>${nTem} oferta${nTem>1?'s':''} temeraria${nTem>1?'s':''}</strong> detectada${nTem>1?'s':''}. En el escenario B reciben PE = 0.</li>`);
    if (hitachi) {
      const rHR = hitachi.riesgo || Calc.nivelRiesgo(hitachi.baja, res.stats.umbralTemeridad);
      if (rHR.clase !== 'success') conclusiones.push(`<li style="color:${rHR.clase==='danger'?'#c62828':'#a1810a'}"><strong>Riesgo de temeridad para Hitachi: ${rHR.nivel}</strong>. Distancia al umbral: ${rHR.distancia.toFixed(2)}%.</li>`);
    }

    const estadoLabel = { borrador:'Borrador', 'en-analisis':'En análisis', cerrada:'Cerrada', archivada:'Archivada' };

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe Ejecutivo — ${lic.nombre || 'Licitación'}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
    .page{max-width:900px;margin:0 auto;padding:32px 36px}
    .header-bar{height:5px;background:#e60012;margin-bottom:0}
    .header{background:#1a1a1a;color:#fff;padding:18px 36px;display:flex;align-items:center;gap:20px}
    .header-logo{height:34px;filter:brightness(0) invert(1)}
    .header-title{flex:1}
    .header-title h1{font-size:15px;font-weight:700;letter-spacing:.02em}
    .header-title p{font-size:11px;color:rgba(255,255,255,.55);margin-top:3px}
    .header-date{font-size:11px;color:rgba(255,255,255,.55);text-align:right}
    .section{margin:28px 0}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;border-bottom:2px solid #e5e5e5;padding-bottom:6px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .section-title::before{content:'';display:inline-block;width:3px;height:14px;background:#e60012;border-radius:2px;flex-shrink:0}
    .lic-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .lic-field label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#888;display:block;margin-bottom:3px}
    .lic-field span{font-size:13px;color:#1a1a1a}
    .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .stat{background:#f5f6fa;border-radius:6px;padding:12px 14px;border-top:3px solid #e60012;text-align:center}
    .stat.blue{border-top-color:#1565c0}
    .stat.green{border-top-color:#1a7f3c}
    .stat.amber{border-top-color:#ff8f00}
    .stat__lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:5px}
    .stat__val{font-size:1.3rem;font-weight:800;color:#1a1a1a}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f5f6fa;color:#555;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;text-align:left;border-bottom:2px solid #e5e5e5}
    th.r{text-align:right}
    td{border-bottom:1px solid #f0f0f0}
    .winner-box{background:#fff5f5;border:2px solid rgba(230,0,18,.2);border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:14px}
    .winner-box .trophy{font-size:1.6rem}
    .winner-box__label{font-size:10px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:.08em}
    .winner-box__name{font-size:1.1rem;font-weight:800;color:#1a1a1a}
    .riesgo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .conclusiones{background:#f5f6fa;border-radius:6px;padding:14px 18px}
    .conclusiones ul{padding-left:18px;line-height:1.8}
    .footer{border-top:1px solid #e5e5e5;margin-top:36px;padding-top:14px;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:0}}
  </style>
</head>
<body>
<div class="header-bar"></div>
<div class="header">
  <img src="logo.png" class="header-logo" alt="Hitachi Rail"/>
  <div class="header-title">
    <h1>Informe Ejecutivo — Análisis de Licitación</h1>
    <p>Cálculo de Bajas · ADIF / Renfe · Uso interno Hitachi Rail</p>
  </div>
  <div class="header-date">Generado el<br/>${hoy}</div>
</div>

<div class="page">

  <div class="section">
    <div class="section-title">Datos de la licitación</div>
    <div class="lic-grid">
      <div class="lic-field" style="grid-column:1/-1"><label>Proyecto / Contrato</label><span style="font-size:15px;font-weight:700">${lic.nombre||'—'}</span></div>
      <div class="lic-field"><label>Código de expediente</label><span>${lic.codigo||'—'}</span></div>
      <div class="lic-field"><label>Entidad convocante</label><span>${lic.entidad||'—'}</span></div>
      <div class="lic-field"><label>Fecha de análisis</label><span>${lic.fecha||hoy}</span></div>
      <div class="lic-field"><label>Estado</label><span>${estadoLabel[lic.estado]||lic.estado||'—'}</span></div>
      <div class="lic-field"><label>Presupuesto base</label><span style="font-weight:700">${cfg.presupuesto?eur(cfg.presupuesto):'—'}</span></div>
      <div class="lic-field"><label>Criterios (PE / PT)</label><span>${cfg.pmaxEco} pts / ${cfg.pmaxTec} pts</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Indicadores estadísticos</div>
    <div class="stats-grid">
      <div class="stat"><div class="stat__lbl">Baja Media (BM)</div><div class="stat__val">${pct(res.stats.BM)}</div></div>
      <div class="stat blue"><div class="stat__lbl">Desv. típica (σ)</div><div class="stat__val">${pct(res.stats.sigma)}</div></div>
      <div class="stat green"><div class="stat__lbl">Baja Referencia (BR)</div><div class="stat__val">${pct(res.stats.BR)}</div></div>
      <div class="stat amber"><div class="stat__lbl">Umbral temeridad</div><div class="stat__val">${pct(res.stats.umbralTemeridad)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Clasificación final — Escenario B (exclusión de temerarias)</div>
    ${ganador ? `<div class="winner-box"><span class="trophy">🏆</span><div><div class="winner-box__label">Oferta ganadora</div><div class="winner-box__name">${ganador.nombre}</div></div><div style="margin-left:auto;text-align:right"><div style="font-size:10px;color:#888">PG</div><div style="font-size:1.3rem;font-weight:800">${fmt(ganador.pg_B)} pts</div></div></div>` : ''}
    <table>
      <thead><tr>
        <th style="width:40px;text-align:center">#</th>
        <th>Empresa</th>
        <th class="r">Baja %</th>
        <th class="r">Precio</th>
        <th class="r">PT</th>
        <th class="r">PE</th>
        <th class="r">PG</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="font-size:10px;color:#888;margin-top:8px">Escenario B: las ofertas temerarias reciben PE=0. Referencia económica = baja máxima no temeraria.</p>
  </div>

  <div class="section">
    <div class="section-title">Análisis de riesgo de temeridad</div>
    <div class="riesgo-grid">${riesgos}</div>
  </div>

  ${conclusiones.length ? `
  <div class="section">
    <div class="section-title">Conclusiones principales</div>
    <div class="conclusiones"><ul>${conclusiones.join('')}</ul></div>
  </div>` : ''}

  <div class="footer">
    <span>Hitachi Rail Europe — Documento de uso interno</span>
    <span>Generado automáticamente · ${hoy}</span>
  </div>
</div>

<script>window.print();<\/script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=960,height=800');
    if (!w) { this._toast('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para esta página.'); return; }
    w.document.write(html);
    w.document.close();
  },

  /* ── Limpiar ────────────────────────────────────────────────── */
  limpiar() {
    document.getElementById('empresasBody').innerHTML = '';
    document.getElementById('resultsSection').hidden = true;
    document.getElementById('optimoResult').innerHTML = '';
    document.getElementById('sensBody').innerHTML = '';
    document.getElementById('btnGuardar').disabled = true;
    document.getElementById('btnInforme').disabled = true;
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
