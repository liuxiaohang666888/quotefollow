'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface DepositData {
  customerName: string;
  serviceType: string;
  depositAmount: string | null;
  depositStatus: string;
  depositPaidAt: string | null;
  paymentLink: string;
  businessName: string;
}

export default function DepositPortalPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<DepositData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal-deposit/${params.token}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) {
          setData(json.data);
        } else {
          setError(json.error || '加载失败');
        }
      })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">链接无效或已过期</div>
          <div className="text-gray-500">请联系您的服务提供者</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const paid = data.depositStatus === 'paid';
  const hasLink = !!data.paymentLink;

  // 跳转链接：PayPal.me 支持 /金额 后缀，尽量带上
  let payHref = '';
  if (hasLink) {
    const base = data.paymentLink.replace(/\/+$/, '');
    if (/paypal\.me\//i.test(base) && data.depositAmount) {
      payHref = `${base}/${data.depositAmount}`;
    } else {
      payHref = base;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">定金支付</h1>
          <p className="text-gray-500 mt-1">Deposit payment</p>

          {data.customerName && (
            <div className="mt-4 text-sm text-gray-600">
              客户：<span className="font-medium text-gray-900">{data.customerName}</span>
            </div>
          )}
          {data.serviceType && (
            <div className="text-sm text-gray-600">
              项目：<span className="font-medium text-gray-900">{data.serviceType}</span>
            </div>
          )}

          <div className="mt-6 p-6 rounded-xl border border-gray-200">
            <div className="text-gray-500 text-sm">应付定金</div>
            <div className="text-4xl font-bold text-gray-900 mt-1">
              ${data.depositAmount ?? '—'}
            </div>
          </div>

          {paid ? (
            <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-green-700 font-semibold">Deposit paid</div>
              {data.depositPaidAt && (
                <div className="text-green-600 text-sm mt-1">
                  {new Date(data.depositPaidAt).toLocaleDateString('zh-CN')}
                </div>
              )}
              <div className="text-gray-500 text-sm mt-2">定金已确认到账，感谢您的信任。</div>
            </div>
          ) : hasLink ? (
            <a
              href={payHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-center"
              style={{ background: '#16a34a' }}
            >
              Pay deposit — ${data.depositAmount ?? ''}
            </a>
          ) : (
            <div className="mt-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
              收款链接暂未配置，请联系服务提供者。
            </div>
          )}

          <div className="mt-8 text-sm text-gray-400">
            由 {data.businessName || '服务提供者'} 发起
          </div>
        </div>
      </div>
    </div>
  );
}
