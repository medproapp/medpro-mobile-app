/**
 * Validates Brazilian CPF (Cadastro de Pessoas Físicas)
 * @param cpf - CPF string with or without formatting
 * @returns true if valid, false otherwise
 */
export function validateCPF(cpf: string): boolean {
  if (!cpf) return false;

  // Remove formatting
  const cleanCPF = cpf.replace(/\D/g, '');

  // Check length
  if (cleanCPF.length !== 11) return false;

  // Check for known invalid CPFs (all same digits)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let checkDigit = 11 - (sum % 11);
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0;
  if (checkDigit !== parseInt(cleanCPF.charAt(9))) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  checkDigit = 11 - (sum % 11);
  if (checkDigit === 10 || checkDigit === 11) checkDigit = 0;
  if (checkDigit !== parseInt(cleanCPF.charAt(10))) return false;

  return true;
}

/**
 * Validates Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica)
 * @param cnpj - CNPJ string with or without formatting
 * @returns true if valid, false otherwise
 */
export function validateCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;

  // Remove formatting
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  // Check length
  if (cleanCNPJ.length !== 14) return false;

  // Check for known invalid CNPJs (all same digits)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  // Validate first check digit
  let length = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, length);
  const digits = cleanCNPJ.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Validate second check digit
  length = length + 1;
  numbers = cleanCNPJ.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Formats CPF string
 * @param cpf - CPF string
 * @returns Formatted CPF (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formats CNPJ string
 * @param cnpj - CNPJ string
 * @returns Formatted CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formats phone number string
 * @param phone - Phone string
 * @returns Formatted phone ((00) 00000-0000)
 */
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 11) return phone;
  return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

/**
 * Formats CEP string
 * @param cep - CEP string
 * @returns Formatted CEP (00000-000)
 */
export function formatCEP(cep: string): string {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return cep;
  return clean.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Validates Brazilian phone number
 * @param phone - Phone string with or without formatting
 * @returns true if valid, false otherwise
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;

  // Remove formatting
  const cleanPhone = phone.replace(/\D/g, '');

  // Brazilian mobile numbers have 11 digits (2 for area code + 9 digits)
  // Landline numbers have 10 digits (2 for area code + 8 digits)
  if (cleanPhone.length !== 10 && cleanPhone.length !== 11) return false;

  // Area code should be between 11 and 99
  const areaCode = parseInt(cleanPhone.substring(0, 2));
  if (areaCode < 11 || areaCode > 99) return false;

  // For mobile numbers (11 digits), the first digit after area code should be 9
  if (cleanPhone.length === 11) {
    const firstDigit = cleanPhone.charAt(2);
    if (firstDigit !== '9') return false;
  }

  return true;
}

/**
 * Validates email format
 * @param email - Email string
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
