'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
      setLoading(false);
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <h1>OFM</h1>
          <span>Marketplace Command</span>
        </div>
        <form onSubmit={handleLogin}>
          {err && <div className="login-err">{err}</div>}
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required autoComplete="email" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-gold login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
