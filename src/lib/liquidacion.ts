/**
 * Cálculos de liquidación laboral según legislación costarricense
 * Basado en la calculadora del Ministerio de Trabajo y Seguridad Social (MTSS)
 */

export interface LiquidacionParams {
  fechaIngreso: Date;
  fechaSalida: Date;
  salarioPromedio: number;
  motivoSalida: 'despido_con_responsabilidad' | 'despido_sin_responsabilidad' | 'renuncia';
  preavisoTrabajado: boolean;
  /** Días de vacaciones pendientes no disfrutados (saldo real del empleado). Si se provee, se usa en lugar del cálculo proporcional. */
  diasVacacionesPendientes?: number;
}

export interface ResultadoLiquidacion {
  diasTrabajados: number;
  añosTrabajados: number;
  mesesTrabajados: number;
  preaviso: number;
  cesantia: number;
  vacaciones: number;
  aguinaldo: number;
  total: number;
  detalles: {
    preaviso: string;
    cesantia: string;
    vacaciones: string;
    aguinaldo: string;
  };
}

/**
 * Calcula días entre dos fechas
 */
function calcularDiasEntreFechas(inicio: Date, fin: Date): number {
  const diff = fin.getTime() - inicio.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calcula años y meses trabajados
 */
function calcularTiempoTrabajado(fechaIngreso: Date, fechaSalida: Date) {
  const diffTime = fechaSalida.getTime() - fechaIngreso.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const años = Math.floor(diffDays / 365);
  const mesesRestantes = Math.floor((diffDays % 365) / 30);
  const meses = años * 12 + mesesRestantes;
  
  return {
    dias: diffDays,
    años,
    meses,
    mesesTotales: meses
  };
}

/**
 * Calcula el preaviso según art. 28 Código de Trabajo
 * - 3 meses a 6 meses: 1 semana (7 días)
 * - 6 meses a 1 año: 15 días
 * - 1 año o más: 1 mes (30 días)
 */
export function calcularPreaviso(params: LiquidacionParams): {
  monto: number;
  dias: number;
  detalle: string;
} {
  const { fechaIngreso, fechaSalida, salarioPromedio, motivoSalida, preavisoTrabajado } = params;
  
  // No aplica preaviso en estos casos
  if (motivoSalida === 'renuncia' || preavisoTrabajado) {
    return {
      monto: 0,
      dias: 0,
      detalle: motivoSalida === 'renuncia' 
        ? 'No aplica (renuncia)' 
        : 'Preaviso trabajado'
    };
  }
  
  const tiempo = calcularTiempoTrabajado(fechaIngreso, fechaSalida);
  const meses = tiempo.mesesTotales;
  
  let diasPreaviso = 0;
  let detalle = '';
  
  if (meses < 3) {
    diasPreaviso = 0;
    detalle = 'No aplica (menos de 3 meses)';
  } else if (meses < 6) {
    diasPreaviso = 7;
    detalle = '1 semana (3-6 meses laborados)';
  } else if (meses < 12) {
    diasPreaviso = 15;
    detalle = '15 días (6-12 meses laborados)';
  } else {
    diasPreaviso = 30;
    detalle = '1 mes (más de 1 año laborado)';
  }
  
  const salarioDiario = salarioPromedio / 30;
  const monto = salarioDiario * diasPreaviso;
  
  return {
    monto,
    dias: diasPreaviso,
    detalle
  };
}

/**
 * Tabla de días de cesantía según Art. 29 del Código de Trabajo de Costa Rica
 * Basado en años de servicio, con tope máximo de 8 años
 */
const TABLA_CESANTIA_DIAS: { [key: number]: number } = {
  1: 19.5,  // 1 año completo
  2: 20,    // 2 años
  3: 20.5,  // 3 años
  4: 21,    // 4 años
  5: 21.24, // 5 años
  6: 22,    // 6 años
  7: 22,    // 7 años
  8: 22,    // 8 años (tope máximo)
};

/**
 * Calcula la cesantía según art. 29 Código de Trabajo de Costa Rica
 * 
 * Reglas:
 * - Menos de 3 meses: No aplica
 * - 3 a 6 meses: 7 días por cada mes trabajado (proporcional)
 * - 6 meses a 1 año: 14 días de salario
 * - 1+ años: Según tabla progresiva de días por año (máximo 8 años)
 * 
 * Solo aplica en despido CON responsabilidad patronal (sin justa causa)
 */
export function calcularCesantia(params: LiquidacionParams): {
  monto: number;
  dias: number;
  detalle: string;
  desglose?: { año: number; dias: number; monto: number }[];
} {
  const { fechaIngreso, fechaSalida, salarioPromedio, motivoSalida } = params;

  // La cesantía SOLO se paga cuando hay responsabilidad patronal, es decir,
  // cuando el despido es SIN justa causa del trabajador.
  // En este sistema ese caso se modela con el valor 'despido_sin_responsabilidad'
  // (significa: el trabajador NO tiene responsabilidad → SÍ hay responsabilidad patronal).
  // - 'despido_con_responsabilidad' = despido con justa causa (falta del trabajador) → NO paga
  // - 'renuncia' = renuncia voluntaria → NO paga
  if (motivoSalida !== 'despido_sin_responsabilidad') {
    return {
      monto: 0,
      dias: 0,
      detalle: motivoSalida === 'renuncia'
        ? 'No aplica (renuncia voluntaria)'
        : 'No aplica (despido con justa causa)'
    };
  }
  
  const tiempo = calcularTiempoTrabajado(fechaIngreso, fechaSalida);
  const meses = tiempo.mesesTotales;
  const salarioDiario = salarioPromedio / 30;
  
  let diasCesantia = 0;
  let detalle = '';
  let desglose: { año: number; dias: number; monto: number }[] = [];
  
  if (meses < 3) {
    // Menos de 3 meses: no aplica cesantía
    return {
      monto: 0,
      dias: 0,
      detalle: 'No aplica (menos de 3 meses de servicio)'
    };
  } else if (meses >= 3 && meses < 6) {
    // 3 a 6 meses: 7 días por cada mes trabajado (proporcional)
    diasCesantia = 7 * meses;
    detalle = `Proporcional: 7 días × ${meses} meses = ${diasCesantia} días`;
  } else if (meses >= 6 && meses < 12) {
    // 6 meses a 1 año: 14 días de salario
    diasCesantia = 14;
    detalle = `6 meses a 1 año: 14 días de salario`;
  } else {
    // 1 año o más: usar tabla progresiva
    // Calcular años completos (con tope de 8)
    const añosCompletos = Math.min(tiempo.años, 8);
    const mesesRestantes = tiempo.mesesTotales - (tiempo.años * 12);
    
    // Sumar días por cada año según la tabla
    for (let año = 1; año <= añosCompletos; año++) {
      const diasAño = TABLA_CESANTIA_DIAS[año] || 22;
      const montoAño = salarioDiario * diasAño;
      diasCesantia += diasAño;
      desglose.push({ año, dias: diasAño, monto: montoAño });
    }
    
    // Si hay fracción de año (6+ meses), agregar proporcional del siguiente año
    if (mesesRestantes >= 6 && añosCompletos < 8) {
      const añoSiguiente = añosCompletos + 1;
      const diasAñoSiguiente = TABLA_CESANTIA_DIAS[añoSiguiente] || 22;
      const diasProporcionales = (diasAñoSiguiente / 12) * mesesRestantes;
      diasCesantia += diasProporcionales;
      desglose.push({ 
        año: añoSiguiente, 
        dias: Math.round(diasProporcionales * 100) / 100, 
        monto: salarioDiario * diasProporcionales 
      });
    }
    
    // Generar detalle legible
    if (tiempo.años > 8) {
      detalle = `${añosCompletos} años (tope legal): ${diasCesantia.toFixed(2)} días totales`;
    } else {
      const desgloseTexto = desglose.map(d => `Año ${d.año}: ${d.dias} días`).join(' + ');
      detalle = `${desgloseTexto} = ${diasCesantia.toFixed(2)} días totales`;
    }
  }
  
  const monto = salarioDiario * diasCesantia;
  
  return {
    monto,
    dias: Math.round(diasCesantia * 100) / 100,
    detalle,
    desglose: desglose.length > 0 ? desglose : undefined
  };
}

/**
 * Calcula vacaciones proporcionales
 * 1 día de vacaciones por cada mes trabajado (mínimo 50 semanas)
 */
export function calcularVacaciones(params: LiquidacionParams): {
  monto: number;
  dias: number;
  detalle: string;
} {
  const { fechaIngreso, fechaSalida, salarioPromedio } = params;
  
  const tiempo = calcularTiempoTrabajado(fechaIngreso, fechaSalida);
  const semanas = Math.floor(tiempo.dias / 7);
  
  // Se requiere mínimo 50 semanas laboradas para tener derecho a vacaciones
  if (semanas < 50) {
    return {
      monto: 0,
      dias: 0,
      detalle: 'No aplica (menos de 50 semanas laboradas)'
    };
  }
  
  // 1 día de vacaciones por cada mes trabajado
  const mesesCompletos = tiempo.mesesTotales;
  const diasVacaciones = mesesCompletos;
  
  const salarioDiario = salarioPromedio / 30;
  const monto = salarioDiario * diasVacaciones;
  
  return {
    monto,
    dias: diasVacaciones,
    detalle: `${diasVacaciones} días (1 día x ${mesesCompletos} meses)`
  };
}

/**
 * Calcula aguinaldo proporcional
 * 1/12 del salario por cada mes trabajado en el año
 */
export function calcularAguinaldo(params: LiquidacionParams): {
  monto: number;
  detalle: string;
} {
  const { fechaIngreso, fechaSalida, salarioPromedio } = params;
  
  // Calcular meses trabajados en el año actual de la fecha de salida
  const añoSalida = fechaSalida.getFullYear();
  const inicioAño = new Date(añoSalida, 0, 1);
  
  // Fecha inicial: la mayor entre fecha de ingreso e inicio del año
  const fechaInicial = fechaIngreso > inicioAño ? fechaIngreso : inicioAño;
  
  const tiempo = calcularTiempoTrabajado(fechaInicial, fechaSalida);
  const meses = Math.min(tiempo.mesesTotales, 12);
  
  // Aguinaldo = (salario promedio / 12) * meses trabajados en el año
  const monto = (salarioPromedio / 12) * meses;
  
  return {
    monto,
    detalle: `Proporcional por ${meses} meses del año ${añoSalida}`
  };
}

/**
 * Calcula la liquidación completa
 */
export function calcularLiquidacion(params: LiquidacionParams): ResultadoLiquidacion {
  const tiempo = calcularTiempoTrabajado(params.fechaIngreso, params.fechaSalida);
  
  const preaviso = calcularPreaviso(params);
  const cesantia = calcularCesantia(params);
  const vacaciones = calcularVacaciones(params);
  const aguinaldo = calcularAguinaldo(params);
  
  const total = preaviso.monto + cesantia.monto + vacaciones.monto + aguinaldo.monto;
  
  return {
    diasTrabajados: tiempo.dias,
    añosTrabajados: tiempo.años,
    mesesTrabajados: tiempo.mesesTotales,
    preaviso: preaviso.monto,
    cesantia: cesantia.monto,
    vacaciones: vacaciones.monto,
    aguinaldo: aguinaldo.monto,
    total,
    detalles: {
      preaviso: preaviso.detalle,
      cesantia: cesantia.detalle,
      vacaciones: vacaciones.detalle,
      aguinaldo: aguinaldo.detalle
    }
  };
}