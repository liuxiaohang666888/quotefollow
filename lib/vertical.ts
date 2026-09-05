// Vertical config system — makes landing page content dynamic per industry
// Reads NEXT_PUBLIC_VERTICAL env var to determine which vertical to serve

import { quotefollowConfig } from './verticals/quotefollow';
import { hvacConfig } from './verticals/hvac';
import { lawConfig } from './verticals/law';
import { insureConfig } from './verticals/insure';
import { plumberConfig } from './verticals/plumber';
import { electricianConfig } from './verticals/electrician';

export type VerticalId =
  | 'quotefollow'
  | 'hvac'
  | 'law'
  | 'insure'
  | 'plumber'
  | 'electrician';

export interface PainPoint {
  tag: string;
  quote: string;
  loss: string;
  amount: string;
}

export interface Feature {
  iconKey: string;
  title: string;
  desc: string;
}

export interface Step {
  num: string;
  title: string;
  desc: string;
}

export interface FAQ {
  q: string;
  a: string;
}

export interface VerticalConfig {
  brandName: string;
  brandSlug: string;
  tagline: string;
  gradientText: string;
  heroSub: string;
  eyebrow: string;
  audience: string;
  customerLabel: string;
  painPoints: PainPoint[];
  features: Feature[];
  howItWorks: Step[];
  faq: FAQ[];
  story: {
    intro: string;
    hook: string;
    business: string;
    lossAmount: string;
    closing: string;
  };
  pricing: {
    monthly: number;
    currency: string;
  };
  footer: {
    supportEmail: string;
    copyright: string;
  };
}

const registry: Record<VerticalId, VerticalConfig> = {
  quotefollow: quotefollowConfig,
  hvac: hvacConfig,
  law: lawConfig,
  insure: insureConfig,
  plumber: plumberConfig,
  electrician: electricianConfig,
};

export function getVerticalId(): VerticalId {
  if (typeof process === 'undefined') return 'quotefollow';
  const v = (process.env.NEXT_PUBLIC_VERTICAL || 'quotefollow') as VerticalId;
  return registry[v] ? v : 'quotefollow';
}

export function getBrandName(): string {
  if (typeof process === 'undefined') return 'QuoteFollow';
  return process.env.NEXT_PUBLIC_BRAND_NAME || registry[getVerticalId()].brandName;
}

export function getVerticalConfig(): VerticalConfig {
  return registry[getVerticalId()];
}