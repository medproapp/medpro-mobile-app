import { theme } from '@theme/index';
import { logger } from '@/utils/logger';

type NullableString = string | null | undefined;

type Dictionary = Record<string, string>;

const normalizeKey = (value: NullableString): string | null => {
  if (!value) return null;
  return value.toString().trim().toLowerCase();
};

export const translateClinicalType = (value?: string | null): string | null => {
  const normalized = normalizeKey(value);
  if (!normalized) return value ?? null;

  const dictionary: Dictionary = {
    servicerequest: 'Solicitação',
    observation: 'Observação',
    consultation: 'Consulta',
    procedure: 'Procedimento',
    medicationrequest: 'Prescrição',
    diagnosticreport: 'Relatório Diagnóstico',
  };

  return dictionary[normalized] || value || null;
};

export const translateClinicalStatus = (value?: string | null): string | null => {
  const normalized = normalizeKey(value);
  if (!normalized) return value ?? null;

  const dictionary: Dictionary = {
    completed: 'Concluído',
    draft: 'Rascunho',
    active: 'Ativo',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
    unknown: 'Desconhecido',
    onhold: 'Em espera',
    'on-hold': 'Em espera',
    revoked: 'Revogado',
    requested: 'Solicitado',
    pending: 'Pendente',
  };

  return dictionary[normalized] || value || null;
};

export const translateClinicalCategory = (value?: string | null): string | null => {
  const normalized = normalizeKey(value);
  if (!normalized) return value ?? null;

  const dictionary: Dictionary = {
    lab: 'Laboratório',
    laboratory: 'Laboratório',
    imaging: 'Imagem',
    procedure: 'Procedimento',
    medication: 'Medicação',
    observation: 'Observação',
  };

  return dictionary[normalized] || value || null;
};

export const formatClinicalDateTime = (dateString?: string | null): string | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    logger.warn('[clinical] Failed to format date:', error);
    return date.toISOString();
  }
};

export const getStatusBadgeStyle = (status?: string | null) => {
  const normalized = normalizeKey(status);

  switch (normalized) {
    case 'completed':
      return {
        container: {
          backgroundColor: theme.colors.success,
          borderColor: theme.colors.success,
        },
        icon: 'check-circle',
        iconColor: theme.colors.white,
        textColor: theme.colors.white,
      };
    case 'active':
      return {
        container: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        icon: 'play-circle',
        iconColor: theme.colors.white,
        textColor: theme.colors.white,
      };
    case 'draft':
      return {
        container: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.border,
        },
        icon: 'pencil-square-o',
        iconColor: theme.colors.textSecondary,
        textColor: theme.colors.textSecondary,
      };
    case 'cancelled':
    case 'canceled':
      return {
        container: {
          backgroundColor: theme.colors.error,
          borderColor: theme.colors.error,
        },
        icon: 'times-circle',
        iconColor: theme.colors.white,
        textColor: theme.colors.white,
      };
    case 'pending':
    case 'onhold':
    case 'on-hold':
      return {
        container: {
          backgroundColor: theme.colors.warningLight,
          borderColor: theme.colors.warning,
        },
        icon: 'hourglass-half',
        iconColor: theme.colors.warningDark || theme.colors.warning,
        textColor: theme.colors.warningDark || theme.colors.warning,
      };
    default:
      return {
        container: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.borderLight,
        },
        icon: 'info-circle',
        iconColor: theme.colors.textSecondary,
        textColor: theme.colors.textSecondary,
      };
  }
};
