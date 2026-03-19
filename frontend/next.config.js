/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['via.placeholder.com', '1688.com'], // 允许加载的图片域名
  },
}

module.exports = nextConfig