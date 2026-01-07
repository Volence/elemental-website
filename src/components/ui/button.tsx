import { cn } from '@/utilities/ui'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        clear: '',
        default: 'h-10 px-4 py-2',
        icon: 'h-10 w-10',
        lg: 'h-11 rounded px-8',
        sm: 'h-9 rounded px-3',
      },
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        ghost: 'hover:bg-card hover:text-accent-foreground',
        glow: 'relative border-2 border-cyan-500 bg-transparent text-slate-800 dark:text-white hover:border-pink-500 hover:text-slate-900 dark:hover:text-white hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] before:absolute before:inset-0 before:rounded before:bg-gradient-to-r before:from-cyan-400/10 before:to-pink-500/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity',
        glowYellow: 'relative border-2 border-yellow-500 bg-transparent text-yellow-600 dark:text-yellow-400 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] before:absolute before:inset-0 before:rounded before:bg-gradient-to-r before:from-yellow-400/10 before:to-orange-500/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity',
        link: 'text-primary items-start justify-start underline-offset-4 hover:underline',
        outline: 'border border-border bg-background hover:bg-card hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ref?: React.Ref<HTMLButtonElement>
}

const Button: React.FC<ButtonProps> = ({
  asChild = false,
  className,
  size,
  variant,
  ref,
  ...props
}) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ className, size, variant }))} ref={ref} {...props} />
}

export { Button, buttonVariants }
