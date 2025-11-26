/**
 * Zoom API Client
 * Provides methods to interact with Zoom API
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface ZoomConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export interface ZoomMeeting {
  topic: string;
  startTime?: string;
  duration?: number;
  agenda?: string;
  timezone?: string;
  type?: number;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    audio?: string;
    auto_recording?: string;
  };
}

export class ZoomClient {
  private config: ZoomConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private client: AxiosInstance;

  constructor(config: ZoomConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.zoom.us/v2',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to ensure we have a valid access token
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  /**
   * Get OAuth access token using Server-to-Server OAuth
   */
  private async getAccessToken(): Promise<string> {
    const tokenUrl = 'https://zoom.us/oauth/token';
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    try {
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'account_credentials',
          account_id: this.config.accountId,
        }),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry with a 5-minute buffer
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.info('Zoom access token obtained successfully');
      return this.accessToken!;
    } catch (error) {
      logger.error('Failed to get Zoom access token:', error);
      throw new Error('Failed to authenticate with Zoom API');
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.getAccessToken();
    }
  }

  /**
   * Create a new Zoom meeting
   */
  async createMeeting(meeting: ZoomMeeting): Promise<any> {
    try {
      const response = await this.client.post('/users/me/meetings', {
        topic: meeting.topic,
        type: meeting.type || 2, // 2 = Scheduled meeting
        start_time: meeting.startTime,
        duration: meeting.duration || 60,
        timezone: meeting.timezone || 'UTC',
        agenda: meeting.agenda,
        settings: meeting.settings || {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          audio: 'both',
          auto_recording: 'none',
        },
      });

      logger.info(`Zoom meeting created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Zoom meeting:', error);
      throw error;
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<any> {
    try {
      const response = await this.client.get(`/meetings/${meetingId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Zoom meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * List meetings
   */
  async listMeetings(type: string = 'scheduled'): Promise<any[]> {
    try {
      const response = await this.client.get('/users/me/meetings', {
        params: { type },
      });
      return response.data.meetings || [];
    } catch (error) {
      logger.error('Failed to list Zoom meetings:', error);
      throw error;
    }
  }

  /**
   * Update a meeting
   */
  async updateMeeting(meetingId: string, updates: Partial<ZoomMeeting>): Promise<void> {
    try {
      await this.client.patch(`/meetings/${meetingId}`, updates);
      logger.info(`Zoom meeting ${meetingId} updated`);
    } catch (error) {
      logger.error(`Failed to update Zoom meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      await this.client.delete(`/meetings/${meetingId}`);
      logger.info(`Zoom meeting ${meetingId} deleted`);
    } catch (error) {
      logger.error(`Failed to delete Zoom meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<any> {
    try {
      const response = await this.client.get('/users/me');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Zoom user profile:', error);
      throw error;
    }
  }
}
