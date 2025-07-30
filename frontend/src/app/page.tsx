'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function Home() {
  useEffect(() => {
    logger.info('Home page loaded successfully!', { 
      timestamp: new Date().toISOString(),
      page: 'home'
    })
  }, [])

  return (
    <div>
      <h1>Welcome to Market Manager</h1>
      <p>Your comprehensive platform for market management.</p>
      <button 
        onClick={() => logger.info('Button clicked!', { action: 'test_click' })}
        style={{ padding: '10px', background: 'blue', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        Test BetterStack Logging
      </button>
    </div>
  )
}