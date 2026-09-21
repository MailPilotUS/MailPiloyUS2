import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { PurchasesOffering, CustomerInfo } from 'react-native-purchases';

/**
 * Subscription handling via RevenueCat.
 *
 * Important behavior:
 * - A user who cancels auto-renewal keeps access until the paid/trial period expires.
 * - A detected billing problem/nonpayment suspends app access until billing is fixed.
 * - An expired entitlement suspends app access.
 */

const ENTITLEMENT_ID = 'pro_access';
export const PRODUCT_IDS = {
  monthly: 'mailpilotus_monthly',
  annual: 'mailpilotus_annual',
};

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'billing_issue'
  | 'expired'
  | 'none';

let configured = false;
let configuredUserId: string | null = null;
const IS_WEB = Platform.OS === 'web';

export async function configurePurchases(appUserId: string) {
  if (IS_WEB) return;

  if (!configured) {
    const apiKey =
      Platform.OS === 'ios'
        ? (Constants.expoConfig?.extra?.revenueCatApiKeyIos as string)
        : (Constants.expoConfig?.extra?.revenueCatApiKeyAndroid as string);

    Purchases.configure({ apiKey, appUserID: appUserId });
    configured = true;
    configuredUserId = appUserId;
    return;
  }

  // The SDK is configured once per app process. If a different MailPilotUs
  // account signs in, explicitly identify that RevenueCat customer.
  if (configuredUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredUserId = appUserId;
  }
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (IS_WEB) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: any): Promise<CustomerInfo | null> {
  if (IS_WEB) return null;
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

function backendStatusToEntitlement(backendStatus?: string): SubscriptionStatus {
  switch (backendStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'billing_issue':
      return 'billing_issue';
    case 'expired':
    case 'canceled':
    case 'cancelled':
      return 'expired';
    default:
      return 'none';
  }
}

export async function getEntitlementStatus(
  backendStatus?: string
): Promise<SubscriptionStatus> {
  if (IS_WEB) {
    // Web billing is Stripe-backed; the backend is authoritative.
    return backendStatusToEntitlement(backendStatus);
  }

  const info = await Purchases.getCustomerInfo();
  const activeEntitlement = info.entitlements.active[ENTITLEMENT_ID] as any;

  if (activeEntitlement) {
    // Cancellation by itself is NOT a reason to suspend. RevenueCat keeps the
    // entitlement active through the already-paid expiration date.
    // A billing issue, however, is treated as nonpayment and suspends access.
    if (activeEntitlement.billingIssueDetectedAt) return 'billing_issue';
    if (activeEntitlement.periodType === 'TRIAL') return 'trialing';
    return 'active';
  }

  // No currently-active entitlement. Distinguish a lapsed subscriber from a
  // user who has never subscribed so the UI can explain what happened.
  const previousEntitlement = (info.entitlements.all as any)?.[ENTITLEMENT_ID];
  if (previousEntitlement) {
    if (previousEntitlement.billingIssueDetectedAt) return 'billing_issue';
    if (previousEntitlement.expirationDate) return 'expired';
  }

  return 'none';
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (IS_WEB) return null;
  return Purchases.restorePurchases();
}
