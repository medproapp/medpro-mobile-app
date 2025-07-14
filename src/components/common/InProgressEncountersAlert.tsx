import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';

interface InProgressEncountersAlertProps {
  encounterCount: number;
  onPress: () => void;
}

export const InProgressEncountersAlert: React.FC<InProgressEncountersAlertProps> = ({ 
  encounterCount, 
  onPress 
}) => {
  if (encounterCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity 
      style={styles.alertContainer} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.alertContent}>
        <FontAwesome 
          name="exclamation-triangle" 
          size={20} 
          color={theme.colors.warning} 
          style={styles.alertIcon} 
        />
        <View style={styles.alertTextContainer}>
          <Text style={styles.alertText}>
            Você possui {encounterCount} encontro{encounterCount > 1 ? 's' : ''} em andamento!
          </Text>
          <Text style={styles.alertLink}>Tocar para verificar</Text>
        </View>
        <FontAwesome 
          name="chevron-right" 
          size={14} 
          color={theme.colors.warning} 
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  alertContainer: {
    backgroundColor: theme.colors.warningLight || '#fff3cd',
    borderWidth: 1,
    borderColor: theme.colors.warning + '40',
    borderRadius: 12,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.warning,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  alertIcon: {
    marginRight: theme.spacing.sm,
  },
  alertTextContainer: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  alertText: {
    ...theme.typography.body,
    color: theme.colors.warningDark || '#856404',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  alertLink: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});