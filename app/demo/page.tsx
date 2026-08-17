import { redirect } from 'next/navigation';

// /demo 不再单独展示（主页已内嵌实时演示），误点直接跳回主页，避免 404
export default function DemoPage() {
  redirect('/');
}
