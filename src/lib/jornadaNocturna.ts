/**
 * Cálculos de jornada y hora nocturna según el Código de Trabajo de Costa Rica
 * 
 * Referencias legales:
 * - Art. 136: Definición de jornada nocturna (19:00 - 05:00)
 * - Art. 137: Límites de jornada nocturna (6 horas/día, 36 horas/semana)
 * - Art. 138: Jornada mixta (3.5+ horas nocturnas = toda jornada es nocturna)
 * - Art. 139: Recargo por hora nocturna cuando salario es diurno
 * - Art. 140: Horas extraordinarias nocturnas (1.5x hora ordinaria nocturna)
 * - Art. 148: Feriados (pago doble, horas extras = triple)
 */

// ============================================
// CONSTANTES LEGALES
// ============================================

/** Hora de inicio de jornada nocturna (24h format) */
export const HORA_INICIO_NOCTURNA = 19; // 7:00 PM

/** Hora de fin de jornada nocturna (24h format) */
export const HORA_FIN_NOCTURNA = 5; // 5:00 AM

/** Límite máximo de horas diarias en jornada nocturna */
export const LIMITE_HORAS_NOCTURNAS_DIARIAS = 6;

/** Límite máximo de horas semanales en jornada nocturna */
export const LIMITE_HORAS_NOCTURNAS_SEMANALES = 36;

/** Horas nocturnas mínimas para convertir jornada mixta en nocturna */
export const HORAS_MIXTA_A_NOCTURNA = 3.5;

/** Factor de recargo para hora nocturna (jornada diurna reducida a 6h = factor 8/6) */
export const FACTOR_AJUSTE_HORA_NOCTURNA = 8 / 6; // 1.333...

/** Factor de hora extra estándar */
export const FACTOR_HORA_EXTRA = 1.5;

/** Factor de feriado (pago doble) */
export const FACTOR_FERIADO = 2.0;

/** Factor de hora extra en feriado (triple) */
export const FACTOR_HORA_EXTRA_FERIADO = 3.0;

// ============================================
// TIPOS
// ============================================

export interface HorasRegistradas {
  /** Total de horas diurnas ordinarias trabajadas */
  horasDiurnasOrdinarias: number;
  /** Total de horas nocturnas ordinarias trabajadas (19:00-05:00) */
  horasNocturnasOrdinarias: number;
  /** Horas extra diurnas (más de 8h en jornada diurna) */
  horasExtraDiurnas: number;
  /** Horas extra nocturnas (más de 6h en jornada nocturna) */
  horasExtraNocturnas: number;
  /** Horas trabajadas en feriados */
  horasFeriado: number;
  /** Horas extra trabajadas en feriados */
  horasExtraFeriado: number;
}

export interface ConfiguracionSalario {
  /** Salario mensual base */
  salarioMensual: number;
  /** Si el salario fue pactado como nocturno (no aplica recargo) */
  salarioPactadoNocturno: boolean;
  /** Tipo de contrato: mensual o por_horas */
  tipoContrato: 'mensual' | 'por_horas';
  /** Tarifa por hora si es por_horas */
  tarifaHora?: number;
}

export interface DesgloseSalarioNocturno {
  /** Tarifa hora diurna */
  tarifaHoraDiurna: number;
  /** Tarifa hora nocturna ordinaria */
  tarifaHoraNocturnaOrdinaria: number;
  /** Tarifa hora extra diurna (1.5x diurna) */
  tarifaHoraExtraDiurna: number;
  /** Tarifa hora extra nocturna (1.5x nocturna) */
  tarifaHoraExtraNocturna: number;
  /** Tarifa hora feriado (2x ordinaria) */
  tarifaHoraFeriado: number;
  /** Tarifa hora extra feriado (3x ordinaria ajustada) */
  tarifaHoraExtraFeriado: number;
  
  // Montos calculados
  montoHorasDiurnasOrdinarias: number;
  montoHorasNocturnasOrdinarias: number;
  montoHorasExtraDiurnas: number;
  montoHorasExtraNocturnas: number;
  montoHorasFeriado: number;
  montoHorasExtraFeriado: number;
  
  /** Total calculado */
  totalHoras: number;
  
  /** Resumen para notas */
  resumen: string;
}

export interface EntradaTiempo {
  /** Fecha de la entrada */
  fecha: Date;
  /** Hora de inicio (formato 24h, ej: 19.5 = 19:30) */
  horaInicio: number;
  /** Hora de fin (formato 24h) */
  horaFin: number;
  /** Si es día feriado de pago obligatorio */
  esFeriado: boolean;
}

// ============================================
// FUNCIONES DE CÁLCULO
// ============================================

/**
 * Determina si una hora específica está en rango nocturno (19:00 - 05:00)
 */
export function esHoraNocturna(hora: number): boolean {
  // Normalizar hora a 0-24
  const horaNormalizada = hora % 24;
  return horaNormalizada >= HORA_INICIO_NOCTURNA || horaNormalizada < HORA_FIN_NOCTURNA;
}

/**
 * Calcula las horas nocturnas en un rango de tiempo dado
 * @param horaInicio - Hora de inicio (0-24)
 * @param horaFin - Hora de fin (0-24, puede ser > 24 si cruza medianoche)
 * @returns Horas en rango nocturno
 */
export function calcularHorasNocturnasEnRango(horaInicio: number, horaFin: number): number {
  let horasNocturnas = 0;
  
  // Si horaFin <= horaInicio, asumimos que cruza medianoche
  if (horaFin <= horaInicio) {
    horaFin += 24;
  }
  
  // Iterar por cada hora del rango
  for (let h = Math.floor(horaInicio); h < Math.ceil(horaFin); h++) {
    const horaNormalizada = h % 24;
    const inicioHora = Math.max(horaInicio, h);
    const finHora = Math.min(horaFin, h + 1);
    const fraccion = finHora - inicioHora;
    
    if (esHoraNocturna(horaNormalizada)) {
      horasNocturnas += fraccion;
    }
  }
  
  return Math.round(horasNocturnas * 100) / 100;
}

/**
 * Calcula las horas diurnas en un rango de tiempo dado
 * @param horaInicio - Hora de inicio (0-24)
 * @param horaFin - Hora de fin (0-24)
 * @returns Horas en rango diurno
 */
export function calcularHorasDiurnasEnRango(horaInicio: number, horaFin: number): number {
  const totalHoras = horaFin > horaInicio ? horaFin - horaInicio : (24 - horaInicio) + horaFin;
  const horasNocturnas = calcularHorasNocturnasEnRango(horaInicio, horaFin);
  return Math.round((totalHoras - horasNocturnas) * 100) / 100;
}

/**
 * Determina si una jornada debe considerarse nocturna completa (regla 3.5h)
 * Art. 138: Si 3.5+ horas son nocturnas, toda la jornada se considera nocturna
 */
export function esJornadaMixtaConvertidaANocturna(horasNocturnas: number): boolean {
  return horasNocturnas >= HORAS_MIXTA_A_NOCTURNA;
}

/**
 * Calcula la tarifa horaria diurna a partir del salario mensual
 * Base: 30 días, 8 horas diarias = 240 horas/mes
 */
export function calcularTarifaHoraDiurna(salarioMensual: number): number {
  const horasMensualesDiurnas = 30 * 8; // 240 horas
  return salarioMensual / horasMensualesDiurnas;
}

/**
 * Calcula la tarifa horaria nocturna ordinaria
 * Si el salario es diurno, se ajusta por la reducción de jornada (8/6)
 * Si el salario fue pactado como nocturno, no hay recargo adicional
 */
export function calcularTarifaHoraNocturna(
  tarifaHoraDiurna: number, 
  salarioPactadoNocturno: boolean
): number {
  if (salarioPactadoNocturno) {
    // Si se pactó como nocturno, la hora nocturna = hora base
    return tarifaHoraDiurna;
  }
  // Si el salario es diurno, se ajusta por reducción de jornada
  return tarifaHoraDiurna * FACTOR_AJUSTE_HORA_NOCTURNA;
}

/**
 * Procesa las entradas de tiempo de un empleado y clasifica las horas
 * según tipo (diurnas/nocturnas/extras/feriado)
 */
export function procesarEntradasTiempo(entradas: EntradaTiempo[]): HorasRegistradas {
  const resultado: HorasRegistradas = {
    horasDiurnasOrdinarias: 0,
    horasNocturnasOrdinarias: 0,
    horasExtraDiurnas: 0,
    horasExtraNocturnas: 0,
    horasFeriado: 0,
    horasExtraFeriado: 0,
  };

  // Agrupar entradas por fecha para calcular extras diarios
  const entradasPorDia = new Map<string, EntradaTiempo[]>();
  
  entradas.forEach(entrada => {
    const fechaKey = entrada.fecha.toISOString().split('T')[0];
    if (!entradasPorDia.has(fechaKey)) {
      entradasPorDia.set(fechaKey, []);
    }
    entradasPorDia.get(fechaKey)!.push(entrada);
  });

  // Procesar cada día
  entradasPorDia.forEach((entradasDia, fechaKey) => {
    let horasDiurnasDia = 0;
    let horasNocturnasDia = 0;
    const esFeriado = entradasDia.some(e => e.esFeriado);

    // Calcular horas totales del día
    entradasDia.forEach(entrada => {
      const horasNocturnasEntrada = calcularHorasNocturnasEnRango(entrada.horaInicio, entrada.horaFin);
      const horasDiurnasEntrada = calcularHorasDiurnasEnRango(entrada.horaInicio, entrada.horaFin);
      
      horasNocturnasDia += horasNocturnasEntrada;
      horasDiurnasDia += horasDiurnasEntrada;
    });

    const totalHorasDia = horasDiurnasDia + horasNocturnasDia;

    // Si es jornada mixta que se convierte en nocturna (3.5+ h nocturnas)
    const jornadaConvertidaANocturna = esJornadaMixtaConvertidaANocturna(horasNocturnasDia);
    
    if (jornadaConvertidaANocturna) {
      // Toda la jornada se considera nocturna
      if (esFeriado) {
        if (totalHorasDia <= LIMITE_HORAS_NOCTURNAS_DIARIAS) {
          resultado.horasFeriado += totalHorasDia;
        } else {
          resultado.horasFeriado += LIMITE_HORAS_NOCTURNAS_DIARIAS;
          resultado.horasExtraFeriado += totalHorasDia - LIMITE_HORAS_NOCTURNAS_DIARIAS;
        }
      } else {
        if (totalHorasDia <= LIMITE_HORAS_NOCTURNAS_DIARIAS) {
          resultado.horasNocturnasOrdinarias += totalHorasDia;
        } else {
          resultado.horasNocturnasOrdinarias += LIMITE_HORAS_NOCTURNAS_DIARIAS;
          resultado.horasExtraNocturnas += totalHorasDia - LIMITE_HORAS_NOCTURNAS_DIARIAS;
        }
      }
    } else {
      // Jornada normal: clasificar por tipo
      if (esFeriado) {
        // En feriado, todo es pago doble
        resultado.horasFeriado += totalHorasDia;
        // Las extras en feriado se calculan aparte si > 8h diurnas o > 6h nocturnas
        if (horasDiurnasDia > 8) {
          resultado.horasExtraFeriado += horasDiurnasDia - 8;
          resultado.horasFeriado -= (horasDiurnasDia - 8);
        }
      } else {
        // Día normal
        // Horas diurnas: ordinarias hasta 8h, extras después
        if (horasDiurnasDia <= 8) {
          resultado.horasDiurnasOrdinarias += horasDiurnasDia;
        } else {
          resultado.horasDiurnasOrdinarias += 8;
          resultado.horasExtraDiurnas += horasDiurnasDia - 8;
        }
        
        // Horas nocturnas: ordinarias hasta 6h, extras después
        if (horasNocturnasDia <= LIMITE_HORAS_NOCTURNAS_DIARIAS) {
          resultado.horasNocturnasOrdinarias += horasNocturnasDia;
        } else {
          resultado.horasNocturnasOrdinarias += LIMITE_HORAS_NOCTURNAS_DIARIAS;
          resultado.horasExtraNocturnas += horasNocturnasDia - LIMITE_HORAS_NOCTURNAS_DIARIAS;
        }
      }
    }
  });

  // Redondear resultados
  Object.keys(resultado).forEach(key => {
    (resultado as any)[key] = Math.round((resultado as any)[key] * 100) / 100;
  });

  return resultado;
}

/**
 * Calcula el desglose salarial completo para horas nocturnas y mixtas
 */
export function calcularDesgloseSalarioNocturno(
  config: ConfiguracionSalario,
  horas: HorasRegistradas
): DesgloseSalarioNocturno {
  // Calcular tarifas base
  let tarifaHoraDiurna: number;
  
  if (config.tipoContrato === 'por_horas' && config.tarifaHora) {
    tarifaHoraDiurna = config.tarifaHora;
  } else {
    tarifaHoraDiurna = calcularTarifaHoraDiurna(config.salarioMensual);
  }
  
  const tarifaHoraNocturnaOrdinaria = calcularTarifaHoraNocturna(
    tarifaHoraDiurna, 
    config.salarioPactadoNocturno
  );
  const tarifaHoraExtraDiurna = tarifaHoraDiurna * FACTOR_HORA_EXTRA;
  const tarifaHoraExtraNocturna = tarifaHoraNocturnaOrdinaria * FACTOR_HORA_EXTRA;
  const tarifaHoraFeriado = tarifaHoraDiurna * FACTOR_FERIADO;
  const tarifaHoraExtraFeriado = tarifaHoraDiurna * FACTOR_HORA_EXTRA_FERIADO;
  
  // Calcular montos
  const montoHorasDiurnasOrdinarias = horas.horasDiurnasOrdinarias * tarifaHoraDiurna;
  const montoHorasNocturnasOrdinarias = horas.horasNocturnasOrdinarias * tarifaHoraNocturnaOrdinaria;
  const montoHorasExtraDiurnas = horas.horasExtraDiurnas * tarifaHoraExtraDiurna;
  const montoHorasExtraNocturnas = horas.horasExtraNocturnas * tarifaHoraExtraNocturna;
  const montoHorasFeriado = horas.horasFeriado * tarifaHoraFeriado;
  const montoHorasExtraFeriado = horas.horasExtraFeriado * tarifaHoraExtraFeriado;
  
  const totalHoras = 
    montoHorasDiurnasOrdinarias +
    montoHorasNocturnasOrdinarias +
    montoHorasExtraDiurnas +
    montoHorasExtraNocturnas +
    montoHorasFeriado +
    montoHorasExtraFeriado;

  // Generar resumen
  const partes: string[] = [];
  if (horas.horasDiurnasOrdinarias > 0) partes.push(`Diurnas: ${horas.horasDiurnasOrdinarias}h`);
  if (horas.horasNocturnasOrdinarias > 0) partes.push(`Nocturnas: ${horas.horasNocturnasOrdinarias}h`);
  if (horas.horasExtraDiurnas > 0) partes.push(`Extras diurnas: ${horas.horasExtraDiurnas}h`);
  if (horas.horasExtraNocturnas > 0) partes.push(`Extras nocturnas: ${horas.horasExtraNocturnas}h`);
  if (horas.horasFeriado > 0) partes.push(`Feriado: ${horas.horasFeriado}h`);
  if (horas.horasExtraFeriado > 0) partes.push(`Extras feriado: ${horas.horasExtraFeriado}h`);

  return {
    tarifaHoraDiurna: Math.round(tarifaHoraDiurna * 100) / 100,
    tarifaHoraNocturnaOrdinaria: Math.round(tarifaHoraNocturnaOrdinaria * 100) / 100,
    tarifaHoraExtraDiurna: Math.round(tarifaHoraExtraDiurna * 100) / 100,
    tarifaHoraExtraNocturna: Math.round(tarifaHoraExtraNocturna * 100) / 100,
    tarifaHoraFeriado: Math.round(tarifaHoraFeriado * 100) / 100,
    tarifaHoraExtraFeriado: Math.round(tarifaHoraExtraFeriado * 100) / 100,
    
    montoHorasDiurnasOrdinarias: Math.round(montoHorasDiurnasOrdinarias * 100) / 100,
    montoHorasNocturnasOrdinarias: Math.round(montoHorasNocturnasOrdinarias * 100) / 100,
    montoHorasExtraDiurnas: Math.round(montoHorasExtraDiurnas * 100) / 100,
    montoHorasExtraNocturnas: Math.round(montoHorasExtraNocturnas * 100) / 100,
    montoHorasFeriado: Math.round(montoHorasFeriado * 100) / 100,
    montoHorasExtraFeriado: Math.round(montoHorasExtraFeriado * 100) / 100,
    
    totalHoras: Math.round(totalHoras * 100) / 100,
    resumen: partes.join(' | ') || 'Sin horas registradas'
  };
}

/**
 * Valida que las horas nocturnas semanales no excedan el límite legal
 * @returns Mensaje de advertencia si excede, null si está OK
 */
export function validarLimiteHorasNocturnasSemanales(
  horasNocturnas: number
): string | null {
  if (horasNocturnas > LIMITE_HORAS_NOCTURNAS_SEMANALES) {
    return `Las horas nocturnas (${horasNocturnas}h) exceden el límite semanal legal de ${LIMITE_HORAS_NOCTURNAS_SEMANALES}h. El exceso debe pagarse como hora extra nocturna.`;
  }
  return null;
}

/**
 * Lista de feriados de pago obligatorio en Costa Rica (Art. 148)
 * Actualizar cada año
 */
export const FERIADOS_PAGO_OBLIGATORIO_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-04-11', // Día de Juan Santamaría
  '2026-05-01', // Día del Trabajador
  '2026-07-25', // Anexión de Guanacaste
  '2026-08-02', // Día de la Virgen de los Ángeles
  '2026-08-15', // Día de la Madre
  '2026-09-15', // Día de la Independencia
  '2026-12-01', // Abolición del Ejército
  '2026-12-25', // Navidad
];

/**
 * Verifica si una fecha es feriado de pago obligatorio
 */
export function esFeriadoPagoObligatorio(fecha: Date | string): boolean {
  const fechaStr = typeof fecha === 'string' 
    ? fecha.split('T')[0] 
    : fecha.toISOString().split('T')[0];
  
  return FERIADOS_PAGO_OBLIGATORIO_2026.includes(fechaStr);
}
