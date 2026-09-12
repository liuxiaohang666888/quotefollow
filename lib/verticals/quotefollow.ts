import type { VerticalConfig } from '../vertical';

export const quotefollowConfig: VerticalConfig = {
  brandName: 'QuoteFollow',
  brandSlug: 'quotefollow',
  tagline: 'You sent the quote.',
  gradientText: 'Follow-ups that stop themselves.',
  heroSub:
    'Send your quote or invoice as usual. QuoteFollow chases it politely — and the moment your client replies, it stops automatically. No nagging. No awkwardness. No lost jobs.',
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
      desc: 'Day 3 friendly nudge, Day 7 payment link, Day 14 final notice. Sent when your customer is most likely to reply.',
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
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your quote or invoice as usual',
      desc: 'Email, SMS, or just paste it into the dashboard. We don\'t care how you work — we adapt to you.',
    },
    {
      num: '02',
      title: 'QuoteFollow follows up politely',
      desc: 'It reads your quote or invoice, saves it, and sends smart follow-ups on Day 1, 3, and 7 — not too early, not too late.',
    },
    {
      num: '03',
      title: 'Client replies? It stops. Instantly.',
      desc: 'The moment your client answers, the sequence pauses and you get alerted. FAQs get answered automatically. You only handle real conversations.',
    },
  ],
  autoStopSection: {
    title: 'It knows when to shut up.',
    columns: [
      {
        scenario: 'Client replies "I\'ll pay Friday"',
        result: 'Follow-ups paused instantly. No bot keeps nagging. You look professional.',
      },
      {
        scenario: 'Client goes silent',
        result: 'The sequence keeps going politely: Day 3 friendly nudge, Day 7 payment link, Day 14 final notice.',
      },
      {
        scenario: 'Client asks a question',
        result: 'You get alerted, the bot stays out of the way for real conversations.',
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
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'QuoteFollow',
  },
};
