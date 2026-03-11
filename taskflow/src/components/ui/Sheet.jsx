export default function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Mobile: bottom sheet | Desktop: centered modal */}
      <div className="relative bg-surface rounded-t-2xl md:rounded-2xl w-full md:max-w-lg md:mx-4 max-h-[85vh] md:max-h-[80vh] flex flex-col animate-slide-up md:animate-fade-in">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-edge shrink-0">
          <h2 className="font-semibold text-base text-fg">{title}</h2>
          <button onClick={onClose} className="text-secondary hover:text-fg text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-edge transition-colors">×</button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain safe-bottom md:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
