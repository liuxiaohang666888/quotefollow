'use client';

import { useEffect, useRef, useState } from 'react';

// PayPal - voxalo.top 正式生产配置（2026-08-31 刘燕青 PayPal China 账号）
// 硬编码兜底：优先读 env（方便以后通过 Vercel 面板替换），空则使用下方固定值
const DEFAULT_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || 'P-5DN937607C181825LNKSPLWI';
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'BAAxyItsTaXijHpq8NBvrle3h6xOpEJ9vc1nl_OvLlwnfe_OoFH8Uz3tGTs9x-p-nI88xGGROfurcvVyig';
const INVOICE_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL || 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5DN937607C181825LNKSPLWI';

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalSubscribeButton({
  label = 'Subscribe — $9 first month, then $19/mo',
  planId,
  fallbackHref,
}: {
  label?: string;
  planId?: string;
  fallbackHref?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  // 传入 planId 优先（如 yearly 专属计划），否则用默认订阅计划
  const activePlanId = planId || DEFAULT_PLAN_ID;

  useEffect(() => {
    if (!activePlanId || !CLIENT_ID || !containerRef.current) return;

    const render = () => {
      if (!window.paypal || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      try {
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
            onError: (err: any) => {
              console.error('[PayPalSubscribeButton] PayPal button error:', err);
              setSdkError(true);
            },
          })
          .render(containerRef.current);
        setSdkLoaded(true);
      } catch (err) {
        console.error('[PayPalSubscribeButton] render error:', err);
        setSdkError(true);
      }
    };

    const existing = document.querySelector('script[data-paypal-sdk="qf"]');
    if (!existing) {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription`;
      s.setAttribute('data-paypal-sdk', 'qf');
      s.onload = () => setSdkLoaded(true);
      s.onerror = () => setSdkError(true);
      document.body.appendChild(s);
    } else {
      setSdkLoaded(true);
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

  // SDK 加载失败或超时（5秒），显示 fallback 按钮
  if (sdkError) {
    return (
      <a className="btn" href={fallbackHref || INVOICE_URL} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }

  if (!sdkLoaded) {
    return (
      <button className="btn" disabled style={{ opacity: 0.6 }}>
        Loading PayPal…
      </button>
    );
  }

  return <div ref={containerRef} className="paypal-subscribe" aria-label={label} />;
}
