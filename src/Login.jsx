import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleLogin() {
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (error) setError('Email ou senha incorretos.')
  }

  async function handleSignup() {
    if (!email.trim() || !password) return
    if (password.length !== 6) { setError('A senha deve ter exatamente 6 dígitos.'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (error) {
      setError('Erro ao criar conta. Tenta novamente.')
    } else {
      setSuccess('Conta criada! Entrando...')
      // Auto login after signup
      await supabase.auth.signInWithPassword({ email: email.trim(), password })
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Digite seu email primeiro.'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (error) {
      setError('Erro ao enviar email de recuperação.')
    } else {
      setSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.')
    }
  }

  const isLogin = mode === 'login'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#a3e635', letterSpacing: '3px' }}>
            TRAINEFY
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563' }}>
            Seu treino. Sempre com você.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#1f2937', borderRadius: 12, padding: 4, marginBottom: 24 }}>
          <button
            onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
            style={{ flex: 1, background: isLogin ? '#374151' : 'transparent', border: 'none', borderRadius: 9, padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: isLogin ? '#f9fafb' : '#6b7280', transition: 'all 0.2s' }}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
            style={{ flex: 1, background: !isLogin ? '#374151' : 'transparent', border: 'none', borderRadius: 9, padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: !isLogin ? '#f9fafb' : '#6b7280', transition: 'all 0.2s' }}
          >
            Criar conta
          </button>
        </div>

        {/* Email */}
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
          EMAIL
        </p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (isLogin ? handleLogin() : handleSignup())}
          placeholder="nome@email.com"
          style={{
            width: '100%', background: '#1f2937', border: '1.5px solid #374151',
            borderRadius: 12, padding: '14px 16px', color: '#f9fafb', fontSize: 16,
            outline: 'none', boxSizing: 'border-box', marginBottom: 12,
          }}
        />

        {/* Password */}
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
          SENHA — 6 dígitos
        </p>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={password}
          onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v.length <= 6) setPassword(v); }}
          onKeyDown={e => e.key === 'Enter' && (isLogin ? handleLogin() : handleSignup())}
          placeholder="000000"
          style={{
            width: '100%', background: '#1f2937', border: '1.5px solid #374151',
            borderRadius: 12, padding: '14px 16px', color: '#f9fafb', fontSize: 22,
            fontWeight: 800, letterSpacing: '8px', textAlign: 'center',
            outline: 'none', boxSizing: 'border-box', marginBottom: 16,
          }}
        />

        {/* Error / Success */}
        {error && (
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{error}</p>
        )}
        {success && (
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#a3e635', fontWeight: 600 }}>{success}</p>
        )}

        {/* Main button */}
        <button
          onClick={isLogin ? handleLogin : handleSignup}
          disabled={loading || !email.trim() || !password}
          style={{
            width: '100%', background: email.trim() && password ? '#a3e635' : '#1f2937',
            border: 'none', borderRadius: 12, padding: '15px 0', cursor: email.trim() && password ? 'pointer' : 'default',
            fontSize: 15, fontWeight: 800, color: email.trim() && password ? '#0a0a0a' : '#4b5563',
            transition: 'all 0.2s', marginBottom: 16,
          }}
        >
          {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
        </button>

        {/* Forgot password */}
        {isLogin && (
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            style={{ width: '100%', background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 13, textAlign: 'center' }}
          >
            Esqueci minha senha
          </button>
        )}
      </div>
    </div>
  )
}
