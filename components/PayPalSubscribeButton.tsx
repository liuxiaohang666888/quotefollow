'use client';

import { useEffect, useRef } from 'react';

const PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID;
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const INVOICE_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL;

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalSubscribeButton({
  label = 'Get Started — $29/mo',
  fallbackHref,
}: {
  label?: string;
  fallbackHref?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!PLAN_ID || !CLIENT_ID || !containerRef.current) return;

    const render = () => {
      if (!window.paypal || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      window.paypal
        .Buttons({
          style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe',
          },
          createSubscription: (data: any, actions: any) =>
            actions.subscription.create({ plan_id: PLAN_ID }),
          onApprove: (data: any) => {
            window.location.href = `/signup?sub=${data.subscriptionID}`;
          },
        })
        .render(containerRef.current);
    };

    const existing = document.querySelector('script[data-paypal-sdk="qf"]');
    if (!existing) {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription`;
      s.setAttribute('data-paypal-sdk', 'qf');
      s.onload = render;
      document.body.appendChild(s);
    } else {
      render();
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  // 没配置订阅计划 → 回退到普通发票链接
  if (!PLAN_ID || !CLIENT_ID) {
    return (
      <a className="btn" href={fallbackHref || INVOICE_URL || '#'}>
        {label}
      </a>
    );
  }

  return <div ref={containerRef} className="paypal-subscribe" aria-label={label} />;
}
