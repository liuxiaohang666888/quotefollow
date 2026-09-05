import type { VerticalConfig } from '../vertical';

export const insureConfig: VerticalConfig = {
  brandName: 'InsureFollow',
  brandSlug: 'insure',
  tagline: 'You sent the policy quote.',
  gradientText: 'Don\'t let it expire.',
  heroSub:
    'InsureFollow reads your policy quotes and follows up with prospects on auto-pilot — so you close more policies without the busywork.',
  eyebrow: 'For insurance agents & brokers',
  audience: 'insurance agents & brokers',
  customerLabel: 'policy',
  painPoints: [
    {
      tag: 'Health Insurance · Florida',
      quote: '"Sent 35 quotes during open enrollment. Followed up on maybe 8. Lost the rest to agents who called back."',
      loss: 'Lost commissions',
      amount: '$28,000',
    },
    {
      tag: 'Auto Insurance · Texas',
      quote: '"Prospect said they\'d compare rates. I never circled back. They went with a competitor who did."',
      loss: 'Lost commissions',
      amount: '$4,200',
    },
    {
      tag: 'Life Insurance · New York',
      quote: '"I had 12 term life quotes sitting in my draft folder. By the time I followed up, 3 had already bought elsewhere."',
      loss: 'Lost commissions',
      amount: '$18,600',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Follow-ups that sound like a real agent',
      desc: 'No robotic "just checking in" messages. AI writes warm, professional follow-ups that feel personal.',
    },
    {
      iconKey: 'clock',
      title: 'Timing that respects the buying cycle',
      desc: 'Follow-ups arrive when prospects are comparing options — not during your busiest enrollment period.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead alerts',
      desc: 'The moment a prospect says "I\'m ready to apply", you get an instant notification.',
    },
    {
      iconKey: 'chart',
      title: 'Conversion tracking by product line',
      desc: 'See which products convert best from quote to policy. Focus your energy where it pays.',
    },
    {
      iconKey: 'reply',
      title: 'AI auto-reply for common questions',
      desc: 'Questions about coverage, deductibles, or premiums? AI answers instantly — 24/7.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts',
      desc: 'Get notified the second a prospect wants to bind. Don\'t lose another policy to silence.',
    },
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your policy quote as usual',
      desc: 'Email it, or paste it into the dashboard. We adapt to your workflow.',
    },
    {
      num: '02',
      title: 'AI follows up at the right time',
      desc: 'InsureFollow reads your quote and sends smart follow-ups when prospects are most likely to convert.',
    },
    {
      num: '03',
      title: 'You only handle the signatures',
      desc: 'Common questions get answered automatically. When a prospect says "sign me up", you get an alert.',
    },
  ],
  faq: [
    {
      q: 'How does InsureFollow know I sent a quote?',
      a: 'Forward your quote emails to your unique inbox, or paste them into the dashboard. We handle the rest.',
    },
    {
      q: 'What happens when a prospect replies?',
      a: 'Replies go straight to your dashboard. You\'ll see if they\'re ready to bind, have questions, or went elsewhere.',
    },
    {
      q: 'Will the prospect know it\'s automated?',
      a: 'No. The follow-ups sound like you — professional and natural. Most prospects won\'t notice.',
    },
    {
      q: 'Can I review follow-ups before they\'re sent?',
      a: 'Yes. You\'re always in control. Review and edit every message before it goes out.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. Less than one lost commission. Cancel anytime.',
    },
    {
      q: 'Is my client data secure?',
      a: 'Yes. Your data is encrypted and stored securely. We never share your information.',
    },
  ],
  story: {
    intro: 'An insurance agent I know in Ohio.',
    hook: 'Last quarter he sent out 52 policy quotes. Heard back from 18.',
    business: 'He was too busy servicing existing clients to follow up on the other 34.',
    lossAmount: '$31,000',
    closing: 'Not because his rates were wrong. Not because his coverage was bad. Because he forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'InsureFollow',
  },
};