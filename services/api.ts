import Constants from 'expo-constants';
import { storage } from './storage';
import { EmailTask, Contact, User } from './types';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ||
  'https://api.mailpilotus.ai';

async function authHeader(): Promise<Record<string, string>> {
  const token = await storage.getItem('mailpilotus_session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `API ${path} failed: ${res.status} ${body}`
    );
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: User }> {
    const result = await request<{
      token: string;
      user: User;
    }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await storage.setItem(
      'mailpilotus_session_token',
      result.token
    );

    return result;
  },

  async signup(
    email: string,
    password: string
  ): Promise<{ token: string; user: User }> {
    const result = await request<{
      token: string;
      user: User;
    }>('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await storage.setItem(
      'mailpilotus_session_token',
      result.token
    );

    return result;
  },

  async me(): Promise<User> {
    return request<User>('/v1/me');
  },

  async forgotPassword(
    email: string
  ): Promise<{ message: string }> {
    return request<{ message: string }>(
      '/v1/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
  },

  async resetPassword(
    token: string,
    password: string
  ): Promise<{ message: string }> {
    return request<{ message: string }>(
      '/v1/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }
    );
  },

  async listFollowUp(): Promise<EmailTask[]> {
    return request<EmailTask[]>(
      '/v1/tasks?status=follow_up'
    );
  },

  async createTextTask(
    text: string
  ): Promise<EmailTask> {
    return request<EmailTask>('/v1/tasks/text', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async createReminder(
    title: string,
    entity: string,
    dueDate: string | null
  ): Promise<EmailTask> {
    return request<EmailTask>('/v1/tasks/reminder', {
      method: 'POST',
      body: JSON.stringify({
        title,
        entity,
        dueDate,
      }),
    });
  },

  async updateReminder(
    taskId: string,
    title: string,
    entity: string,
    dueDate: string | null
  ): Promise<EmailTask> {
    return request<EmailTask>(
      `/v1/tasks/${taskId}/reminder`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          entity,
          dueDate,
        }),
      }
    );
  },

  async deleteTask(
    taskId: string
  ): Promise<void> {
    return request<void>(
      `/v1/tasks/${taskId}`,
      {
        method: 'DELETE',
      }
    );
  },

  async listAssigned(): Promise<EmailTask[]> {
    return request<EmailTask[]>(
      '/v1/tasks?status=assigned'
    );
  },

  async assignTask(
    taskId: string,
    contactId: string
  ): Promise<EmailTask> {
    return request<EmailTask>(
      `/v1/tasks/${taskId}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ contactId }),
      }
    );
  },

  async completeTask(
    taskId: string
  ): Promise<EmailTask> {
    return request<EmailTask>(
      `/v1/tasks/${taskId}/complete`,
      {
        method: 'POST',
      }
    );
  },

  async unassignTask(
    taskId: string
  ): Promise<EmailTask> {
    return request<EmailTask>(
      `/v1/tasks/${taskId}/unassign`,
      {
        method: 'POST',
      }
    );
  },

  async setDueDate(
    taskId: string,
    dueDate: string | null
  ): Promise<EmailTask> {
    return request<EmailTask>(
      `/v1/tasks/${taskId}/due-date`,
      {
        method: 'PATCH',
        body: JSON.stringify({ dueDate }),
      }
    );
  },

  /*
   * Retrieves the original screenshot attached
   * to a forwarded Follow-Up.
   *
   * Returns a local object URL on web and a
   * data URI on iOS/Android.
   */
  async getOriginalImage(
    taskId: string
  ): Promise<string> {
    const headers = await authHeader();

    const res = await fetch(
      `${BASE_URL}/v1/tasks/${taskId}/original-image`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');

      throw new Error(
        `Could not load original image: ${res.status} ${body}`
      );
    }

    const contentType =
      res.headers.get('content-type') || 'image/png';

    if (typeof window !== 'undefined') {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }

    const blob = await res.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        reject(
          new Error('Could not read original image')
        );
      };

      reader.readAsDataURL(blob);
    });
  },

  async listContacts(): Promise<{
    contacts: Contact[];
  }> {
    const contacts = await request<Contact[]>(
      '/v1/contacts'
    );

    return { contacts };
  },

  async createContact(contact: {
    name: string;
    email?: string;
    phone?: string;
  }): Promise<Contact> {
    return request<Contact>('/v1/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  async createCheckoutSession(
    priceId: string
  ): Promise<{ url: string }> {
    return request<{ url: string }>(
      '/billing/create-checkout-session',
      {
        method: 'POST',
        body: JSON.stringify({ priceId }),
      }
    );
  },

  async registerPushToken(
    token: string,
    platform: string
  ): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(
      '/v1/devices',
      {
        method: 'POST',
        body: JSON.stringify({
          token,
          platform,
        }),
      }
    );
  },

  async sendTestNotification(): Promise<{
    sent: number;
  }> {
    return request<{ sent: number }>(
      '/v1/devices/test-notification',
      {
        method: 'POST',
      }
    );
  },
};
