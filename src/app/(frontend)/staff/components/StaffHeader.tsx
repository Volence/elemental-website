import React from 'react'

export function StaffHeader() {
  return (
    <div className="container mb-16">
      <div className="text-center mb-8">
        <h1
          className="text-5xl md:text-6xl font-black mb-4 tracking-tight"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
        >
          Staff
        </h1>
        <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 mx-auto mb-6 shadow-[0_0_20px_rgba(236,72,153,0.4)]" />
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Meet the dedicated staff members who make Elemental possible - from team management to
          production.
        </p>
      </div>
    </div>
  )
}

