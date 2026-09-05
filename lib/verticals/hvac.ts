import type { VerticalConfig } from '../vertical';

export const hvacConfig: VerticalConfig = {
  brandName: 'HVACFollow',
  brandSlug: 'hvac',
  tagline: 'You sent the AC quote.',
  gradientText: 'Don\'t let it cool off.',
  heroSub:
    'HVACFollow reads your quotes and follows up with homeowners on auto-pilot — so you never lose another job to a competitor who called back first.',
  eyebrow: 'For HVAC contractors',
  audience: 'HVAC contractors',
  customerLabel: 'job',
  painPoints: [
    {
      tag: 'HVAC · Phoenix',
      quote: '"Sent 22 AC repair quotes in June. Followed up on maybe 5. Summer rush, you know."',
      loss: 'Lost revenue',
      amount: '$18,700',
    },
    {
      tag: 'HVAC · Denver',
      quote: '"Homeowner called three guys. I didn\'t follow up. Guess who didn\'t get the job."',
      loss: 'Lost revenue',
      amount: '$9,800',
    },
    {
      tag: 'HVAC · Atlanta',
      quote: '"Furnace season hit and I forgot to circle back on 14 quotes from last month."',
      loss: 'Lost revenue',
      amount: '$25,300',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Follow-ups that sound like a real HVAC pro',
      desc: 'No robotic messages. AI writes warm, professional follow-ups that feel like they came from you — not a call center.',
    },
    {
      iconKey: 'clock',
      title: 'Timing that respects the season',
      desc: 'Follow-ups arrive when homeowners are most likely to decide — not during your busiest install week.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead alerts',
      desc: 'The moment a homeowner says "yes", you get an instant notification. No more checking voicemails.',
    },
    {
      iconKey: 'chart',
      title: 'Win/loss tracking for your service area',
      desc: 'See which types of jobs you win (and lose) most often. Adjust your pricing and follow-up style accordingly.',
    },
    {
      iconKey: 'reply',
      title: 'Auto-reply for common questions',
      desc: 'Questions about permits, warranty, or scheduling? AI answers them instantly — even while you\'re on a job site.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts on hot leads',
      desc: 'Get notified the second a homeowner is ready to book. Strike while the iron is hot.',
    },
  ],
  howItWorks: [
    {
      num: '01',
      title: 'Send your quote as usual',
      desc: 'Email it, text it, or paste it into the dashboard. We adapt to your workflow.',
    },
    {
      num: '02',
      title: 'AI follows up at the right time',
      desc: 'HVACFollow reads your quote and sends smart follow-ups when homeowners are most likely to say yes.',
    },
    {
      num: '03',
      title: 'You only handle the installs',
      desc: 'FAQs get answered automatically. When a homeowner says "let\'s do it", you get an alert. That\'s the money part.',
    },
  ],
  faq: [
    {
      q: 'How does HVACFollow know I sent a quote?',
      a: 'Forward your quote emails to your unique inbox, or paste them into the dashboard. We read and archive every quote automatically.',
    },
    {
      q: 'What happens when a homeowner replies?',
      a: 'Replies go straight to your dashboard. You\'ll see if they\'re ready to book, have questions, or went with someone else.',
    },
    {
      q: 'Will the homeowner know it\'s automated?',
      a: 'No. The follow-ups sound like you — friendly, professional, and natural. Most homeowners won\'t notice.',
    },
    {
      q: 'Can I control what the AI says?',
      a: 'Yes. Review and edit every follow-up before it\'s sent. You\'re always in control.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. That\'s less than one lost AC repair job. Cancel anytime.',
    },
    {
      q: 'Is my data secure?',
      a: 'Your data is encrypted and stored securely. We never sell or share your information.',
    },
  ],
  story: {
    intro: 'A buddy of mine runs an HVAC company in Texas.',
    hook: 'Last summer he sent out 63 quotes for AC replacements. Heard back from 17.',
    business: 'He was too busy installing units to follow up on the other 46.',
    lossAmount: '$38,000',
    closing: 'Not because his prices were wrong. Not because his work was bad. Because he forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: 'HVACFollow',
  },
};