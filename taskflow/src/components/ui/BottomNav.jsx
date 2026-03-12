import { NavLink } from 'react-router-dom'
import { Home, CheckSquare, Calendar, Target, BookOpen, Lightbulb, Settings, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

// All tabs for desktop sidebar
const allTabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

// 5 tabs for mobile bottom bar (max comfortable on mobile)
const mobileTabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/settings', icon: MoreHorizontal, label: 'More' },
]

// Extra tabs shown in "More" slide-up on mobile
const moreTabs = [
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNav() {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-edge safe-bottom z-40 md:hidden">
        <div className="flex max-w-lg mx-auto">
          {mobileTabs.map(({ to, icon: Icon, label }) => {
            // "More" button opens slide-up
            if (label === 'More') {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(s => !s)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors min-h-[52px] justify-center
                    ${showMore ? 'text-accent' : 'text-secondary hover:text-fg-2'}`}
                >
                  <Icon size={20} strokeWidth={1.8} />
                  {label}
                </button>
              )
            }
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors min-h-[52px] justify-center
                  ${isActive ? 'text-accent' : 'text-secondary hover:text-fg-2'}`
                }
              >
                <Icon size={20} strokeWidth={1.8} />
                {label}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Mobile: "More" slide-up panel */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-[52px] left-0 right-0 bg-surface border-t border-edge rounded-t-2xl z-35 md:hidden animate-slide-up safe-bottom">
            <div className="px-4 py-3 space-y-1">
              {moreTabs.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-accent-soft text-accent border border-accent-border'
                      : 'text-secondary hover:text-fg hover:bg-hover border border-transparent'}`
                  }
                >
                  <Icon size={18} strokeWidth={1.8} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Desktop: side rail */}
      <nav className="max-md:hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[220px] bg-surface border-r border-edge-2 z-40">
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-lg font-bold text-fg tracking-tight">TaskFlow</h1>
          <p className="text-[10px] text-secondary/60 mt-0.5">Personal dashboard</p>
        </div>
        <div className="flex-1 px-3 py-2 space-y-0.5">
          {allTabs.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-accent-soft text-accent border border-accent-border'
                  : 'text-secondary hover:text-fg hover:bg-hover border border-transparent'}`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
