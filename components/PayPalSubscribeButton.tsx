'use client';

import { useEffect, useRef, useState } from 'react';

// PayPal - voxalo.top 正式生产配置（2026-08-31 刘燕青 PayPal China 账号）
const DEFAULT_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || 'P-5DN937607C181825LNKSPLWI';
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAAxyItsTaXijHpq8NBvrle3h6xOpEJ9vc1nl_OvLlwnfe_OoFH8Uz3tGTs9x-p-nI88xGGROfurcvVyig';
export const PLAN_PRO_ID = process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID || DEFAULT_PLAN_ID;
export const PLAN_EARLY_BIRD_ID = process.env.NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID || DEFAULT_PLAN_ID;
export const PLAN_YEARLY_ID = process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || DEFAULT_PLAN_ID;
const INVOICE_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL || `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${DEFAULT_PLAN_ID}`;

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalSubscribeButton({
  label = 'Start free trial — $49/mo',
  planId,
  fallbackHref,
}: {
  label?: string;
  planId?: string;
  fallbackHref?: string;
}) {
  const activePlanId = planId || DEFAULT_PLAN_ID;
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onApprove = (data: any) => {
    const url = new URL('/signup', window.location.origin);
    url.searchParams.set('sub', data.subscriptionID);
    window.location.href = url.toString();
  };

  useEffect(() => {
    if (!activePlanId || !CLIENT_ID || !containerRef.current) return;

    const renderButtons = () => {
      if (!window.paypal || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      try {
        // 金色 PayPal 按钮
        window.paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
          createSubscription: (data: any, actions: any) =>
            actions.subscription.create({ plan_id: activePlanId }),
          onApprove,
          onError: () => setSdkError(true),
        }).render(containerRef.current);

        // 蓝色 PayPal Credit 按钮
        const creditContainer = document.createElement('div');
        containerRef.current.appendChild(creditContainer);
        window.paypal.Buttons({
          style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'pay' },
          createSubscription: (data: any, actions: any) =>
            actions.subscription.create({ plan_id: activePlanId }),
          onApprove,
          onError: () => setSdkError(true),
        }).render(creditContainer);

        // 黑色 借记卡/信用卡 按钮
        const cardContainer = document.createElement('div');
        containerRef.current.appendChild(cardContainer);
        window.paypal.Buttons({
          style: { shape: 'rect', color: 'black', layout: 'vertical', label: 'checkout' },
          createSubscription: (data: any, actions: any) =>
            actions.subscription.create({ plan_id: activePlanId }),
          onApprove,
          onError: () => setSdkError(true),
        }).render(cardContainer);

        setSdkLoaded(true);
      } catch (err) {
        console.error('[PayPalSubscribeButton] render error:', err);
        setSdkError(true);
      }
    };

    const existing = document.querySelector('script[data-paypal-sdk="qf"]');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!existing) {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription&enable-funding=paylater%2Ccard`;
      s.setAttribute('data-paypal-sdk', 'qf');
      s.onload = () => {
        clearTimeout(timeout);
        setSdkLoaded(true);
        renderButtons();
      };
      s.onerror = () => {
        clearTimeout(timeout);
        setSdkError(true);
      };
      timeout = setTimeout(() => setSdkError(true), 5000);
      document.body.appendChild(s);
    } else {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if (window.paypal) {
          clearInterval(poll);
          setSdkLoaded(true);
          renderButtons();
        } else if (tries > 25) {
          clearInterval(poll);
          setSdkError(true);
        }
      }, 200);
      timeout = poll as unknown as ReturnType<typeof setTimeout>;
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
        clearInterval(timeout as unknown as ReturnType<typeof setInterval>);
      }
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [activePlanId]);

  if (!activePlanId || !CLIENT_ID) {
    return (
      <a className="btn" href={fallbackHref || INVOICE_URL || '#'}>
        {label}
      </a>
    );
  }

  if (sdkError) {
    return (
      <a className="btn" href={fallbackHref || INVOICE_URL} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }

  return (
    <div ref={containerRef} className="paypal-subscribe" aria-label={label}>
      {!sdkLoaded && !sdkError && (
        <button className="btn" disabled style={{ opacity: 0.6 }}>
          Loading PayPal…
        </button>
      )}
    </div>
  );
}
