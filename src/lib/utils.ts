import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'CRC'): string {
  if (currency === 'CRC') {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(date: Date | string, locale: string = 'es-CR'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

export function calculateAge(birthDate: Date | string): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Payroll calculation utilities
export function calculateDailySalary(monthlySalary: number): number {
  return monthlySalary / 30;
}

export function calculateHourlySalary(dailySalary: number, dailyHours: number = 8): number {
  return dailySalary / dailyHours;
}

export function calculateOvertime(hourlyRate: number, hours: number, multiplier: number = 1.5): number {
  return hourlyRate * hours * multiplier;
}

export function calculateAguinaldo(totalSalaries: number, monthsWorked: number = 12): number {
  return (totalSalaries / 12) * (monthsWorked / 12);
}

export function calculateVacationDays(monthsWorked: number, daysPerMonth: number = 1.25): number {
  return monthsWorked * daysPerMonth;
}

export function calculateVacationAmount(dailySalary: number, vacationDays: number): number {
  return dailySalary * vacationDays;
}

export function calculateCCSS(salary: number, employeeRate: number = 0.105, employerRate: number = 0.26): { employee: number, employer: number } {
  return {
    employee: salary * employeeRate,
    employer: salary * employerRate
  };
}
