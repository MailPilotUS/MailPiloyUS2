import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { colors } from '../theme';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../services/subscriptions';
import { useSession } from '../contexts/SessionContext';
import { api } from '../services/api';

const IS_WEB = Platform.OS === 'web';

const WEB_PRICE_IDS: Record<'monthly' | 'annual', string> = {
  monthly: 'price_1Tx4i6FZ1VLALyugBjZvOONs',
  annual: 'price_1Tx5MYFZ1VLALyugWErltx9a',
};

const WEB_PRICES: Record<'monthly' | 'annual', string> = {
  monthly: '$2.99',
  annual: '$29.99',
};

export default function PaywallScreen() {
  const {
    refreshEntitlement,
    logout,
    subscriptionStatus,
  } = useSession();

  // Monthly is selected by default to make the initial
  // commitment as simple and approachable as possible.
  const [selected, setSelected] =
    useState<'monthly' | 'annual'>('monthly');

  const [offering, setOffering] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (IS_WEB) return;

    getOfferings()
      .then(setOffering)
      .catch(() => setOffering(null));
  }, []);

  const packages = {
    monthly: offering?.monthly,
    annual: offering?.annual,
  };

  const handleStartTrial = async () => {
    if (IS_WEB) {
      setPurchasing(true);

      try {
        const { url } = await api.createCheckoutSession(
          WEB_PRICE_IDS[selected]
        );

        window.location.href = url;
      } catch (e: any) {
        Alert.alert(
          'Checkout failed',
          e?.message || 'Please try again.'
        );

        setPurchasing(false);
      }

      return;
    }

    const pkg = packages[selected];

    if (!pkg) {
      Alert.alert(
        'Unavailable',
        'This plan is not available yet. Please try again shortly.'
      );

      return;
    }

    setPurchasing(true);

    try {
      await purchasePackage(pkg);
      await refreshEntitlement();
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert(
          'Purchase failed',
          e?.message || 'Please try again.'
        );
      }
    } finally {
      setPurchasing(false);
    }
  };

  const openManageSubscriptions = () => {
    if (IS_WEB) {
      Linking.openURL(
        'https://billing.stripe.com/p/login'
      );
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

  const isBillingIssue =
    subscriptionStatus === 'billing_issue';

  const isExpired =
    subscriptionStatus === 'expired';

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        {isBillingIssue
          ? 'PAYMENT REQUIRED'
          : isExpired
          ? 'SUBSCRIPTION ENDED'
          : 'TRY MAILPILOTUS FREE FOR 7 DAYS'}
      </Text>

      <Text style={styles.title}>
        {isBillingIssue
          ? 'Update your payment'
          : isExpired
          ? 'Reactivate MailPilotUS'
          : 'Never forget another important email.'}
      </Text>

      <Text style={styles.body}>
        {isBillingIssue
          ? 'Your subscription has a billing problem, so MailPilotUS is temporarily suspended. Update your payment method, then return here to restore access.'
          : isExpired
          ? 'Your previous subscription has ended. Choose a plan below to restore full access to MailPilotUS.'
          : 'See how MailPilotUS keeps your important emails, follow-ups, assignments, and reminders from slipping through the cracks.'}
      </Text>

      {!isBillingIssue && !isExpired && (
        <View style={styles.trialBox}>
          <Text style={styles.trialTitle}>
            7 DAYS FREE
          </Text>

          <Text style={styles.trialText}>
            No charge today. Choose your plan below and try
            everything MailPilotUS has to offer.
          </Text>
        </View>
      )}

      <View style={styles.plans}>
        <TouchableOpacity
          style={[
            styles.plan,
            selected === 'monthly' && styles.planSelected,
          ]}
          onPress={() => setSelected('monthly')}
        >
          {selected === 'monthly' && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>
                SELECTED
              </Text>
            </View>
          )}

          <Text style={styles.planName}>Monthly</Text>

          <Text style={styles.planPrice}>
            {monthlyPrice}
            <Text style={styles.planPer}> /mo</Text>
          </Text>

          <Text style={styles.planDescription}>
            Simple monthly billing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.plan,
            selected === 'annual' && styles.planSelected,
          ]}
          onPress={() => setSelected('annual')}
        >
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>
              SAVE 16%
            </Text>
          </View>

          <Text style={styles.planName}>Annual</Text>

          <Text style={styles.planPrice}>
            {annualPrice}
            <Text style={styles.planPer}> /yr</Text>
          </Text>

          <Text style={styles.planDescription}>
            Best overall value
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={
          isBillingIssue
            ? openManageSubscriptions
            : handleStartTrial
        }
        disabled={purchasing}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>
            {isBillingIssue
              ? 'Update payment method'
              : isExpired
              ? 'Reactivate subscription'
              : 'START MY 7-DAY FREE TRIAL'}
          </Text>
        )}
      </TouchableOpacity>

      {!isBillingIssue && !isExpired && (
        <Text style={styles.noCharge}>
          No charge today • Cancel anytime
        </Text>
      )}

      {!IS_WEB && (
        <TouchableOpacity
          onPress={() =>
            restorePurchases().then(refreshEntitlement)
          }
        >
          <Text style={styles.restore}>
            Restore purchases
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={openManageSubscriptions}
      >
        <Text style={styles.manage}>
          Manage or cancel subscription
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={logout}>
        <Text style={styles.logout}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.legal}>
        No charge today. After your 7-day free trial,{' '}
        {selected === 'monthly'
          ? 'a monthly'
          : 'an annual'}{' '}
        subscription begins automatically at the price shown
        above unless you cancel before the trial ends.
        Subscriptions renew automatically and may be cancelled
        anytime in your{' '}
        {IS_WEB
          ? 'billing'
          : Platform.OS === 'ios'
          ? 'Apple ID'
          : 'Google Play'}{' '}
        account settings, taking effect at the end of the
        current billing period.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ice,
    padding: 24,
    paddingTop: 60,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.blue,
    letterSpacing: 0.5,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 8,
    lineHeight: 34,
  },

  body: {
    fontSize: 15,
    color: colors.navyMuted,
    marginTop: 12,
    lineHeight: 21,
  },

  trialBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    marginTop: 22,
  },

  trialTitle: {
    color: colors.blue,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },

  trialText: {
    color: colors.navyMuted,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 5,
  },

  plans: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },

  plan: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    minHeight: 115,
  },

  planSelected: {
    borderColor: colors.blue,
    borderWidth: 2,
  },

  planName: {
    fontSize: 13,
    color: colors.navyMuted,
    fontWeight: '600',
  },

  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 6,
  },

  planPer: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.navyMuted,
  },

  planDescription: {
    fontSize: 11.5,
    color: colors.navyFaint,
    marginTop: 7,
  },

  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },

  saveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4a3000',
  },

  selectedBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
    backgroundColor: colors.blue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },

  selectedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },

  cta: {
    backgroundColor: colors.navy,
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 28,
  },

  ctaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  noCharge: {
    textAlign: 'center',
    color: colors.navyMuted,
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: '600',
  },

  restore: {
    textAlign: 'center',
    color: colors.blue,
    fontWeight: '600',
    marginTop: 18,
  },

  manage: {
    textAlign: 'center',
    color: colors.navyMuted,
    marginTop: 12,
    fontSize: 13,
  },

  logout: {
    textAlign: 'center',
    color: colors.navyFaint,
    marginTop: 16,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  legal: {
    fontSize: 11.5,
    color: colors.navyFaint,
    marginTop: 24,
    lineHeight: 17,
    textAlign: 'center',
  },
});
