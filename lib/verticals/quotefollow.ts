import type { VerticalConfig } from '../vertical';

export const quotefollowConfig: VerticalConfig = {
  brandName: 'QuoteFollow',
  brandSlug: 'quotefollow',
  tagline: 'Deposits upfront. Chases automatically. Stops when they reply.',
    gradientText: 'Deposits upfront. Chases automatically. Stops when they reply.',
  heroSub:
      'Send your quote or invoice as usual. QuoteFollow collects deposits upfront, chases payments automatically, and stops the moment your client replies. No nagging. No awkwardness. No lost jobs.',
  eyebrow: '',
  audience: 'small businesses, freelancers & solo pros',
  customerLabel: 'job',
  trustBar: [
    'Reads replies — pauses when your client answers',
    'Works with any email — no CRM, no migration',
    'Never touches your money — payment links go straight to you',
  ],
  painPoints: [
      {
        tag: 'Plumber · Sydney',
        quote: '"Sent 15 quotes last month. Followed up on 3. The other 12? Who knows."',
        loss: 'Lost revenue',
        amount: '$14,200',
      },
      {
        tag: 'Freelance designer · Melbourne',
        quote: '"Client went with another guy because I took 4 days to get back to them."',
        loss: 'Lost revenue',
        amount: '$8,500',
      },
      {
        tag: 'Cleaner · Houston',
        quote: '"Cleaned the house, invoiced, then the client ghosted. Chasing $300 felt worse than doing the job."',
        loss: 'Unpaid invoice',
        amount: '$300',
      },
      {
        tag: 'House painter · Denver',
        quote: '"Client asked for 3 extra rooms mid-job. No deposit, no change order. I ate $2,400."',
        loss: 'Scope creep',
        amount: '$2,400',
      },
    ],
  features: [
      {
        iconKey: 'reply',
        title: 'Stops when your client replies',
        desc: 'The moment a client answers, follow-ups pause automatically. You take over the real conversation — never be the bot that keeps nagging someone who already paid.',
      },
      {
        iconKey: 'chat',
        title: 'Smart follow-ups that sound like you',
        desc: 'No robotic "just checking in" messages. AI writes follow-ups that match your tone — friendly, professional, human.',
      },
      {
        iconKey: 'clock',
        title: 'Smart timing',
        desc: 'Day 3 friendly nudge, Day 7 payment link, Day 7 final notice. Sent when your customer is most likely to reply.',
      },
      {
        iconKey: 'bell',
        title: 'Instant alerts',
        desc: 'Get notified the second a client replies or is ready to book. Strike while the iron is hot.',
      },
      {
        iconKey: 'flame',
        title: 'Hot lead detection',
        desc: 'Know which quotes are hot, warm, or cold before the customer tells you. Focus your energy where it counts.',
      },
      {
        iconKey: 'chart',
        title: 'Never touches your money',
        desc: 'Payment links go straight to your own PayPal. QuoteFollow never holds funds, never stores cards, takes no cut.',
      },
      {
        iconKey: 'chart',
        title: 'Deposits & scope changes, tracked',
        desc: 'Require a deposit to lock the booking. Log every \'just one more thing\' and turn it into a priced change order automatically.',
      },
    ],
  howItWorks: [
      {
        num: '01',
        title: 'Send your quote or invoice as usual',
        desc: 'Email, SMS, or just paste it into the dashboard. We don\'t care how you work — we adapt to you.',
      },
      {
        num: '02',
        title: 'QuoteFollow collects deposit, then follows up',
        desc: 'Require a deposit to lock the booking. We send smart follow-ups on Day 1, 3, and 7 — not too early, not too late.',
      },
      {
        num: '03',
        title: 'Client replies? It stops. Instantly.',
        desc: 'The moment your client answers, the sequence pauses and you get alerted. FAQs get answered automatically. You only handle real conversations.',
      },
      {
        num: '04',
        title: 'Client wants changes? Log it. Priced. Sent.',
        desc: 'Add a scope change from the dashboard. We auto-generate a priced change order email. Total updates instantly.',
      },
    ],
  autoStopSection: {
      title: 'Deposits & scope changes, tracked',
      columns: [
        {
          scenario: 'Client pays deposit',
          result: 'Booking locked. Follow-ups start. You\'re protected from no-shows.',
        },
        {
          scenario: 'Client goes silent',
          result: 'Sequence keeps going: Day 1 nudge, Day 3 payment link, Day 7 final notice.',
        },
        {
          scenario: 'Client asks for changes',
          result: 'Log scope change, auto-generate priced change order. Total updates instantly.',
        },
      ],
    },
  faq: [
      {
        q: 'What happens when a customer replies?',
        a: 'Follow-ups stop immediately — automatically. QuoteFollow reads your inbox, so the moment your client answers, the sequence pauses and you take over. You\'ll never be the bot that keeps nagging someone who already paid.',
      },
      {
        q: 'How does QuoteFollow know I sent a quote?',
        a: 'You can forward quote or invoice emails to your unique inbox address, or paste them directly into the dashboard. Either way, we read and archive everything automatically.',
      },
      {
        q: 'Will the customer know it\'s automated?',
        a: 'No. The follow-ups are written to sound like you — natural, friendly, and professional. Most customers won\'t even notice it\'s automated.',
      },
      {
        q: 'Can I control what the AI says?',
        a: 'Yes. You can review and edit every follow-up before it\'s sent. You\'re always in control.',
      },
      {
        q: 'What if the customer asks something the AI can\'t answer?',
        a: 'The AI handles common questions about pricing, availability, and process. For anything complex, it flags it for you and you can step in directly.',
      },
      {
        q: 'Do you hold my money or store my clients\' cards?',
        a: 'No. QuoteFollow sends payment links that go straight to your own PayPal. We never touch your funds, never store cards, and take no cut of your money.',
      },
      {
        q: 'Is my data secure?',
        a: 'Your data is encrypted and stored securely. We never sell or share your information. You can delete your account and all data at any time.',
      },
      {
        q: 'How much does it cost?',
        a: 'Free to start with 3 clients. Early bird first month is $9, then $19/month — less than one lost job. Cancel anytime, no contracts, no hidden fees.',
      },
      {
        q: 'When will I see results?',
        a: 'Most users see their first recovered job within 2 weeks. The Day 3 follow-up alone can re-engage customers who went silent.',
      },
      {
        q: 'How do deposits work?',
        a: 'When you create a quote, you can mark it as requiring a deposit. Your customer pays the deposit via PayPal to lock in the booking. Once paid, follow-ups start automatically. The deposit goes straight to your PayPal.',
      },
      {
        q: 'What are scope changes?',
        a: 'When a client asks for extra work, you can log it as a scope change in the dashboard. QuoteFollow auto-generates a priced change order email with the updated total. The client approves, you get paid for the extra work.',
      },
    ],
  story: {
    intro: 'My mate runs a one-person service business.',
    hook: 'Last quarter he sent out 47 quotes. Got replies from 12.',
    business: 'He was too busy actually doing the work to follow up on the other 35.',
    lossAmount: '$22,750',
    closing: 'Not because his prices were wrong. Not because his work was bad. Because he forgot to follow up.',
  },
  pricing: {
      monthly: 19,
      currency: 'USD',
      tiers: [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          period: 'forever',
          features: [
            'Up to 3 clients',
            'AI quote reading & dashboard',
            'Day 1 / 3 / 7 follow-ups',
            'AI auto-reply to common questions',
          ],
          cta: 'Get started free',
          badge: 'Start here',
        },
        {
          id: 'solo',
          name: 'Solo',
          price: 19,
          period: 'month',
          features: [
            'Unlimited clients & invoices',
            'Your own follow-up inbox',
            'AI quote reading & dashboard',
            'Precise follow-ups (Day 1, 3, 7)',
            'AI answers common questions',
            'Cancel anytime',
          ],
          cta: 'Subscribe — $9 first month, then $19/mo',
          badge: 'Most popular',
          isPopular: true,
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 49,
          period: 'month',
          features: [
            'Everything in Solo',
            'API access + webhooks',
            'Custom email templates',
            'Advanced analytics & reports',
            'Priority email support',
          ],
          cta: 'Upgrade to Pro — $49/mo',
          badge: 'For growing teams',
        },
        {
          id: 'business',
          name: 'Business',
          price: 99,
          period: 'month',
          features: [
            'Everything in Pro',
            'Team seats (up to 3 users)',
            'Audit logs & activity feed',
            'Priority phone + email support',
            'Custom onboarding & training',
          ],
          cta: 'Contact sales — $99/mo',
          badge: 'For teams',
        },
      ],
    },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'QuoteFollow',
  },
};
