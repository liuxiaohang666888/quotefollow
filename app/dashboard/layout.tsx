import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div>
      <nav className="dash-nav">
        <div className="inner">
          <Link href="/dashboard" className="brand">QuoteFollow</Link>
          <nav>
            <Link href="/dashboard">Quotes</Link>
            <Link href="/dashboard/settings">Settings</Link>
          </nav>
          <form action="/api/logout" method="post">
            <button className="logout" type="submit">Log out</button>
          </form>
        </div>
      </nav>
      <main className="dash-main">{children}</main>
    </div>
  );
}
