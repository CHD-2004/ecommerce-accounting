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

  // 7个固定用户列表
  const users = [
    { value: 'hanbin', label: '汉斌（管理员）' },
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
      setError(err.response?.data?.error || '登录失败，请检查账号密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 border border-blue-200">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-8">7人电商记账系统</h1>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择登录账号</label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">请选择账号</option>
              {users.map((user) => (
                <option key={user.value} value={user.value}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="初始密码：123456"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录系统'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          初始密码统一为：123456 | 登录后可修改密码（扩展功能）
        </div>
      </div>
    </div>
  )
}