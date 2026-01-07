'use client'

import React, { useEffect, useRef } from 'react'

interface ParticleBackgroundProps {
  particleCount?: number
  className?: string
}

/**
 * Animated particle background with floating geometric shapes
 * CSS-only animation for performance
 */
export function ParticleBackground({ 
  particleCount = 50,
  className = '' 
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    container.innerHTML = '' // Clear existing particles

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      
      // Random properties
      const size = Math.random() * 4 + 2 // 2-6px
      const startX = Math.random() * 100
      const startY = Math.random() * 100
      const duration = Math.random() * 20 + 15 // 15-35s
      const delay = Math.random() * -20 // Stagger start times
      const opacity = Math.random() * 0.4 + 0.1 // 0.1-0.5
      
      // Random shape (circle, square, or diamond)
      const shapes = ['circle', 'square', 'diamond']
      const shape = shapes[Math.floor(Math.random() * shapes.length)]
      
      // Random color from accent palette
      const colors = [
        'hsl(var(--accent-blue))',
        'hsl(var(--accent-green))',
        'hsl(var(--accent-gold))',
        'hsl(var(--primary))',
      ]
      const color = colors[Math.floor(Math.random() * colors.length)]
      
      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${startX}%;
        top: ${startY}%;
        background: ${color};
        opacity: ${opacity};
        border-radius: ${shape === 'circle' ? '50%' : shape === 'diamond' ? '0' : '2px'};
        transform: ${shape === 'diamond' ? 'rotate(45deg)' : 'none'};
        animation: float-particle ${duration}s linear ${delay}s infinite;
        pointer-events: none;
        will-change: transform, opacity;
      `
      
      container.appendChild(particle)
    }
  }, [particleCount])

  return (
    <>
      <style jsx global>{`
        @keyframes float-particle {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: var(--particle-opacity, 0.3);
          }
          50% {
            transform: translateY(-50vh) translateX(20px) scale(1.2);
          }
          90% {
            opacity: var(--particle-opacity, 0.3);
          }
          100% {
            transform: translateY(-100vh) translateX(-20px) scale(0.8);
            opacity: 0;
          }
        }
        
        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
          }
          50% {
            box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
          }
        }
      `}</style>
      <div 
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
        aria-hidden="true"
      />
    </>
  )
}

/**
 * Floating orbs with glow effect - fewer, larger, more noticeable
 */
export function GlowingOrbs({ className = '' }: { className?: string }) {
  return (
    <>
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(30px, -20px) scale(1.1);
          }
          50% {
            transform: translate(-20px, -40px) scale(0.9);
          }
          75% {
            transform: translate(20px, -20px) scale(1.05);
          }
        }
        
        @keyframes float-slow-reverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(-30px, 20px) scale(0.9);
          }
          50% {
            transform: translate(20px, 40px) scale(1.1);
          }
          75% {
            transform: translate(-20px, 20px) scale(0.95);
          }
        }
      `}</style>
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
        {/* Large slow-moving orbs */}
        <div 
          className="absolute w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.7), transparent 70%)',
            left: '5%',
            top: '10%',
            filter: 'blur(60px)',
            animation: 'float-slow 25s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.6), transparent 70%)',
            right: '10%',
            top: '30%',
            filter: 'blur(70px)',
            animation: 'float-slow-reverse 30s ease-in-out infinite',
            animationDelay: '-5s',
          }}
        />
        <div 
          className="absolute w-48 h-48 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.7), transparent 70%)',
            left: '50%',
            top: '50%',
            filter: 'blur(50px)',
            animation: 'float-slow 20s ease-in-out infinite',
            animationDelay: '-10s',
          }}
        />
        <div 
          className="absolute w-56 h-56 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.5), transparent 70%)',
            left: '25%',
            bottom: '5%',
            filter: 'blur(60px)',
            animation: 'float-slow-reverse 28s ease-in-out infinite',
            animationDelay: '-15s',
          }}
        />
      </div>
    </>
  )
}
