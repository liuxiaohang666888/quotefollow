'use client';

import { useEffect, useRef, useState } from 'react';

// PayPal - voxalo.top 正式生产配置（2026-08-31 刘燕青 PayPal China 账号）
// ⚠️ 硬编码避免 Vercel 环境变量覆盖（上次被旧值搞挂）
const DEFAULT_PLAN_ID = 'P-9RN20574BN6264401NKUP3CY';
const CLIENT_ID = 'BAAiHU_tF-l4jpKcab2GieWPXp01JkjyfcK1hHMcNKjrJNuQ2I7fyO_zefuimDTiNd-kT7abpAs1p649dk';
export const PLAN_PRO_ID = process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID || DEFAULT_PLAN_ID;
export const PLAN_EARLY_BIRD_ID = process.env.NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID || DEFAULT_PLAN_ID;
export const PLAN_YEARLY_ID = process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || DEFAULT_PLAN_ID;
const INVOICE_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL || 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-9RN20574BN6264401NKUP3CY';

declare global {
  interface Window {
    paypal?: any;
  }
}

const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription&enable-funding=paylater%2Ccard`;

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
  const [sdkError, setSdkError] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePlanId || !CLIENT_ID) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let renderAttempts = 0;
    let settled = false;

    const finish = (error: boolean) => {
      if (settled) return;
      settled = true;
      if (interval) clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
      if (error) setSdkError(true);
      setLoading(false);
    };

    // 硬超时兜底：无论 SDK 加载/轮询/渲染处于何种状态，约 10s 后强制回退为订阅链接
    const hardTimeout = setTimeout(() => finish(true), 10000);

    const renderButtons = () => {
      if (cancelled || settled) return;
      if (!window.paypal || !containerRef.current) return; // 容器未就绪，交给轮询/硬超时兜底
      if (renderAttempts >= 3) {
        finish(true);
        return;
      }
      renderAttempts++;
      try {
        window.paypal
          .Buttons({
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
              finish(true);
            },
          })
          .render(containerRef.current)
          .then(() => {
            // 渲染成功后再确认 iframe 真正落盘；偶发容器未显示时重试一次
            setTimeout(() => {
              if (cancelled || settled) return;
              const hasIframe = !!containerRef.current?.querySelector('iframe');
              if (!hasIframe && renderAttempts < 3) {
                renderButtons();
              } else if (!hasIframe) {
                // 渲染完成但 iframe 未落盘且重试已耗尽 → 回退订阅链接兜底
                finish(true);
              } else {
                setLoading(false);
              }
            }, 1200);
          })
          .catch((err: any) => {
            console.error('[PayPalSubscribeButton] render error:', err);
            if (renderAttempts >= 3) {
              finish(true);
            } else {
              retryTimer = setTimeout(renderButtons, 500);
            }
          });
      } catch (err) {
        console.error('[PayPalSubscribeButton] render throw:', err);
        if (renderAttempts >= 3) {
          finish(true);
        } else {
          retryTimer = setTimeout(renderButtons, 500);
        }
      }
    };

    const existing = document.querySelector('script[data-paypal-sdk="qf"]');

    if (!existing) {
      const s = document.createElement('script');
      s.src = SDK_SRC;
      s.setAttribute('data-paypal-sdk', 'qf');

      s.onload = () => {
        if (cancelled || settled) return;
        startPolling();
      };

      s.onerror = () => {
        if (cancelled || settled) return;
        finish(true);
      };

      document.body.appendChild(s);
    } else {
      // SDK 已在页面中，直接尝试渲染
      startPolling();
    }

    function startPolling() {
      let attempts = 0;
      interval = setInterval(() => {
        attempts++;
        if (cancelled || settled) return;
        if (window.paypal) {
          if (interval) clearInterval(interval);
          interval = undefined;
          renderButtons();
        } else if (attempts > 25) {
          // SDK 脚本加载了但 paypal 对象没出现 → 校验失败（400 等）
          finish(true);
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      settled = true;
      if (interval) clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
      clearTimeout(hardTimeout);
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
      {loading && !sdkError && (
        <button className="btn" disabled style={{ opacity: 0.6 }}>
          Loading PayPal…
        </button>
      )}
    </div>
  );
}
