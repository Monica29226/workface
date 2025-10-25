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
 * Calcula la cesantía según art. 29 Código de Trabajo
 * Solo aplica en despido sin justa causa
 */
export function calcularCesantia(params: LiquidacionParams): {
  monto: number;
  dias: number;
  detalle: string;
} {
  const { fechaIngreso, fechaSalida, salarioPromedio, motivoSalida } = params;
  
  // Solo aplica en despido sin responsabilidad patronal
  if (motivoSalida !== 'despido_sin_responsabilidad') {
    return {
      monto: 0,
      dias: 0,
      detalle: motivoSalida === 'renuncia' 
        ? 'No aplica (renuncia)' 
        : 'No aplica (despido con justa causa)'
    };
  }
  
  const tiempo = calcularTiempoTrabajado(fechaIngreso, fechaSalida);
  const meses = tiempo.mesesTotales;
  const años = tiempo.años;
  
  let diasCesantia = 0;
  let detalle = '';
  
  if (meses < 3) {
    diasCesantia = 0;
    detalle = 'No aplica (menos de 3 meses)';
  } else if (meses < 6) {
    // 7 días por mes trabajado
    diasCesantia = 7 * meses;
    detalle = `7 días x ${meses} meses = ${diasCesantia} días`;
  } else if (meses < 12) {
    // 14 días por mes trabajado
    diasCesantia = 14 * meses;
    detalle = `14 días x ${meses} meses = ${diasCesantia} días`;
  } else {
    // Por cada año completo según escala
    let diasPorAño: number;
    
    if (años <= 8) {
      diasPorAño = 19.5;
    } else if (años <= 9) {
      diasPorAño = 20;
    } else if (años <= 10) {
      diasPorAño = 21;
    } else {
      diasPorAño = 22;
    }
    
    diasCesantia = diasPorAño * años;
    detalle = `${diasPorAño} días x ${años} años = ${diasCesantia} días`;
  }
  
  const salarioDiario = salarioPromedio / 30;
  const monto = salarioDiario * diasCesantia;
  
  return {
    monto,
    dias: diasCesantia,
    detalle
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