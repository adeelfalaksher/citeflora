import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source:'/:path*',
      headers:[
        {key:'X-Content-Type-Options',value:'nosniff'},
        {key:'Referrer-Policy',value:'no-referrer'},
        {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
        {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"},
      ],
    }];
  },
};

export default nextConfig;
