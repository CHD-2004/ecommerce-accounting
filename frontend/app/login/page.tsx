'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // 7个固定用户选项
  const users = [
    { value: 'hanbin', label: '汉斌' },
    { value: 'hanpeng', label: '汉鹏' },
    { value: 'hanlong', label: '汉龙' },
    { value: 'hanyang', label: '汉阳' },
    { value: 'hanfeng', label: '汉丰' },
    { value: 'hanwei', label: '汉伟' },
    { value: 'handi', label: '汉迪' },
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(username, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-500/5">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-lg rounded-lg shadow-xl p-8 border border-blue-400/20">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-8">电商记账系统</h1>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-blue-700 mb-2">选择账号</label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">请选择登录账号</option>
              {users.map((user) => (
                <option key={user.value} value={user.value}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-blue-700 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="初始密码：123456"
              className="w-full px-4 py-2 rounded-lg border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-400 transition-colors disabled:bg-gray-400"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          初始密码统一为：123456，登录后可自行修改（扩展功能）
        </div>
      </div>
    </div>
  )
}