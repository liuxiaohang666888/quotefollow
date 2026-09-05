import type { VerticalConfig } from '../vertical';

export const electricianConfig: VerticalConfig = {
  brandName: 'ElectricianFollow',
  brandSlug: 'electrician',
  tagline: 'You sent the electrical quote.',
  gradientText: 'Don\'t let it short-circuit.',
  heroSub:
    'ElectricianFollow reads your quotes and follows up with homeowners on auto-pilot — so you never lose another job to an electrician who followed up first.',
  eyebrow: 'For electrical contractors',
  audience: 'electrical contractors',
  customerLabel: 'job',
  painPoints: [
    {
      tag: 'Electrical · Portland',
      quote: '"Sent 25 rewiring quotes last month. Followed up on 7. Too busy on other sites to chase the rest."',
      loss: 'Lost revenue',
      amount: '$21,300',
    },
    {
      tag: 'Electrical · Denver',
      quote: '"Homeowner needed a panel upgrade. I quoted it and forgot to follow up. They hired someone who didn\'t forget."',
      loss: 'Lost revenue',
      amount: '$6,800',
    },
    {
      tag: 'Electrical · Nashville',
      quote: '"I had 10 commercial lighting quotes sitting in my drafts. By the time I circled back, 4 had already signed elsewhere."',
      loss: 'Lost revenue',
      amount: '$32,000',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Follow-ups that sound like a real electrician',
      desc: 'No robotic "just checking in" messages. AI writes natural, professional follow-ups that feel personal.',
    },
    {
      iconKey: 'clock',
      title: 'Timing that respects the job',
      desc: 'Follow-ups arrive when homeowners are comparing quotes — not during your busiest inspection week.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead alerts',
      desc: 'The moment a client says "let\'s go ahead", you get an instant notification.',
    },
    {
      iconKey: 'chart',
      title: 'Win/loss tracking',
      desc: 'See which types of electrical jobs you win most often. Focus your bidding where it counts.',
    },
    {
      iconKey: 'reply',
      title: 'AI auto-reply for common questions',
      desc: 'Questions about permits, codes, or scheduling? AI answers them instantly.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts',
      desc: 'Get notified the second a client is ready to book. Don\'t let another electrician steal the job.',
    },
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your electrical quote as usual',
      desc: 'Email it, text it, or paste it into the dashboard. We adapt to your workflow.',
    },
    {
      num: '02',
      title: 'AI follows up at the right time',
      desc: 'ElectricianFollow reads your quote and sends smart follow-ups when clients are most likely to say yes.',
    },
    {
      num: '03',
      title: 'You only handle the wiring',
      desc: 'FAQs get answered automatically. When a client says "book it", you get an alert.',
    },
  ],
  faq: [
    {
      q: 'How does ElectricianFollow know I sent a quote?',
      a: 'Forward your quote emails to your unique inbox, or paste them into the dashboard. We read and archive every quote automatically.',
    },
    {
      q: 'What happens when a client replies?',
      a: 'Replies go straight to your dashboard. You\'ll see if they\'re ready to book, have questions, or went with another electrician.',
    },
    {
      q: 'Will the client know it\'s automated?',
      a: 'No. The follow-ups sound like you — professional and natural. Most clients won\'t notice.',
    },
    {
      q: 'Can I control what the AI says?',
      a: 'Yes. Review and edit every follow-up before it\'s sent. You\'re always in control.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. Less than one lost electrical job. Cancel anytime.',
    },
    {
      q: 'Is my data secure?',
      a: 'Your data is encrypted and stored securely. We never sell or share your information.',
    },
  ],
  story: {
    intro: 'An electrician I know in Austin.',
    hook: 'Last year he sent out 35 rewiring quotes. Heard back from 10.',
    business: 'He was too busy on installation jobs to follow up on the other 25.',
    lossAmount: '$28,900',
    closing: 'Not because his rates were wrong. Not because his work was bad. Because he forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'ElectricianFollow',
  },
};