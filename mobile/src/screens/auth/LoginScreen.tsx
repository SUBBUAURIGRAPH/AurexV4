/**
 * Login Screen - Email/Password Authentication
 * Allows users to login with email and password or biometric
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { loginWithEmailPassword } from '../../store/authSlice';
import { biometricService } from '../../services/biometricService';

export default function LoginScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector(state => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const available = await biometricService.checkAvailability();
      setBiometricAvailable(available.isAvailable);
    } catch (error) {
      console.error('Error checking biometric:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter both email and password');
      return;
    }

    try {
      await dispatch(loginWithEmailPassword({ email, password }));
      // Navigation will be handled by navigation flow
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await biometricService.authenticate();
      if (!result.success) {
        Alert.alert('Biometric Authentication', result.error || 'Authentication failed');
        return;
      }

      // In production, exchange biometric token for JWT
      await dispatch(loginWithEmailPassword({ email, password }));
    } catch (error) {
      Alert.alert('Biometric Error', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hermes Trading</Text>
          <Text style={styles.subtitle}>Professional Trading Platform</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Email Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>

        {/* Password Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              <Text style={styles.togglePassword}>
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot Password Link */}
        <TouchableOpacity disabled={isLoading}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        {biometricAvailable && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Biometric Login Button */}
            <TouchableOpacity
              style={[styles.biometricButton, isLoading && styles.disabledButton]}
              onPress={handleBiometricLogin}
              disabled={isLoading}
            >
              <Text style={styles.biometricButtonText}>🔒 Biometric Login</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Sign Up Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity disabled={isLoading}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityText}>
            🔐 Bank-level security with SSL encryption
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 40
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF'
  },
  errorContainer: {
    backgroundColor: '#991B1B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626'
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14
  },
  formGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16
  },
  togglePassword: {
    fontSize: 20,
    paddingLeft: 8
  },
  forgotPassword: {
    color: '#0066CC',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'right'
  },
  loginButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16
  },
  biometricButton: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#0066CC',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  biometricButtonText: {
    color: '#0066CC',
    fontSize: 16,
    fontWeight: '600'
  },
  disabledButton: {
    opacity: 0.6
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155'
  },
  dividerText: {
    color: '#9CA3AF',
    marginHorizontal: 12,
    fontSize: 12
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14
  },
  signUpLink: {
    color: '#0066CC',
    fontSize: 14,
    fontWeight: '600'
  },
  securityInfo: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC'
  },
  securityText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center'
  }
});
