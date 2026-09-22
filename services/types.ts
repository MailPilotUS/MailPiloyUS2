export type TaskStatus =
  | 'follow_up'
  | 'assigned'
  | 'done';

export interface EmailTask {
  id: string;

  fromAddress: string;
  fromName?: string;

  // The account holder's own address that forwarded this email in
  forwarderAddress?: string;

  subject: string;
  snippet?: string;

  // ISO timestamp of when the forward landed
  receivedAt: string;

  status: TaskStatus;

  assignedTo?: Contact | null;
  assignedAt?: string | null;

  // True if the current user assigned it
  assignedByMe: boolean;

  // ISO timestamp, set manually by the user
  dueDate?: string | null;

  sourceType?: 'email' | 'text' | 'reminder';

  entity?: string | null;

  // Original screenshot/image attached to a forwarded message
  hasOriginalImage?: boolean;
  originalImageType?: string | null;
  originalImageName?: string | null;
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

  // e.g. jane.k4f9@fly.mailpilotus.ai
  forwardingAddress: string;

  subscriptionStatus:
    | 'trialing'
    | 'active'
    | 'billing_issue'
    | 'past_due'
    | 'unpaid'
    | 'canceled'
    | 'cancelled'
    | 'expired'
    | 'none';

  trialEndsAt?: string | null;
}
