/**
 * Motor de cálculo para licitaciones ferroviarias ADIF/Renfe.
 * Replica la lógica del Excel "Cálculo de Bajas.xlsm"
 *
 * Todas las bajas se manejan en PORCENTAJE (ej: 3.5 = 3.5%)
 */

const Calc = {

  /**
   * Estadísticas base de las bajas ofertadas.
   * @param {number[]} bajas - Bajas en % con valores > 0
   */
  estadisticas(bajas) {
    const v = bajas.filter(b => b != null && b > 0);
    const n = v.length;
    if (n === 0) return null;

    const BM = v.reduce((s, b) => s + b, 0) / n;
    const sigma = Math.sqrt(
      Math.max(0, v.reduce((s, b) => s + b * b, 0) / n - BM * BM)
    );

    const enSigma = v.filter(b => Math.abs(b - BM) <= sigma);
    const BR = enSigma.length
      ? enSigma.reduce((s, b) => s + b, 0) / enSigma.length
      : BM;

    const ref = n >= 5 ? BR : BM;
    const rangoAnormalidad = 100 / (5 * ref);
    const umbralTemeridad = ref + rangoAnormalidad;

    return { n, BM, sigma, BR, ref, rangoAnormalidad, umbralTemeridad };
  },

  /**
   * Nivel de riesgo de temeridad de una baja.
   * @param {number} baja - Baja de la empresa en %
   * @param {number} umbral - Umbral de temeridad en %
   */
  nivelRiesgo(baja, umbral) {
    const d = umbral - baja;
    if (baja >= umbral)   return { nivel: 'Temeraria', clase: 'danger',   distancia: 0 };
    if (d < 1.0)          return { nivel: 'Riesgo alto',   clase: 'danger',  distancia: d };
    if (d < 2.5)          return { nivel: 'Riesgo medio',  clase: 'warning', distancia: d };
    return                       { nivel: 'Riesgo bajo',   clase: 'success', distancia: d };
  },

  /**
   * Cálculo completo de puntuaciones — devuelve ambos escenarios.
   *
   * Escenario A (conTemerarias):  BO_ref = mayor baja absoluta
   * Escenario B (sinTemerarias):  BO_ref = mayor baja no temeraria; PE=0 si temeraria
   *
   * @param {Object} cfg - { presupuesto, pmaxEco, pmaxTec, umbralMinTec }
   * @param {Array}  empresas - [{ nombre, baja, valoracionTecnica, experiencia, esHitachi, estado }]
   */
  calcular(cfg, empresas) {
    const {
      presupuesto,
      pmaxEco   = 51,
      pmaxTec   = 49,
      umbralMinTec = 30,
    } = cfg;

    // Solo empresas con baja válida (estado != 'excluida')
    const activas = empresas.filter(e =>
      e.baja != null && e.baja > 0 && e.estado !== 'excluida'
    );
    if (activas.length < 1) return null;

    const stats = this.estadisticas(activas.map(e => e.baja));
    if (!stats) return null;

    // Marcar temerarias
    const flagged = activas.map(e => ({
      ...e,
      precio: presupuesto * (1 - e.baja / 100),
      esTemeraria: e.baja > stats.umbralTemeridad,
    }));

    // Referencias PE
    const noTem = flagged.filter(e => !e.esTemeraria);
    const boMaxNoTem = noTem.length > 0
      ? Math.max(...noTem.map(e => e.baja))
      : 0;
    const boMaxAbs = Math.max(...flagged.map(e => e.baja));

    const maxValTec = Math.max(0, ...flagged.map(e => e.valoracionTecnica || 0));

    const peParabolica = (bo, ref) => {
      if (!ref || ref <= 0) return 0;
      const r = bo / ref;
      return pmaxEco * (2 * r - r * r);
    };

    const resultados = flagged.map(e => {
      const pt = maxValTec > 0
        ? (e.valoracionTecnica || 0) / maxValTec * pmaxTec
        : 0;
      const cumpleTec = pt >= umbralMinTec;
      const exp = e.experiencia || 0;

      // Escenario B: Sin temerarias (referencia = mayor baja no temeraria)
      const pe_B = (e.esTemeraria || boMaxNoTem === 0) ? 0 : peParabolica(e.baja, boMaxNoTem);
      // Escenario A: Con todas (referencia = mayor baja absoluta)
      const pe_A = peParabolica(e.baja, boMaxAbs);

      const riesgo = this.nivelRiesgo(e.baja, stats.umbralTemeridad);

      return {
        ...e,
        pt,
        cumpleTec,
        pe_A,     // Escenario A
        pe_B,     // Escenario B
        pg_A: cumpleTec ? +(pt + pe_A + exp).toFixed(4) : null,  // Escenario A
        pg_B: cumpleTec ? +(pt + pe_B + exp).toFixed(4) : null,  // Escenario B
        riesgo,
        // Aliases legacy para compatibilidad
        pe_sinTem: pe_B,
        pe_conTem: pe_A,
        pg_sinTem: cumpleTec ? +(pt + pe_B + exp).toFixed(4) : null,
        pg_conTem: cumpleTec ? +(pt + pe_A + exp).toFixed(4) : null,
      };
    });

    return { stats, boMaxNoTem, boMaxAbs, maxValTec, resultados };
  },

  /**
   * Tabla de sensibilidad: cómo evoluciona la PG de Hitachi con su baja.
   * Permite al simulador mostrar la tabla de escenarios de baja.
   */
  tablaSensibilidad(cfg, competidores, hitachiBase, step = 0.1) {
    const rows = [];
    let pasedTemeraria = 0; // contamos filas tras temeraria para mostrar zona roja
    const MAX_BAJA = 40;

    for (let baja = step; baja <= MAX_BAJA; baja = +(baja + step).toFixed(6)) {
      const hitachi = { ...hitachiBase, baja, esHitachi: true, estado: 'valida' };
      const res = this.calcular(cfg, [...competidores, hitachi]);
      if (!res) break;

      const rH = res.resultados.find(e => e.esHitachi);
      if (!rH) break;

      // Competidores válidos (sin Hitachi) ordenados por PG_B desc
      const otros = res.resultados
        .filter(e => !e.esHitachi && e.pg_B !== null)
        .sort((a, b) => (b.pg_B || 0) - (a.pg_B || 0));

      const pgMaxOtros = otros.length ? (otros[0].pg_B || 0) : 0;

      // Posición de Hitachi en escenario B
      const todosOrdenados = res.resultados
        .filter(e => e.pg_B !== null)
        .sort((a, b) => (b.pg_B || 0) - (a.pg_B || 0));
      const posicion = todosOrdenados.findIndex(e => e.esHitachi) + 1;

      rows.push({
        baja,
        precio: cfg.presupuesto * (1 - baja / 100),
        pt: rH.pt,
        pe: rH.pe_B,
        pg: rH.pg_B,
        pgMaxOtros,
        diferencia: +(((rH.pg_B || 0) - pgMaxOtros)).toFixed(3),
        posicion,
        esTemeraria: rH.esTemeraria,
        umbral: res.stats.umbralTemeridad,
        gana: posicion === 1 && !rH.esTemeraria && rH.pg_B !== null,
      });

      if (rH.esTemeraria) {
        pasedTemeraria++;
        if (pasedTemeraria >= 3) break; // mostrar 3 filas temerarias
      }
    }

    return rows;
  },

  /**
   * Baja óptima iterativa para Hitachi.
   */
  bajaOptima(cfg, competidores, hitachiBase, step = 0.05) {
    const MAX_BAJA = 40;
    const MAX_ITER = Math.ceil(MAX_BAJA / step) + 1;
    let currentBaja = step;

    for (let i = 0; i < MAX_ITER; i++) {
      const hitachi = { ...hitachiBase, baja: currentBaja, esHitachi: true };
      const res = this.calcular(cfg, [...competidores, hitachi]);
      if (!res) break;

      const rH = res.resultados.find(e => e.esHitachi);
      if (!rH) break;

      if (!rH.cumpleTec) {
        return {
          error: `Hitachi no cumple el umbral técnico (PT = ${rH.pt.toFixed(2)} pts < ${cfg.umbralMinTec} pts)`,
          pt: rH.pt,
        };
      }

      if (rH.esTemeraria) {
        const pgOtros2 = res.resultados
          .filter(e => !e.esHitachi && e.pg_B !== null)
          .map(e => e.pg_B);
        return {
          gana: false,
          razon: 'La baja necesaria superaría el umbral de temeridad',
          bajaTemeridad: res.stats.umbralTemeridad,
          pgHitachi: rH.pg_B,
          pgMaxOtros: pgOtros2.length ? Math.max(...pgOtros2) : 0,
        };
      }

      const pgOtros = res.resultados
        .filter(e => !e.esHitachi && e.pg_B !== null)
        .map(e => e.pg_B);
      const pgMaxOtros = pgOtros.length ? Math.max(...pgOtros) : 0;
      const pgH = rH.pg_B ?? 0;

      if (pgH >= pgMaxOtros) {
        return {
          gana: true,
          bajaOptima: currentBaja,
          pgHitachi: pgH,
          pgMaxOtros,
          diferencia: +(pgH - pgMaxOtros).toFixed(4),
          resultado: res,
        };
      }

      currentBaja = +(currentBaja + step).toFixed(6);
    }

    return { error: 'No se puede ganar dentro del rango analizado (0 – 40%)' };
  },

  /** Formatea número como moneda EUR */
  fmtEUR(n) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(n);
  },

  /** Parsea cadena numérica en formato europeo o anglosajón */
  parseNum(str) {
    if (typeof str === 'number') return str;
    if (!str) return NaN;
    str = String(str).trim().replace(/[€$£\s]/g, '');
    const hasComma = str.includes(',');
    const hasDot   = str.includes('.');
    if (hasComma && hasDot) {
      return str.lastIndexOf(',') > str.lastIndexOf('.')
        ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
        : parseFloat(str.replace(/,/g, ''));
    }
    if (hasComma) return parseFloat(str.replace(',', '.'));
    return parseFloat(str);
  },
};
