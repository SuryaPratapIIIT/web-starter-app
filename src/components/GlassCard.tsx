import { ReactNode, CSSProperties, HTMLAttributes } from 'react'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export const GlassCard = ({ children, className, style, ...props }: GlassCardProps) => (
  <div
    className={`glass-card ${className || ''}`}
    style={style}
    {...props}
  >
    {children}
  </div>
)
