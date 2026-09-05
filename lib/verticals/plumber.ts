import type { VerticalConfig } from '../vertical';

export const plumberConfig: VerticalConfig = {
  brandName: 'PlumberFollow',
  brandSlug: 'plumber',
  tagline: 'You sent the plumbing quote.',
  gradientText: 'Don\'t let it drain away.',
  heroSub:
    'PlumberFollow reads your quotes and follows up with homeowners on auto-pilot — so you never lose another job to a plumber who called back first.',
  eyebrow: 'For plumbing contractors',
  audience: 'plumbing contractors',
  customerLabel: 'job',
  painPoints: [
    {
      tag: 'Plumbing · Seattle',
      quote: '"Sent 18 pipe replacement quotes last month. Followed up on 4. Too busy unclogging drains to chase the rest."',
      loss: 'Lost revenue',
      amount: '$16,500',
    },
    {
      tag: 'Plumbing · Boston',
      quote: '"Homeowner said they\'d think about the bathroom reno. I never called back. They hired another plumber."',
      loss: 'Lost revenue',
      amount: '$11,200',
    },
    {
      tag: 'Plumbing · San Diego',
      quote: '"I had 12 water heater quotes sitting in my sent folder. By the time I followed up, 5 had already booked elsewhere."',
      loss: 'Lost revenue',
      amount: '$19,400',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Follow-ups that sound like a real plumber',
      desc: 'No robotic "just checking in" messages. AI writes friendly, professional follow-ups that feel like they came from you.',
    },
    {
      iconKey: 'clock',
      title: 'Timing that respects the season',
      desc: 'Follow-ups arrive when homeowners are deciding — not during your busiest pipe burst season.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead alerts',
      desc: 'The moment a homeowner says "let\'s do it", you get an instant notification. No more missed calls.',
    },
    {
      iconKey: 'chart',
      title: 'Win/loss tracking',
      desc: 'See which types of jobs you win most often. Adjust your pricing and follow-up style accordingly.',
    },
    {
      iconKey: 'reply',
      title: 'AI auto-reply for common questions',
      desc: 'Questions about permits, warranties, or scheduling? AI answers them instantly.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts',
      desc: 'Get notified the second a homeowner is ready to book. Strike while the pipe is still leaking — metaphorically.',
    },
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your plumbing quote as usual',
      desc: 'Email it, text it, or paste it into the dashboard. We adapt to your workflow.',
    },
    {
      num: '02',
      title: 'AI follows up at the right time',
      desc: 'PlumberFollow reads your quote and sends smart follow-ups when homeowners are most likely to say yes.',
    },
    {
      num: '03',
      title: 'You only handle the wrench',
      desc: 'FAQs get answered automatically. When a homeowner says "book me in", you get an alert.',
    },
  ],
  faq: [
    {
      q: 'How does PlumberFollow know I sent a quote?',
      a: 'Forward your quote emails to your unique inbox, or paste them into the dashboard. We read and archive every quote automatically.',
    },
    {
      q: 'What happens when a homeowner replies?',
      a: 'Replies go straight to your dashboard. You\'ll see if they\'re ready to book, have questions, or went with another plumber.',
    },
    {
      q: 'Will the homeowner know it\'s automated?',
      a: 'No. The follow-ups sound like you — friendly and professional. Most homeowners won\'t notice.',
    },
    {
      q: 'Can I control what the AI says?',
      a: 'Yes. Review and edit every follow-up before it\'s sent. You\'re always in control.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. Less than one lost plumbing job. Cancel anytime.',
    },
    {
      q: 'Is my data secure?',
      a: 'Your data is encrypted and stored securely. We never sell or share your information.',
    },
  ],
  story: {
    intro: 'A plumbing company owner I know in Chicago.',
    hook: 'Last year he sent out 40 bathroom renovation quotes. Heard back from 11.',
    business: 'He was too busy fixing burst pipes to follow up on the other 29.',
    lossAmount: '$34,500',
    closing: 'Not because his prices were wrong. Not because his work was bad. Because he forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'PlumberFollow',
  },
};