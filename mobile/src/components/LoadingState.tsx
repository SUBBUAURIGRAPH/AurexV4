/**
 * Loading State Component
 * Reusable loading indicator with optional message
 * Provides consistent loading UI across the app
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  style?: object;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'large',
  color = '#0066CC',
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 24
  },
  message: {
    marginTop: 16,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center'
  }
});
