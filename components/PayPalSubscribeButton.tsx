'use client';

import { useEffect, useRef } from 'react';

// PayPal - voxalo.top 正式生产配置（2026-08-31 刘燕青 PayPal China 账号）
// 硬编码兜底：优先读 env（方便以后通过 Vercel 面板替换），空则使用下方固定值
const DEFAULT_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || 'P-4K331824R0057415LNKATF4A';
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAAxyItsTaXijHpq8NBvrle3h6xOpEJ9vc1nl_OvLlwnfe_OoFH8Uz3tGTs9x-p-nI88xGGROfurcvVyig';
const INVOICE_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL || 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-4K331824R0057415LNKATF4A';

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalSubscribeButton({
  label = 'Get Started — $29/mo',
  planId,
  fallbackHref,
}: {
  label?: string;
  planId?: string;
  fallbackHref?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 传入 planId 优先（如 yearly 专属计划），否则用默认订阅计划
  const activePlanId = planId || DEFAULT_PLAN_ID;

  useEffect(() => {
    if (!activePlanId || !CLIENT_ID || !containerRef.current) return;

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
            actions.subscription.create({ plan_id: activePlanId }),
          onApprove: (data: any) => {
            // 付款成功后跳转到 signup 页面，带 subscription ID
            const url = new URL('/signup', window.location.origin);
            url.searchParams.set('sub', data.subscriptionID);
            window.location.href = url.toString();
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
  }, [activePlanId]);

  // 没配置订阅计划 → 回退到普通发票链接
  if (!activePlanId || !CLIENT_ID) {
    return (
      <a className="btn" href={fallbackHref || INVOICE_URL || '#'}>
        {label}
      </a>
    );
  }

  return <div ref={containerRef} className="paypal-subscribe" aria-label={label} />;
}
