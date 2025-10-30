/**
 * Biometric Authentication Service
 * Handles all biometric authentication operations including Face ID, Touch ID, and Fingerprint
 */

import * as Biometric from 'expo-biometric';
import * as SecureStore from 'expo-secure-store';
import { BiometricType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface BiometricAvailability {
  isAvailable: boolean;
  types: BiometricType[];
  isPinSetUp: boolean;
  isDeviceSecure: boolean;
}

interface BiometricAuthResult {
  success: boolean;
  biometricType: BiometricType | null;
  fingerprint: string | null;
  error?: string;
}

/**
 * BiometricService class
 * Manages all biometric authentication operations
 */
export class BiometricService {
  private deviceId: string;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * Get or create a unique device ID
   */
  private getOrCreateDeviceId(): string {
    try {
      const stored = SecureStore.getItemSync('deviceId');
      if (stored) return stored;

      const newId = uuidv4();
      SecureStore.setItemSync('deviceId', newId);
      return newId;
    } catch (error) {
      console.error('Error managing device ID:', error);
      return uuidv4();
    }
  }

  /**
   * Check biometric availability on the device
   */
  async checkAvailability(): Promise<BiometricAvailability> {
    try {
      const compatible = await Biometric.hasHardwareAsync();
      const enrolled = await Biometric.isEnrolledAsync();
      const fallback = await Biometric.canPromptAsync();

      if (!compatible) {
        return {
          isAvailable: false,
          types: [],
          isPinSetUp: false,
          isDeviceSecure: false
        };
      }

      // Get available biometric types
      const types: BiometricType[] = [];

      // Check for Face ID
      try {
        const hasFace = await Biometric.canPromptAsync();
        // Note: Expo doesn't directly expose biometric type detection
        // We can infer based on platform and availability
        if (hasFace) {
          types.push(BiometricType.FACE_ID);
        }
      } catch (error) {
        console.error('Error checking Face ID:', error);
      }

      // Check for Touch ID / Fingerprint
      try {
        if (enrolled) {
          types.push(BiometricType.FINGERPRINT);
        }
      } catch (error) {
        console.error('Error checking fingerprint:', error);
      }

      return {
        isAvailable: compatible && enrolled,
        types: types.length > 0 ? types : [BiometricType.FINGERPRINT],
        isPinSetUp: true, // Assume PIN is set up if biometric is available
        isDeviceSecure: compatible
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        isAvailable: false,
        types: [],
        isPinSetUp: false,
        isDeviceSecure: false
      };
    }
  }

  /**
   * Authenticate using biometric
   */
  async authenticate(): Promise<BiometricAuthResult> {
    try {
      const available = await this.checkAvailability();

      if (!available.isAvailable) {
        return {
          success: false,
          biometricType: null,
          fingerprint: null,
          error: 'Biometric is not available on this device'
        };
      }

      // Get the biometric type to use
      const biometricType = this.getPrimaryBiometricType(available.types);

      // Authenticate
      const result = await Biometric.authenticateAsync({
        disableDeviceFallback: false,
        reason: 'Authenticate to access your Hermes Trading Account'
      });

      if (result.success) {
        // Generate fingerprint hash
        const fingerprint = await this.generateFingerprint();

        return {
          success: true,
          biometricType,
          fingerprint,
          error: undefined
        };
      } else {
        return {
          success: false,
          biometricType: null,
          fingerprint: null,
          error: 'Biometric authentication failed'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        biometricType: null,
        fingerprint: null,
        error: error.message || 'Biometric authentication error'
      };
    }
  }

  /**
   * Register biometric for the current user
   */
  async registerBiometric(userId: string, biometricType: BiometricType): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // Authenticate first
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Authentication failed'
        };
      }

      // Store biometric registration data
      const registrationData = {
        userId,
        deviceId: this.deviceId,
        biometricType,
        fingerprint: authResult.fingerprint,
        registeredAt: new Date().toISOString(),
        isActive: true
      };

      // Store encrypted
      const encryptedData = await this.encryptData(JSON.stringify(registrationData));
      await SecureStore.setItemAsync(`biometric_${userId}`, encryptedData);

      // Generate and store biometric token
      const token = this.generateBiometricToken(userId, biometricType);
      await SecureStore.setItemAsync(`biometricToken_${userId}`, token);

      return {
        success: true,
        token
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to register biometric'
      };
    }
  }

  /**
   * Verify stored biometric registration
   */
  async verifyBiometricRegistration(userId: string): Promise<boolean> {
    try {
      const stored = await SecureStore.getItemAsync(`biometric_${userId}`);
      return stored !== null;
    } catch (error) {
      console.error('Error verifying biometric registration:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await SecureStore.deleteItemAsync(`biometric_${userId}`);
      await SecureStore.deleteItemAsync(`biometricToken_${userId}`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to disable biometric'
      };
    }
  }

  /**
   * Get primary biometric type from available types
   */
  private getPrimaryBiometricType(types: BiometricType[]): BiometricType {
    // Prefer Face ID over Fingerprint
    if (types.includes(BiometricType.FACE_ID)) {
      return BiometricType.FACE_ID;
    }
    return types[0] || BiometricType.FINGERPRINT;
  }

  /**
   * Generate a fingerprint hash
   */
  private async generateFingerprint(): Promise<string> {
    try {
      const deviceId = this.deviceId;
      const timestamp = Date.now().toString();
      const combined = `${deviceId}:${timestamp}`;

      // Simple hash (in production, use a proper hashing library)
      const hash = crypto.createHash('sha256').update(combined).digest('hex');
      return hash;
    } catch (error) {
      console.error('Error generating fingerprint:', error);
      return uuidv4();
    }
  }

  /**
   * Generate biometric token for authentication
   */
  private generateBiometricToken(userId: string, biometricType: BiometricType): string {
    const payload = {
      userId,
      deviceId: this.deviceId,
      biometricType,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 30 // 30 days
    };

    // In production, sign with proper JWT library
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    return encoded;
  }

  /**
   * Encrypt data for secure storage
   */
  private async encryptData(data: string): Promise<string> {
    // In production, use proper encryption library
    return Buffer.from(data).toString('base64');
  }

  /**
   * Decrypt data from secure storage
   */
  private async decryptData(encrypted: string): Promise<string> {
    // In production, use proper encryption library
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }
}

// Export singleton instance
export const biometricService = new BiometricService();
