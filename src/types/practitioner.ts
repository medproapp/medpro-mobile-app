export interface PractitionerProfile {
  email: string;
  cpf?: string;
  active?: number;
  name?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  phone?: string;
  photo?: string;
  qualification?: string;
  qualifications?: string;
  certifications?: string;
  crm?: string;
  cnpj?: string;
  category?: string;
  city?: string;
  state?: string;
  medsite?: string;
  cep?: string;
  cityname?: string;
  bio?: string;
  valoratendimento?: string | number | null;
  tempoatendimento?: string | number | null;
  intervaloatendimentos?: string | number | null;
}

export type PractitionerProfileField = keyof PractitionerProfile;
