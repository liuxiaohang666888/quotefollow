'use client';

import { useEffect, useRef, useState } from 'react';

// PayPal - voxalo.top 正式生产配置（2026-08-31 刘燕青 PayPal China 账号）
const DEFAULT_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || 'P-9RN20574BN6264401NKUP3CY';
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAAiHU_tF-l4jpKcab2GieWPXp01JkjyfcK1hHMcNKjrJNuQ2I7fyO_zefuimDTiNd-kT7abpAs1p649dk';
export const PLAN_PRO_ID = process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID || DEFAULT_PLAN_ID;
export const PLAN_EARLY_BIRD_ID = process.env.NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID || DEFAULT_PLAN_ID;
export const PLAN_YEARLY_ID = process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || DEFAULT_PLAN_ID;
const INVOICE_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL || 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-9RN20574BN6264401NKUP3CY';

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

    const render = () => {
      if (!window.paypal || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      try {
        // 单次渲染：让 PayPal SDK 根据 enable-funding 自动决定显示金/蓝/黑 3 个按钮
        window.paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
          createSubscription: (data: any, actions: any) =>
            actions.subscription.create({ plan_id: activePlanId }),
          onApprove: (data: any) => {
            const url = new URL('/signup', window.location.origin);
            url.searchParams.set('sub', data.subscriptionID);
            window.location.href = url.toString();
          },
          onError: (err: any) => {
            console.error('[PayPalSubscribeButton] PayPal button error:', err);
            setSdkError(true);
          },
        }).render(containerRef.current);
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
        render();
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
          render();
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
