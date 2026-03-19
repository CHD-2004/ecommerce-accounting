'use client'
import { useState, useEffect } from 'react'
import { format, parseISO, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { api, getCurrentUser, logout } from '@/lib/auth'

// 类型定义
interface User {
  id: number
  username: string
  name: string
  is_admin: boolean
}

interface AlipayTransaction {
  id: number
  user_id: number
  amount: number
  description: string
  transaction_time: string
}

interface AlibabaTransaction {
  id: number
  user_id: number
  amount: number
  product_name: string
  product_image: string
  product_url: string
  transaction_time: string
}

interface SummaryData {
  alipay: Array<{ period: string; count: number; total: number }>
  alibaba: Array<{ period: string; count: number; total: number }>
  total: { alipay: number; alibaba: number; all: number }
}

export default function Dashboard() {
  const currentUser = getCurrentUser()
  const [users, setUsers] = useState<User[]>([])
  const [alipayData, setAlipayData] = useState<AlipayTransaction[]>([])
  const [alibabaData, setAlibabaData] = useState<AlibabaTransaction[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 筛选条件
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'quarter'>('today')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'alipay' | 'alibaba'>('all')
  const [currentDate, setCurrentDate] = useState(new Date())

  // 未登录跳登录页
  useEffect(() => {
    if (!currentUser) {
      window.location.href = '/login'
    }
  }, [currentUser])

  // 加载用户列表（仅管理员）
  useEffect(() => {
    if (currentUser?.is_admin) {
      api.get('/api/users')
        .then(res => setUsers(res.data))
        .catch(err => console.error('加载用户失败：', err))
    }
  }, [currentUser])

  // 加载核心数据
  useEffect(() => {
    if (!currentUser) return
    setLoading(true)

    // 计算日期范围
    let startDate = ''
    let endDate = ''
    
    if (selectedDateRange === 'today') {
      startDate = format(startOfDay(currentDate), "yyyy-MM-dd 00:00:00")
      endDate = format(endOfDay(currentDate), "yyyy-MM-dd 23:59:59")
    } else if (selectedDateRange === 'week') {
      startDate = format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd 00:00:00")
      endDate = format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd 23:59:59")
    } else if (selectedDateRange === 'month') {
      startDate = format(startOfMonth(currentDate), "yyyy-MM-dd 00:00:00")
      endDate = format(endOfMonth(currentDate), "yyyy-MM-dd 23:59:59")
    } else if (selectedDateRange === 'quarter') {
      startDate = format(startOfQuarter(currentDate), "yyyy-MM-dd 00:00:00")
      endDate = format(endOfQuarter(currentDate), "yyyy-MM-dd 23:59:59")
    }

    // 目标用户ID（管理员可选，普通用户只能看自己）
    const targetUserId = selectedUserId || currentUser.id

    // 并行加载数据
    const fetchData = async () => {
      try {
        // 加载支付宝数据
        const alipayRes = selectedPlatform !== 'alibaba' 
          ? await api.get('/api/alipay', { params: { start_date: startDate, end_date: endDate, user_id: targetUserId } })
          : { data: [] }

        // 加载1688数据
        const alibabaRes = selectedPlatform !== 'alipay'
          ? await api.get('/api/alibaba', { params: { start_date: startDate, end_date: endDate, user_id: targetUserId } })
          : { data: [] }

        // 加载汇总数据
        const summaryRes = await api.get('/api/summary', { params: { period: selectedDateRange, user_id: targetUserId } })

        setAlipayData(alipayRes.data)
        setAlibabaData(alibabaRes.data)
        setSummary(summaryRes.data)
      } catch (err) {
        console.error('加载数据失败：', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser, selectedDateRange, selectedUserId, selectedPlatform, currentDate])

  // 生成日历天数（简化版）
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay() || 7 // 周一为1，周日为7
    const days = []

    // 补全月初空白
    for (let i = 1; i < firstDayOfMonth; i++) {
      days.push({ date: null, isCurrentMonth: false })
    }

    // 当月天数
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i)
      days.push({
        date,
        isCurrentMonth: true,
        isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      })
    }

    return days
  }

  const calendarDays = generateCalendarDays()

  if (!currentUser) return <div className="flex items-center justify-center min-h-screen">加载中...</div>

  return (
    <div className="flex flex-col min-h-screen">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 bg-white shadow-sm p-4 border-b border-blue-100">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-4 items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">
            电商记账系统 - 欢迎您，{currentUser.name}
            {currentUser.is_admin && <span className="ml-2 text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">管理员</span>}
          </h1>

          {/* 筛选栏 */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* 日期范围 */}
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="today">今日</option>
              <option value="week">本周</option>
              <option value="month">本月</option>
              <option value="quarter">本季度</option>
            </select>

            {/* 用户筛选（仅管理员） */}
            {currentUser.is_admin && (
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">全部用户</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            )}

            {/* 平台筛选 */}
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">全部平台</option>
              <option value="alipay">支付宝</option>
              <option value="alibaba">1688</option>
            </select>

            {/* 月份切换 */}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
              >
                上月
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
              >
                下月
              </button>
            </div>

            {/* 退出登录 */}
            <button
              onClick={logout}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
            >
              退出登录
            </button>
          </div>

          {/* 汇总金额 */}
          {summary && (
            <div className="font-mono text-lg text-blue-700">
              总支出：¥{summary.total.all.toFixed(2)}
              {selectedPlatform === 'alipay' && <span className="ml-2 text-sm">支付宝：¥{summary.total.alipay.toFixed(2)}</span>}
              {selectedPlatform === 'alibaba' && <span className="ml-2 text-sm">1688：¥{summary.total.alibaba.toFixed(2)}</span>}
            </div>
          )}
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-6">
        {/* 左侧日历 */}
        <aside className="w-full md:w-64 bg-white rounded-lg shadow-sm p-4 border border-blue-100">
          <h3 className="font-bold text-blue-600 mb-3">
            {format(currentDate, 'yyyy年MM月', { locale: zhCN })}
          </h3>

          {/* 日历表头 */}
          <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-600 mb-2">
            {['一', '二', '三', '四', '五', '六', '日'].map(day => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* 日历日期 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, index) => (
              <div
                key={index}
                onClick={() => item.date && setCurrentDate(item.date)}
                className={`
                  h-8 flex items-center justify-center rounded text-sm cursor-pointer
                  ${item.isCurrentMonth ? 'text-gray-800' : 'text-gray-300'}
                  ${item.isToday ? 'bg-blue-500 text-white font-medium' : ''}
                  ${item.date ? 'hover:bg-blue-100' : ''}
                `}
              >
                {item.date ? format(item.date, 'd') : ''}
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧数据展示 */}
        <div className="flex-1 bg-white rounded-lg shadow-sm p-4 border border-blue-100">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-blue-600">
              加载数据中...
            </div>
          ) : (
            <>
              {/* 支付宝数据 */}
              {(selectedPlatform === 'all' || selectedPlatform === 'alipay') && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-blue-600 mb-4 flex items-center">
                    <span className="mr-2">📱</span> 支付宝交易记录
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="border border-gray-200 p-2 text-left text-sm">用户</th>
                          <th className="border border-gray-200 p-2 text-right font-mono text-sm">金额(¥)</th>
                          <th className="border border-gray-200 p-2 text-left text-sm">交易描述</th>
                          <th className="border border-gray-200 p-2 text-left text-sm">交易时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alipayData.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center p-4 text-gray-500 text-sm">暂无支付宝交易记录</td>
                          </tr>
                        ) : (
                          alipayData.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50">
                              <td className="border border-gray-200 p-2 text-sm">
                                {users.find(u => u.id === item.user_id)?.name || currentUser.name}
                              </td>
                              <td className="border border-gray-200 p-2 text-right font-mono text-sm">{item.amount.toFixed(2)}</td>
                              <td className="border border-gray-200 p-2 text-sm">{item.description}</td>
                              <td className="border border-gray-200 p-2 text-sm">
                                {format(parseISO(item.transaction_time), 'yyyy-MM-dd HH:mm')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 1688数据 */}
              {(selectedPlatform === 'all' || selectedPlatform === 'alibaba') && (
                <div>
                  <h2 className="text-lg font-bold text-blue-600 mb-4 flex items-center">
                    <span className="mr-2">🛒</span> 1688采购记录
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="border border-gray-200 p-2 text-left text-sm">用户</th>
                          <th className="border border-gray-200 p-2 text-right font-mono text-sm">金额(¥)</th>
                          <th className="border border-gray-200 p-2 text-left text-sm">商品名称</th>
                          <th className="border border-gray-200 p-2 text-left text-sm">商品图片</th>
                          <th className="border border-gray-200 p-2 text-left text-sm">交易时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alibabaData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center p-4 text-gray-500 text-sm">暂无1688采购记录</td>
                          </tr>
                        ) : (
                          alibabaData.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50">
                              <td className="border border-gray-200 p-2 text-sm">
                                {users.find(u => u.id === item.user_id)?.name || currentUser.name}
                              </td>
                              <td className="border border-gray-200 p-2 text-right font-mono text-sm">{item.amount.toFixed(2)}</td>
                              <td className="border border-gray-200 p-2 text-sm">
                                <a 
                                  href={item.product_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline hover:text-blue-800"
                                >
                                  {item.product_name}
                                </a>
                              </td>
                              <td className="border border-gray-200 p-2 text-sm">
                                <img 
                                  src={item.product_image} 
                                  alt={item.product_name} 
                                  className="w-12 h-12 object-cover rounded"
                                  loading="lazy"
                                />
                              </td>
                              <td className="border border-gray-200 p-2 text-sm">
                                {format(parseISO(item.transaction_time), 'yyyy-MM-dd HH:mm')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t border-blue-100 p-4 text-center text-gray-500 text-sm">
        7人电商记账系统 © {new Date().getFullYear()} | 数据存储于云端，安全可靠
      </footer>
    </div>
  )
}