import React, { useState } from 'react'
import * as api from './api.js'

// 访问口令登录页：登录成功后服务端下发 HttpOnly Cookie，之后免登
export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await api.login(username, password)
      onSuccess()
    } catch {
      setErr('用户名或密码错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f3] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-[#37352f]">NCRE 刷题</h1>
        <p className="mt-1 text-xs text-gray-400">请输入访问口令</p>

        <label className="mt-4 block text-sm text-gray-600" htmlFor="login-user">用户名</label>
        <input
          id="login-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="off"
          className="n-input mt-1 w-full px-3 py-2 text-sm"
        />

        <label className="mt-3 block text-sm text-gray-600" htmlFor="login-pass">密码</label>
        <input
          id="login-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="n-input mt-1 w-full px-3 py-2 text-sm"
        />

        {err && <p className="mt-2 text-xs text-[#eb5757]">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-[#2eaadc] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2898c4] disabled:opacity-50"
        >
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}
