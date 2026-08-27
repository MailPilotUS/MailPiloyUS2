export type TaskStatus = 'follow_up' | 'assigned' | 'done';
export interface EmailTask {
  id: string;
  fromAddress: string;
  fromName?: string;
  forwarderAddress?: string; // the account holder's own address that forwarded this email in
  subject: string;
  snippet?: string;
  receivedAt: string; // ISO timestamp of when the forward landed
  status: TaskStatus;
  assignedTo?: Contact | null;
  assignedAt?: string | null;
  assignedByMe: boolean; // true if the current user assigned it (vs. was assigned to them)
  dueDate?: string | null; // ISO timestamp, set manually by the user
}
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}
export interface User {
  id: string;
  email: string;
  forwardingAddress: string; // e.g. jane.k4f9@fly.mailpilotus.ai
  subscriptionStatus: 'trialing' | 'active' | 'expired' | 'none';
  trialEndsAt?: string | null;
}