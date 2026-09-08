// ============================================================
// Home page — redirects to dashboard (or login if not signed in)
// ============================================================

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
