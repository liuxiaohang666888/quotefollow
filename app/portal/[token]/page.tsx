'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface InvoiceData {
  amount: string | null;
  dueDate: string | null;
  paid: boolean;
  paidAt: string | null;
}

interface ReminderData {
  lastSent: string | null;
  count: number;
}

interface PortalData {
  clientId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  projectStatus: string;
  invoice: InvoiceData;
  reminders: ReminderData;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  in_progress: '进行中',
  review: '审核中',
  completed: '已完成',
  on_hold: '暂停',
};

export default function ClientPortalPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/client-portal/${params.token}`)
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

  const isOverdue = data.invoice.dueDate && !data.invoice.paid 
    && new Date(data.invoice.dueDate!) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 头部 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">项目进度</h1>
          <p className="text-gray-500 mt-1">客户：{data.name}</p>
        </div>

        {/* 项目状态 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">当前状态</h2>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.projectStatus === 'completed' ? 'bg-green-100 text-green-700' :
              data.projectStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
              data.projectStatus === 'review' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {STATUS_LABELS[data.projectStatus] || data.projectStatus}
            </span>
            <span className="text-gray-500 text-sm">
              开始于 {new Date(data.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
          {data.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
              {data.notes}
            </div>
          )}
        </div>

        {/* 发票信息 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">发票信息</h2>
          {data.invoice.amount ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">金额</span>
                <span className="font-medium">${data.invoice.amount}</span>
              </div>
              {data.invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">到期日</span>
                  <span className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>
                    {new Date(data.invoice.dueDate).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">状态</span>
                <span className={`font-medium ${data.invoice.paid ? 'text-green-600' : 'text-orange-600'}`}>
                  {data.invoice.paid ? '已支付' : '待支付'}
                </span>
              </div>
              {data.invoice.paidAt && (
                <div className="text-sm text-gray-500">
                  支付时间：{new Date(data.invoice.paidAt).toLocaleDateString('zh-CN')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">暂无发票信息</div>
          )}
          
          {/* 催款提示 */}
          {isOverdue && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              ⚠️ 此发票已逾期 {Math.ceil((Date.now() - new Date(data.invoice.dueDate!).getTime()) / 86400000)} 天
              {data.reminders.count > 0 && `（已发送 ${data.reminders.count} 次提醒）`}
            </div>
          )}
        </div>

        {/* 联系信息 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">联系方式</h2>
          <div className="space-y-2 text-sm text-gray-600">
            {data.email && <div>📧 {data.email}</div>}
            {data.phone && <div>📱 {data.phone}</div>}
          </div>
        </div>

        {/* 底部 */}
        <div className="mt-6 text-center text-sm text-gray-400">
          如有疑问，请联系您的服务提供者
        </div>
      </div>
    </div>
  );
}
