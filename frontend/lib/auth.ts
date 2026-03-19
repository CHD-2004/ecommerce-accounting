import axios from 'axios'

// 后端接口地址（部署后替换为Netlify地址）
const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// 用户类型定义
export interface User {
  id: number
  username: string
  name: string
  is_admin: boolean
}

// 登录请求
export const login = async (username: string, password: string) => {
  const res = await axios.post(`${API_URL}/api/login`, { username, password })
  const { token, user } = res.data
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
  return user
}

// 退出登录
export const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

// 获取当前登录用户
export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

// 创建带token的axios实例
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：添加token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：处理登录过期
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      logout()
    }
    return Promise.reject(err)
  }
)