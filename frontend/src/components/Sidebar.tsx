import {
  LayoutDashboard,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import type { AppStep } from '../types'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  activeStep: AppStep
}

const navItems = [
  { key: 'input' as const, icon: LayoutDashboard, label: 'Dashboard', disabled: false },
  { key: 'history' as const, icon: Clock, label: 'History', disabled: true },
  { key: 'settings' as const, icon: Settings, label: 'Settings', disabled: true },
]

const steps: { key: AppStep; label: string }[] = [
  { key: 'input', label: 'Upload' },
  { key: 'insights', label: 'Insights' },
  { key: 'output', label: 'Sprint' },
]

function stepIndex(step: AppStep): number {
  return steps.findIndex((s) => s.key === step)
}

export default function Sidebar({ collapsed, onToggle, activeStep }: SidebarProps) {
  const currentIdx = stepIndex(activeStep)

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-card border-r border-border flex flex-col z-40 transition-all duration-300"
      style={{ width: collapsed ? 72 : 260 }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center cursor-pointer shadow-sm hover:shadow-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 z-50"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-text-secondary" />
        )}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <span
          className="font-semibold text-text-primary text-base whitespace-nowrap transition-opacity duration-200"
          style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden' }}
        >
          Sprint Planner
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 pt-4">
        {navItems.map((item) => {
          const isActive = item.key === 'input' && !item.disabled
          const Icon = item.icon

          return (
            <div
              key={item.key}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-default transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : item.disabled
                    ? 'text-text-muted'
                    : 'text-text-secondary hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm',
              ].join(' ')}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span
                className="text-sm font-medium whitespace-nowrap transition-opacity duration-200"
                style={{
                  opacity: collapsed ? 0 : 1,
                  width: collapsed ? 0 : 'auto',
                  overflow: 'hidden',
                }}
              >
                {item.label}
              </span>
              {item.disabled && !collapsed && (
                <span className="ml-auto text-[10px] bg-slate-100 text-text-muted px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Soon
                </span>
              )}
            </div>
          )
        })}

        {/* Step progress */}
        <div className="mt-6 px-1">
          {!collapsed && (
            <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-3 transition-opacity duration-200">
              Progress
            </p>
          )}
          <div className="flex flex-col gap-0">
            {steps.map((s, idx) => {
              const done = idx < currentIdx
              const active = idx === currentIdx

              return (
                <div key={s.key} className="flex items-start gap-3">
                  {/* Dot + connector line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={[
                        'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200',
                        done
                          ? 'bg-blue-600'
                          : active
                            ? 'bg-blue-600'
                            : 'bg-slate-200',
                      ].join(' ')}
                    >
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      ) : active ? (
                        <Circle className="w-2 h-2 text-white fill-white" />
                      ) : (
                        <Circle className="w-2 h-2 text-slate-400 fill-slate-400" />
                      )}
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={[
                          'w-0.5 h-5 transition-colors duration-200',
                          done ? 'bg-blue-600' : 'bg-slate-200',
                        ].join(' ')}
                      />
                    )}
                  </div>
                  {/* Label */}
                  <span
                    className={[
                      'text-sm pt-px whitespace-nowrap transition-opacity duration-200',
                      active
                        ? 'font-semibold text-text-primary'
                        : done
                          ? 'text-blue-600 font-medium'
                          : 'text-text-muted',
                    ].join(' ')}
                    style={{
                      opacity: collapsed ? 0 : 1,
                      width: collapsed ? 0 : 'auto',
                      overflow: 'hidden',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      {/* User area */}
      <div className="px-4 pb-5 pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <span
            className="text-sm font-medium text-text-primary whitespace-nowrap transition-opacity duration-200"
            style={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
              overflow: 'hidden',
            }}
          >
            User
          </span>
        </div>
      </div>
    </aside>
  )
}
