/**
 * Date utility functions for converting between ISO and Brazilian date formats
 */

/**
 * Convert ISO date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
 * @param isoDate - ISO format date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
 * @returns DD/MM/YYYY formatted string
 */
export function convertIsoToDisplayDate(isoDate: string): string {
  if (!isoDate) return '';

  try {
    // Extract just the date part (YYYY-MM-DD) if there's a time component
    const datePart = isoDate.split('T')[0];

    // Parse directly from string to avoid timezone issues
    const [year, month, day] = datePart.split('-').map(s => parseInt(s, 10));

    // Validate
    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return '';

    // Format with padding
    const paddedDay = String(day).padStart(2, '0');
    const paddedMonth = String(month).padStart(2, '0');

    return `${paddedDay}/${paddedMonth}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Convert Brazilian format date (DD/MM/YYYY) to ISO format (YYYY-MM-DD)
 * @param displayDate - DD/MM/YYYY formatted string
 * @returns ISO format date string (YYYY-MM-DD)
 */
export function convertDisplayDateToIso(displayDate: string): string {
  if (!displayDate) return '';

  try {
    const [day, month, year] = displayDate.split('/').map(s => parseInt(s.trim(), 10));

    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
    if (day < 1 || day > 31 || month < 1 || month > 12) return '';

    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');

    return `${year}-${paddedMonth}-${paddedDay}`;
  } catch {
    return '';
  }
}

/**
 * Format date string to Brazilian locale
 * @param dateString - ISO format or any valid date string
 * @returns Formatted date in pt-BR locale (DD/MM/YYYY)
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '-';

  try {
    return new Date(dateString).toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

/**
 * Format datetime string to Brazilian locale
 * @param dateString - ISO format or any valid date string
 * @returns Formatted datetime in pt-BR locale (DD/MM/YYYY HH:mm:ss)
 */
export function formatDateTime(dateString?: string): string {
  if (!dateString) return '-';

  try {
    return new Date(dateString).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}
