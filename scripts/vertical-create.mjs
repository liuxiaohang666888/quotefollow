#!/usr/bin/env node
/**
 * Vertical Replication Engine CLI
 * Usage: node scripts/vertical-create.mjs <slug>
 *
 * Creates a new vertical config file ready to be deployed.
 * Example: node scripts/vertical-create.mjs roofing
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VERTICALS_DIR = join(ROOT, 'lib', 'verticals');
const REGISTRY_FILE = join(ROOT, 'lib', 'vertical.ts');

const slug = process.argv[2]?.toLowerCase();

if (!slug) {
  console.error('Usage: node scripts/vertical-create.mjs <slug>');
  console.error('Example: node scripts/vertical-create.mjs roofing');
  process.exit(1);
}

const brandName = slug.charAt(0).toUpperCase() + slug.slice(1) + 'Follow';

// Check if vertical already exists
const configPath = join(VERTICALS_DIR, `${slug}.ts`);
if (existsSync(configPath)) {
  console.error(`Error: Vertical "${slug}" already exists at ${configPath}`);
  process.exit(1);
}

// Template config
const template = `import type { VerticalConfig } from '../vertical';

export const ${slug}Config: VerticalConfig = {
  brandName: '${brandName}',
  brandSlug: '${slug}',
  tagline: 'You sent the quote.',
  gradientText: 'Follow up now.',
  heroSub:
    '${brandName} reads your quotes and follows up with your customers on auto-pilot — so you never lose another job to silence.',
  eyebrow: 'For ${slug} professionals',
  audience: '${slug} professionals',
  customerLabel: 'job',
  painPoints: [
    {
      tag: '${brandName} · Example City',
      quote: '"Sent 20 quotes last month. Followed up on 5. Too busy to chase the rest."',
      loss: 'Lost revenue',
      amount: '$15,000',
    },
    {
      tag: '${brandName} · Another City',
      quote: '"Client said they\'d think about it. I never called back. They went with someone who did."',
      loss: 'Lost revenue',
      amount: '$9,500',
    },
    {
      tag: '${brandName} · Third City',
      quote: '"By the time I remembered to follow up, it was 2 weeks later. They had already booked elsewhere."',
      loss: 'Lost revenue',
      amount: '$21,000',
    },
  ],
  features: [
    {
      iconKey: 'chat',
      title: 'Follow-ups that sound like you',
      desc: 'No robotic "just checking in" messages. AI writes natural, professional follow-ups.',
    },
    {
      iconKey: 'clock',
      title: 'Smart timing',
      desc: 'AI picks the best moment to follow up — when your customer is most likely to reply.',
    },
    {
      iconKey: 'flame',
      title: 'Hot lead alerts',
      desc: 'The moment a customer says "yes", you get an instant notification.',
    },
    {
      iconKey: 'chart',
      title: 'Win/loss tracking',
      desc: 'See which types of jobs you win most often. Adjust your strategy accordingly.',
    },
    {
      iconKey: 'reply',
      title: 'AI auto-reply for common questions',
      desc: 'Questions about pricing, timing, or process? AI answers instantly.',
    },
    {
      iconKey: 'bell',
      title: 'Instant alerts',
      desc: 'Get notified the second a customer is ready to book.',
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
      desc: '${brandName} reads your quote and sends smart follow-ups when it matters most.',
    },
    {
      num: '03',
      title: 'You only handle the wins',
      desc: 'FAQs get answered automatically. When a customer says "yes", you get an alert.',
    },
  ],
  faq: [
    {
      q: 'How does ${brandName} know I sent a quote?',
      a: 'Forward your quote emails to your unique inbox, or paste them into the dashboard. We handle the rest.',
    },
    {
      q: 'What happens when a customer replies?',
      a: 'Replies go straight to your dashboard. You\'ll see if they\'re ready to book, have questions, or went elsewhere.',
    },
    {
      q: 'Will the customer know it\'s automated?',
      a: 'No. The follow-ups sound like you — natural and professional. Most customers won\'t notice.',
    },
    {
      q: 'Can I control what the AI says?',
      a: 'Yes. Review and edit every follow-up before it\'s sent. You\'re always in control.',
    },
    {
      q: 'How much does it cost?',
      a: '$29/month for the Professional plan. Less than one lost job. Cancel anytime.',
    },
    {
      q: 'Is my data secure?',
      a: 'Your data is encrypted and stored securely. We never sell or share your information.',
    },
  ],
  story: {
    intro: 'A ${slug} business owner I know.',
    hook: 'Last year they sent out 40 quotes. Heard back from 12.',
    business: 'They were too busy with the actual work to follow up on the other 28.',
    lossAmount: '$25,000',
    closing: 'Not because their prices were wrong. Not because their work was bad. Because they forgot to follow up.',
  },
  pricing: {
    monthly: 29,
    currency: 'USD',
  },
  footer: {
    supportEmail: 'support@voxalo.top',
    copyright: '${brandName}',
  },
};
`;

// Write the config file
writeFileSync(configPath, template, 'utf-8');
console.log(`✅ Created ${configPath}`);

// Now update the registry file
let registry = readFileSync(REGISTRY_FILE, 'utf-8');

// Add import
const importLine = `import { ${slug}Config } from './verticals/${slug}';`;
if (!registry.includes(importLine)) {
  registry = registry.replace(
    "import { electricianConfig } from './verticals/electrician';",
    `import { electricianConfig } from './verticals/electrician';\nimport { ${slug}Config } from './verticals/${slug}';`
  );
}

// Add to registry object
const registryEntry = `\n  ${slug}: ${slug}Config,`;
if (!registry.includes(registryEntry)) {
  registry = registry.replace(
    "  electrician: electricianConfig,",
    `  electrician: electricianConfig,${registryEntry}`
  );
}

// Add to VerticalId type
const typeEntry = `\n  | '${slug}'`;
if (!registry.includes(typeEntry.trim())) {
  registry = registry.replace(
    "  | 'electrician';",
    `  | 'electrician'${typeEntry};`
  );
}

writeFileSync(REGISTRY_FILE, registry, 'utf-8');
console.log(`✅ Updated ${REGISTRY_FILE}`);

console.log(`\n🎉 Vertical "${slug}" created successfully!
Next steps:
1. Edit lib/verticals/${slug}.ts to customize the content
2. Create a Vercel project with:
   - NEXT_PUBLIC_VERTICAL=${slug}
   - NEXT_PUBLIC_BRAND_NAME=${brandName}
   - NEXT_PUBLIC_APP_URL=https://${slug}follow.voxalo.top
3. Add DNS record: ${slug}follow.voxalo.top CNAME cname.vercel-dns.com
4. Deploy!
`);