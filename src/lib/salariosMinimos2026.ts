/**
 * Salarios mínimos Costa Rica 2026
 * Fuente: Ministerio de Trabajo y Seguridad Social (MTSS)
 * Decreto vigente desde el 01 de enero de 2026
 */

export interface SalarioMinimo {
  categoria: string;
  codigo: string;
  monto: number;
  descripcion: string;
}

export const SALARIOS_MINIMOS_2026: SalarioMinimo[] = [
  // Trabajadores No Calificados
  { codigo: 'TONC', categoria: 'Trabajador No Calificado Genérico', monto: 12236.95, descripcion: 'Trabajos que requieren principalmente esfuerzo físico' },
  
  // Trabajadores Semi-Calificados
  { codigo: 'TOSC', categoria: 'Trabajador Semi-Calificado Genérico', monto: 13306.79, descripcion: 'Trabajos que requieren alguna experiencia o entrenamiento' },
  
  // Trabajadores Calificados
  { codigo: 'TOC', categoria: 'Trabajador Calificado Genérico', monto: 13767.45, descripcion: 'Trabajos que requieren formación técnica o experiencia significativa' },
  
  // Trabajadores Especializados
  { codigo: 'TOE', categoria: 'Trabajador Especializado Genérico', monto: 15983.96, descripcion: 'Trabajos que requieren conocimientos especializados' },
  
  // Técnicos Medios
  { codigo: 'TMED', categoria: 'Técnico Medio', monto: 432819.25, descripcion: 'Técnicos con educación técnica media' },
  
  // Diplomados
  { codigo: 'DIP', categoria: 'Diplomado', monto: 545537.04, descripcion: 'Profesionales con diplomado universitario' },
  
  // Bachilleres Universitarios
  { codigo: 'BACH', categoria: 'Bachiller Universitario', monto: 653427.21, descripcion: 'Profesionales con grado de bachiller universitario' },
  
  // Licenciados
  { codigo: 'LIC', categoria: 'Licenciado', monto: 784139.53, descripcion: 'Profesionales con grado de licenciatura' },
];

/**
 * Obtiene el salario mínimo más bajo (trabajador no calificado)
 */
export function getSalarioMinimoBase(): number {
  return SALARIOS_MINIMOS_2026.find(s => s.codigo === 'TONC')?.monto || 12236.95;
}

/**
 * Verifica si un salario está por debajo del mínimo legal
 */
export function estaBajoSalarioMinimo(salario: number): boolean {
  const minimo = getSalarioMinimoBase();
  return salario < minimo;
}

/**
 * Obtiene la diferencia entre un salario y el mínimo legal
 */
export function getDiferenciaSalarioMinimo(salario: number): number {
  const minimo = getSalarioMinimoBase();
  return minimo - salario;
}

/**
 * Obtiene el salario mínimo por categoría
 */
export function getSalarioMinimoPorCategoria(codigo: string): SalarioMinimo | undefined {
  return SALARIOS_MINIMOS_2026.find(s => s.codigo === codigo);
}
