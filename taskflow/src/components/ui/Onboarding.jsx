import { useState, useEffect } from 'react'
import { CheckCircle2, Smartphone, Key, PlusCircle, ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getSetting, setSetting } from '../../services/db'
import { useTaskStore } from '../../store/taskStore'

const STEPS = [
  {
    icon: '👋',
    title: 'Chào mừng đến TaskFlow!',
    desc: 'Ứng dụng giúp bạn quản lý công việc thông minh, không bị overwhelm. Hãy cùng thiết lập nhanh trong 1 phút.',
    action: null,
  },
  {
    icon: <Smartphone size={32} className="text-accent" />,
    title: 'Thêm vào màn hình chính',
    desc: 'Để dùng như app thực sự: iOS → nút Share → "Add to Home Screen". Android → menu 3 chấm → "Install app".',
    action: 'skip',
    actionLabel: 'Đã thêm rồi / Bỏ qua',
  },
  {
    icon: <Key size={32} className="text-accent" />,
    title: 'Cài API key AI (tùy chọn)',
    desc: 'TaskFlow dùng Claude hoặc Gemini để parse tasks thông minh, review tuần, chat. Bạn có thể thêm sau trong Settings.',
    action: 'settings',
    actionLabel: 'Vào Settings',
  },
  {
    icon: <PlusCircle size={32} className="text-accent" />,
    title: 'Tạo task đầu tiên!',
    desc: 'Bấm nút + ở góc phải để thêm task, hoặc dùng Quick Capture để nhập nhanh bằng văn bản hay giọng nói.',
    action: 'done',
    actionLabel: 'Bắt đầu thôi!',
  },
]

export default function Onboarding() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const tasks = useTaskStore(s => s.tasks)

  useEffect(() => {
    getSetting('onboardingDone').then(done => {
      if (!done) setShow(true)
    })
  }, [])

  const handleDone = async () => {
    await setSetting('onboardingDone', true)
    setShow(false)
  }

  const handleNext = async () => {
    const currentAction = STEPS[step].action
    if (currentAction === 'settings') {
      navigate('/settings')
    }
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      await handleDone()
    }
  }

  if (!show) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-edge rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
        {/* Close */}
        <div className="flex justify-end p-3 pb-0">
          <button onClick={handleDone} className="text-secondary/50 hover:text-secondary p-1">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 px-6 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : i < step ? 'w-3 bg-accent/50' : 'w-3 bg-edge-2'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            {typeof current.icon === 'string'
              ? <span className="text-5xl">{current.icon}</span>
              : <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center">{current.icon}</div>
            }
          </div>
          <div>
            <h2 className="text-lg font-bold text-fg">{current.title}</h2>
            <p className="text-sm text-secondary mt-2 leading-relaxed">{current.desc}</p>
          </div>

          {/* Progress check if tasks exist on last step */}
          {isLast && tasks.length > 0 && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
              <CheckCircle2 size={14} className="text-green-400 shrink-0" />
              <p className="text-xs text-green-400">Bạn đã có {tasks.length} task — đang trên đà tốt!</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleNext}
              className="w-full h-11 bg-accent hover:bg-accent-muted text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              {isLast ? current.actionLabel : (
                <>
                  {current.action === 'settings' ? current.actionLabel : 'Tiếp theo'}
                  <ChevronRight size={15} />
                </>
              )}
            </button>
            {!isLast && current.action && current.action !== 'skip' && (
              <button onClick={() => setStep(s => s + 1)} className="text-xs text-secondary hover:text-fg">
                Bỏ qua
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
