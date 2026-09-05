import type { VerticalConfig } from '../vertical';

export const lawConfig: VerticalConfig = {
  brandName: 'LawFollow',
  brandSlug: 'law',
  tagline: 'You sent the engagement letter.',
  gradientText: 'Don\'t let it sit.',
  heroSub:
    'LawFollow reads your consultation emails and follows up with potential clients on auto-pilot — so you never lose a case to silence.',
  eyebrow: 'For law firms & solo practitioners',
  audience: 'law firms & solo practitioners',
  customerLabel: 'case',
  painPoints: [
    {
      tag: 'Family Law · Chicago',
      quote: '"Sent 30 consultation replies last month. Half of them never booked. I was too deep in discovery to chase them."',
      loss: 'Lost revenue',
      amount: '$45,000',
    },
    {
      tag: 'Estate Planning · Miami',
      quote: '"Client said they\'d think about it. I never followed up. They went with a firm that did."',
      loss: 'Lost revenue',
      amount: '$12,500',
    },
    {
      tag: 'Personal Injury · Dallas',
      quote: '"Potential client called three firms. I was the only one who didn\'t call back."',
      loss: 'Lost revenue',
      amount: '$85,000',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Follow-ups that sound like your firm',
      desc: 'Professional, warm follow-ups that match your firm\'s voice. No generic "checking in" templates.',
    },
    {
      iconKey: 'clock',
      title: 'Timing that respects the legal process',
      desc: 'Follow-ups arrive at the right moment — after they\'ve had time to review but before they\'ve signed with another firm.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead alerts for new clients',
      desc: 'The moment a potential client says "let\'s proceed", you get an instant notification.',
    },
    {
      iconKey: 'chart',
      title: 'Conversion tracking',
      desc: 'See which practice areas convert best from consultation to retained. Optimize your intake process.',
    },
    {
      iconKey: 'reply',
      title: 'AI auto-reply for common questions',
      desc: 'Questions about fees, timelines, or retainer structure? AI answers instantly — 24/7.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts',
      desc: 'Get notified the second a potential client is ready to sign. Don\'t let another firm beat you to it.',
    },
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your consultation reply as usual',
      desc: 'Email your response, or paste it into the dashboard. We adapt to your workflow.',
    },
    {
      num: '02',
      title: 'AI follows up at the right time',
      desc: 'LawFollow reads your reply and sends smart follow-ups when potential clients are most likely to engage.',
    },
    {
      num: '03',
      title: 'You only handle the cases',
      desc: 'Common questions get answered automatically. When a client says "I\'m ready", you get an alert.',
    },
  ],
  faq: [
    {
      q: 'How does LawFollow know I replied to a potential client?',
      a: 'Forward your consultation replies to your unique inbox, or paste them into the dashboard. We handle the rest.',
    },
    {
      q: 'What happens when a potential client replies?',
      a: 'Replies go straight to your dashboard. You\'ll see if they\'re ready to retain, have questions, or went elsewhere.',
    },
    {
      q: 'Will the client know it\'s automated?',
      a: 'No. The follow-ups are professional and natural. Most clients won\'t even notice.',
    },
    {
      q: 'Can I review follow-ups before they\'re sent?',
      a: 'Yes. You\'re always in control. Review and edit every message before it goes out.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. Less than the cost of one lost consultation. Cancel anytime.',
    },
    {
      q: 'Is client data secure?',
      a: 'Yes. Your data is encrypted and stored securely. We never share your information.',
    },
  ],
  story: {
    intro: 'A solo family law attorney I know.',
    hook: 'Last quarter she sent 45 consultation replies. Heard back from 14.',
    business: 'She was too busy with active cases to follow up on the other 31.',
    lossAmount: '$62,000',
    closing: 'Not because her rates were wrong. Not because her advice was bad. Because she forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'LawFollow',
  },
};