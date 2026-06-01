import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        return null;
      }
      throw new Error(error.response?.data?.detail || 'Failed to get user info');
    }
  }

  async login() {
    window.location.href = '/auth/login';
  }

  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_expires_at');
    window.location.href = '/auth/login';
  }
}

export const authApi = new RPApi();
