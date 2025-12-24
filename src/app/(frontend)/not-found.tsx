import Link from 'next/link'
import React from 'react'
import { Home, Search, FileQuestion } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container min-h-[calc(100vh-200px)] flex items-center justify-center py-28">
      <div className="text-center max-w-2xl mx-auto">
        {/* Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <FileQuestion className="w-16 h-16 text-primary" />
          </div>
        </div>

        {/* 404 Number */}
        <h1 className="text-9xl font-black mb-4 bg-gradient-to-r from-primary via-pink-500 to-cyan-500 bg-clip-text text-transparent">
          404
        </h1>
        
        {/* Gradient underline */}
        <div className="w-24 h-1.5 bg-gradient-to-r from-primary via-pink-500 to-cyan-500 rounded-full mx-auto mb-6"></div>
        
        {/* Message */}
        <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link href="/teams">
              <Search className="w-4 h-4" />
              View Teams
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
