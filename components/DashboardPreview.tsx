'use client';

import { useState } from 'react';

const QUOTES = [
  { id: 1, name: 'Mike Chen', service: 'Kitchen renovation', date: 'Aug 14', followups: 2, amount: 3200, status: 'following' as const },
  { id: 2, name: 'Sarah Johnson', service: 'Bathroom remodel', date: 'Aug 10', followups: 1, amount: 8500, status: 'won' as const },
  { id: 3, name: 'Tom Williams', service: 'Roof repair', date: 'Aug 8', followups: 0, amount: 5000, status: 'replied' as const },
  { id: 4, name: 'Lisa Brown', service: 'Landscaping', date: 'Aug 5', followups: 3, amount: 2800, status: 'lost' as const },
];

const STATUS_LABEL: Record<string, string> = {
  following: 'Following up',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
};

export default function DashboardPreview() {
  const [filter, setFilter] = useState('all');
  
  const filtered = filter === 'all' 
    ? QUOTES 
    : QUOTES.filter(q => q.status === filter);

  return (
    <div className="dashboard-preview">
      <div className="preview-filters">
        {(['all', 'following', 'replied', 'won', 'lost'] as const).map((f) => (
          <button
            key={f}
            className={`preview-filter ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f]} ({f === 'all' ? QUOTES.length : QUOTES.filter(q => q.status === f).length})
          </button>
        ))}
      </div>
      <div className="preview-quotes">
        {filtered.map((q) => (
          <div key={q.id} className="preview-quote">
            <div className="preview-quote-left">
              <div className="preview-quote-name">{q.name}</div>
              <div className="preview-quote-meta">
                {q.service} · {q.date} · {q.followups} follow-up{q.followups !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="preview-quote-right">
              <span className="preview-amount">${q.amount.toLocaleString()}</span>
              <span className={`preview-status preview-status-${q.status}`}>
                {STATUS_LABEL[q.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
