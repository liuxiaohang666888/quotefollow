import type { VerticalConfig } from '../vertical';

export const quotefollowConfig: VerticalConfig = {
  brandName: 'QuoteFollow',
  brandSlug: 'quotefollow',
  tagline: 'You sent the quote.',
  gradientText: 'Stop ignoring it.',
  heroSub:
    'QuoteFollow reads your quote emails and follows up with your customers on auto-pilot — so you never lose another job to silence.',
  eyebrow: 'For contractors & small business owners',
  audience: 'contractors & small business owners',
  customerLabel: 'job',
  painPoints: [
    {
      tag: 'Plumber · Sydney',
      quote: '"Sent 15 quotes last month. Followed up on 3. The other 12? Who knows."',
      loss: 'Lost revenue',
      amount: '$14,200',
    },
    {
      tag: 'Electrician · Melbourne',
      quote: '"Client went with another guy because I took 4 days to get back to them."',
      loss: 'Lost revenue',
      amount: '$8,500',
    },
    {
      tag: 'Builder · Brisbane',
      quote: '"I meant to follow up, but by the time I remembered it was 2 weeks later."',
      loss: 'Lost revenue',
      amount: '$22,000',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Smart follow-ups that sound like you',
      desc: 'No robotic "just checking in" messages. AI writes follow-ups that match your tone — friendly, professional, human.',
    },
    {
      iconKey: 'clock',
      title: 'Smart timing',
      desc: 'AI picks the best moment to follow up — when your customer is most likely to reply, not when you feel guilty.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead detection',
      desc: 'Know which quotes are hot, warm, or cold before the customer tells you. Focus your energy where it counts.',
    },
    {
      iconKey: 'chart',
      title: 'Win/loss analysis',
      desc: "See what's working. Track your quote-to-job conversion rate and understand why you win (or lose) jobs.",
    },
    {
      iconKey: 'reply',
      title: 'AI auto-reply',
      desc: 'Common questions about pricing, availability, and deposits get answered instantly — 24/7, even while you sleep.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts',
      desc: 'Get notified the second a customer is ready to book. Strike while the iron is hot.',
    },
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your quote as usual',
      desc: 'Email, SMS, or just paste it into the dashboard. We don\'t care how you work — we adapt to you.',
    },
    {
      num: '02',
      title: 'AI follows up at the right time',
      desc: 'QuoteFollow reads your quote, saves it, and sends smart follow-ups when it matters most — not too early, not too late.',
    },
    {
      num: '03',
      title: 'You only handle hot leads',
      desc: 'FAQs get answered automatically. When a customer says "yes", you get an instant alert. That\'s the money part.',
    },
  ],
  faq: [
    {
      q: 'How does QuoteFollow know I sent a quote?',
      a: 'You can forward quote emails to your unique inbox address, or paste them directly into the dashboard. Either way, we read and archive every quote automatically.',
    },
    {
      q: 'What happens when a customer replies?',
      a: 'Any reply goes straight into your dashboard. You\'ll see whether it\'s positive, negative, or needs a response — and you\'ll get an instant alert if they say "yes".',
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
      q: 'Is my data secure?',
      a: 'Your data is encrypted and stored securely. We never sell or share your information. You can delete your account and all data at any time.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. That\'s less than one lost job. Cancel anytime — no contracts, no hidden fees.',
    },
    {
      q: 'When will I see results?',
      a: 'Most users see their first recovered job within 2 weeks. The Day 1 follow-up alone can re-engage customers who went silent.',
    },
  ],
  story: {
    intro: 'My mate runs a cleaning company.',
    hook: 'Last quarter he sent out 47 quotes. Got replies from 12.',
    business: 'He was too busy actually doing the cleaning jobs to follow up on the other 35.',
    lossAmount: '$22,750',
    closing: 'Not because his prices were wrong. Not because his work was bad. Because he forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'QuoteFollow',
  },
};