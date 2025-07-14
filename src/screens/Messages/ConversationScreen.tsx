import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

export const ConversationScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversa</Text>
      <Text style={styles.subtitle}>Em desenvolvimento</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});