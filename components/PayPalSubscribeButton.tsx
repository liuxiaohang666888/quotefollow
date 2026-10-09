'use client';

import { useEffect, useRef, useState } from 'react';

// PayPal - voxalo.top 正式生产配置（2026-08-31 刘燕青 PayPal China 账号）
// 硬编码：不读 env，防止 Vercel 环境变量覆盖错误值
const DEFAULT_PLAN_ID = 'P-9RN20574BN6264401NKUP3CY';
const CLIENT_ID = 'BAAiHU_tF-l4jpKcab2GieWPXp01JkjyfcK1hHMcNKjrJNuQ2I7fyO_zefuimDTiNd-kT7abpAs1p649dk';
export const PLAN_PRO_ID = process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID || 'P-9RN20574BN6264401NKUP3CY';
export const PLAN_EARLY_BIRD_ID = process.env.NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID || 'P-EARLYBIRD-PLN-ID';
export const PLAN_YEARLY_ID = process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || 'P-YEARLY-PLN-ID';
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
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!existing) {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription&enable-funding=credit`;
      s.setAttribute('data-paypal-sdk', 'qf');
      s.onload = () => {
        clearTimeout(timeout);
        // Script loaded — render the button THEN flip state so the
        // container div (always rendered now) is available for render()
        setSdkLoaded(true);
        render();
      };
      s.onerror = () => {
        clearTimeout(timeout);
        setSdkError(true);
      };
      // SDK 5 秒没加载出来（PayPal 偶发抽风/网络问题）→ 显示 fallback 按钮
      timeout = setTimeout(() => setSdkError(true), 5000);
      document.body.appendChild(s);
    } else {
      // 脚本标签已存在（同页另一个按钮实例插的）但 window.paypal 可能还没就绪，轮询等最多 5 秒
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
