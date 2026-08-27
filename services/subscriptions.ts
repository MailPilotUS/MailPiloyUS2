import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { PurchasesOffering, CustomerInfo } from 'react-native-purchases';

/**
 * Subscription handling via RevenueCat.
 *
 * Why RevenueCat: Apple and Google require auto-renewing subscriptions sold
 * inside an iOS/Android app to go through StoreKit / Google Play Billing —
 * you cannot sell a "7 day free trial then $x/month" subscription with Stripe
 * inside the native apps. RevenueCat wraps StoreKit 2 + Play Billing behind
 * one API and reports entitlement status back to our own backend via webhook,
 * so the backend stays the single source of truth for "is this user entitled".
 *
 * The 7-day free trial itself is NOT implemented in app code — it is
 * configured as an "Introductory Offer" (iOS) / "Free trial" phase (Android)
 * on the subscription product in App Store Connect / Google Play Console.
 * See /docs/deployment-guide.docx section "Configuring the 7-day free trial".
 *
 * On web, RevenueCat's Web Billing (Stripe-backed) is used instead so the
 * same entitlement model applies to mailpilotus.ai signups.
 */

const ENTITLEMENT_ID = 'pro_access';
export const PRODUCT_IDS = {
  monthly: 'mailpilotus_monthly',
  annual: 'mailpilotus_annual',
};

let configured = false;

// react-native-purchases (the StoreKit/Play Billing bridge) only works on
// iOS and Android — there is no native module for it on web. RevenueCat's
// separate Web Billing SDK would be used for a real production web build
// (see docs/mailpilotus-deployment-guide.docx, section 4.4). For local
// testing in a browser, we no-op these calls instead of crashing, and treat
// the web user as already entitled so you can click through the rest of the
// app (Follow-Up, Assign, Assigned) without a real purchase.
const IS_WEB = Platform.OS === 'web';

export function configurePurchases(appUserId: string) {
  if (IS_WEB || configured) return;
  const apiKey =
    Platform.OS === 'ios'
      ? (Constants.expoConfig?.extra?.revenueCatApiKeyIos as string)
      : (Constants.expoConfig?.extra?.revenueCatApiKeyAndroid as string);

  Purchases.configure({ apiKey, appUserID: appUserId });
  configured = true;
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

export async function getEntitlementStatus(
  backendStatus?: string
): Promise<'trialing' | 'active' | 'expired' | 'none'> {
  if (IS_WEB) {
    // On web there's no RevenueCat — trust the backend's Stripe-derived status instead.
    if (backendStatus === 'active') return 'active';
    return 'none';
  }
  const info = await Purchases.getCustomerInfo();
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return 'none';
  if ((entitlement as any).periodType === 'TRIAL') return 'trialing';
  return 'active';
}
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (IS_WEB) return null;
  return Purchases.restorePurchases();
}
