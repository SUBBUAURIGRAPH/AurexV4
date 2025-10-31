/**
 * Authentication Utilities
 * Manage CLI authentication and API keys
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthCredentials } from '../types';
import ConfigManager from './config';

export class AuthManager {
  private static instance: AuthManager;
  private credentials: Map<string, AuthCredentials> = new Map();
  private credentialsPath: string;
  private config = ConfigManager.getInstance();

  private constructor() {
    this.credentialsPath = path.join(os.homedir(), '.hms', 'credentials.json');
    this.loadCredentials();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Load credentials from encrypted file
   */
  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const data = fs.readFileSync(this.credentialsPath, 'utf-8');
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          this.credentials.set(key, value);
        });
      }
    } catch (error) {
      console.warn('Failed to load credentials, starting fresh');
    }
  }

  /**
   * Save credentials to encrypted file
   */
  private saveCredentials(): void {
    try {
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Object.fromEntries(this.credentials);
      fs.writeFileSync(this.credentialsPath, JSON.stringify(data, null, 2), {
        mode: 0o600 // Restrict file permissions
      });
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }

  /**
   * Get API key
   */
  getApiKey(userId?: string): string | undefined {
    const user = userId || this.config.getUserId();
    const creds = this.credentials.get(user);
    return creds?.apiKey;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string, userId?: string): void {
    const user = userId || this.config.getUserId();
    const creds = this.credentials.get(user) || {};
    creds.apiKey = apiKey;
    this.credentials.set(user, creds);
    this.saveCredentials();
  }

  /**
   * Get access token
   */
  getAccessToken(userId?: string): string | undefined {
    const user = userId || this.config.getUserId();
    const creds = this.credentials.get(user);
    return creds?.accessToken;
  }

  /**
   * Set access token
   */
  setAccessToken(token: string, refreshToken?: string, expiresAt?: Date): void {
    const userId = this.config.getUserId();
    const creds = this.credentials.get(userId) || {};
    creds.accessToken = token;
    if (refreshToken) {
      creds.refreshToken = refreshToken;
    }
    if (expiresAt) {
      creds.expiresAt = expiresAt;
    }
    this.credentials.set(userId, creds);
    this.saveCredentials();
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(userId?: string): boolean {
    const user = userId || this.config.getUserId();
    const creds = this.credentials.get(user);
    if (!creds?.expiresAt) {
      return false;
    }
    return new Date() > new Date(creds.expiresAt);
  }

  /**
   * Get refresh token
   */
  getRefreshToken(userId?: string): string | undefined {
    const user = userId || this.config.getUserId();
    const creds = this.credentials.get(user);
    return creds?.refreshToken;
  }

  /**
   * Clear credentials for user
   */
  clearCredentials(userId?: string): void {
    const user = userId || this.config.getUserId();
    this.credentials.delete(user);
    this.saveCredentials();
  }

  /**
   * Clear all credentials
   */
  clearAll(): void {
    this.credentials.clear();
    this.saveCredentials();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(userId?: string): boolean {
    const user = userId || this.config.getUserId();
    const creds = this.credentials.get(user);
    return !!(creds?.apiKey || creds?.accessToken);
  }

  /**
   * Get authentication header
   */
  getAuthHeader(): Record<string, string> {
    const apiKey = this.getApiKey();
    const accessToken = this.getAccessToken();

    const headers: Record<string, string> = {};

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    return headers;
  }

  /**
   * Get credentials for user
   */
  getCredentials(userId?: string): AuthCredentials | undefined {
    const user = userId || this.config.getUserId();
    return this.credentials.get(user);
  }

  /**
   * Store full credentials
   */
  setCredentials(creds: AuthCredentials, userId?: string): void {
    const user = userId || this.config.getUserId();
    this.credentials.set(user, creds);
    this.saveCredentials();
  }

  /**
   * List all stored users
   */
  listUsers(): string[] {
    return Array.from(this.credentials.keys());
  }

  /**
   * Delete credentials file
   */
  deleteCredentialsFile(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        fs.unlinkSync(this.credentialsPath);
      }
      this.credentials.clear();
    } catch (error) {
      console.error('Failed to delete credentials file:', error);
    }
  }
}

export default AuthManager;
