import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { colors } from '../theme';
import { getOfferings, purchasePackage, restorePurchases } from '../services/subscriptions';
import { useSession } from '../contexts/SessionContext';
import { api } from '../services/api';

const IS_WEB = Platform.OS === 'web';

// Same Stripe price IDs used on mailpilotus.com's pricing buttons and in
// AuthScreen.tsx - web checkout goes through Stripe, not RevenueCat/StoreKit.
const WEB_PRICE_IDS: Record<'monthly' | 'annual', string> = {
  monthly: 'price_1Tx4i6FZ1VLALyugBjZvOONs', // $2.99/mo
  annual: 'price_1Tx5MYFZ1VLALyugWErltx9a', // $29.99/yr
};
const WEB_PRICES: Record<'monthly' | 'annual', string> = {
  monthly: '$2.99',
  annual: '$29.99',
};

/**
 * "The app must provide provisions for purchasing the app with a 'try it for
 * free' button that lets the user try free for 7 days, after which, the
 * selected purchase option would automatically begin unless cancelled prior
 * to the trial period expiration. Subscription may be cancelled at any time."
 *
 * Implementation notes:
 * - The 7-day free trial + auto-renewal behavior is configured on the
 *   subscription products themselves in App Store Connect / Google Play
 *   Console (an "introductory offer" / "free trial phase"), NOT in this
 *   client code — Apple and Google own and enforce that billing logic.
 * - This screen only needs to: show the trial + price terms clearly (Apple
 *   requires this per App Store Review Guideline 3.1.2), let the user start
 *   the purchase (which is where iOS/Android present their own native
 *   trial-consent sheet), and offer "Restore purchases" and a way to manage/
 *   cancel (which must deep-link to the platform's own subscription
 *   management — apps are not allowed to cancel an App Store/Play
 *   subscription on the user's behalf).
 * - On web (mailpilotus.com), there is no RevenueCat/StoreKit - billing goes
 *   through Stripe Checkout instead (see src/routes/billing.js), which has
 *   its own trial_period_days: 7 configured to match this same promise.
 * - Log Out is included here (not just deeper in Settings) because this
 *   screen can be the ONLY screen a user without an active subscription
 *   ever sees — without a way out here, a tester or a customer whose trial
 *   lapsed would have no way to sign out or switch accounts at all.
 */
export default function PaywallScreen() {
  const { refreshEntitlement, logout } = useSession();
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [offering, setOffering] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (IS_WEB) return;
    getOfferings().then(setOffering).catch(() => setOffering(null));
  }, []);

  const packages = {
    monthly: offering?.monthly,
    annual: offering?.annual,
  };

  const handleStartTrial = async () => {
    if (IS_WEB) {
      setPurchasing(true);
      try {
        const { url } = await api.createCheckoutSession(WEB_PRICE_IDS[selected]);
        window.location.href = url;
      } catch (e: any) {
        Alert.alert('Checkout failed', e?.message || 'Please try again.');
        setPurchasing(false);
      }
      return;
    }
    const pkg = packages[selected];
    if (!pkg) {
      Alert.alert('Unavailable', 'This plan is not available yet. Please try again shortly.');
      return;
    }
    setPurchasing(true);
    try {
      await purchasePackage(pkg);
      await refreshEntitlement();
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Purchase failed', e?.message || 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const openManageSubscriptions = () => {
    if (IS_WEB) {
      Linking.openURL('https://billing.stripe.com/p/login');
      return;
    }
    const url =
      Platform.OS === 'ios'
        ? 'itms-apps://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url);
  };

  const monthlyPrice = IS_WEB
    ? WEB_PRICES.monthly
    : packages.monthly?.product.priceString || '$2.99';
  const annualPrice = IS_WEB
    ? WEB_PRICES.annual
    : packages.annual?.product.priceString || '$29.99';

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>7 DAYS FREE, THEN YOUR PLAN</Text>
      <Text style={styles.title}>Try MailPilotus free</Text>
      <Text style={styles.body}>
        Start free for 7 days. If you don't cancel before the trial ends, your selected plan
        begins automatically. Cancel anytime from your {IS_WEB ? 'billing' : "device's subscription"} settings.
      </Text>

      <View style={styles.plans}>
        <TouchableOpacity
          style={[styles.plan, selected === 'monthly' && styles.planSelected]}
          onPress={() => setSelected('monthly')}
        >
          <Text style={styles.planName}>Monthly</Text>
          <Text style={styles.planPrice}>
            {monthlyPrice}
            <Text style={styles.planPer}> /mo</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.plan, selected === 'annual' && styles.planSelected]}
          onPress={() => setSelected('annual')}
        >
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>SAVE 37%</Text>
          </View>
          <Text style={styles.planName}>Annual</Text>
          <Text style={styles.planPrice}>
            {annualPrice}
            <Text style={styles.planPer}> /yr</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={handleStartTrial}
        disabled={purchasing}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>Try it free for 7 days</Text>
        )}
      </TouchableOpacity>

      {!IS_WEB && (
        <TouchableOpacity onPress={() => restorePurchases().then(refreshEntitlement)}>
          <Text style={styles.restore}>Restore purchases</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={openManageSubscriptions}>
        <Text style={styles.manage}>Manage or cancel subscription</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={logout}>
        <Text style={styles.logout}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.legal}>
        No charge today. After your 7-day free trial,{' '}
        {selected === 'monthly' ? 'a monthly' : 'an annual'} subscription begins automatically at
        the price shown above unless you cancel before the trial ends. Subscriptions renew
        automatically and may be cancelled anytime in your{' '}
        {IS_WEB ? 'billing' : Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account settings,
        taking effect at the end of the current billing period.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ice, padding: 24, paddingTop: 70 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.blue, letterSpacing: 0.5 },
  title: { fontSize: 28, fontWeight: '700', color: colors.navy, marginTop: 8 },
  body: { fontSize: 15, color: colors.navyMuted, marginTop: 12, lineHeight: 21 },
  plans: { flexDirection: 'row', gap: 12, marginTop: 28 },
  plan: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
  },
  planSelected: { borderColor: colors.blue },
  planName: { fontSize: 13, color: colors.navyMuted, fontWeight: '600' },
  planPrice: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 6 },
  planPer: { fontSize: 13, fontWeight: '500', color: colors.navyMuted },
  saveBadge: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  saveBadgeText: { fontSize: 10, fontWeight: '700', color: '#4a3000' },
  cta: {
    backgroundColor: colors.navy,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  restore: { textAlign: 'center', color: colors.blue, fontWeight: '600', marginTop: 18 },
  manage: { textAlign: 'center', color: colors.navyMuted, marginTop: 10, fontSize: 13 },
  logout: { textAlign: 'center', color: colors.navyFaint, marginTop: 16, fontSize: 13, textDecorationLine: 'underline' },
  legal: {
    fontSize: 11.5,
    color: colors.navyFaint,
    marginTop: 26,
    lineHeight: 17,
    textAlign: 'center',
  },
});
