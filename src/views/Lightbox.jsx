import React from 'react'

export default function Lightbox({ ctx }) {
  const { lightbox, setLightbox, items } = ctx
  return (
    <>
{/* 图片灯箱 */}
{lightbox && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    onClick={() => setLightbox(null)}
    role="dialog"
    aria-modal="true"
  >
    <img src={lightbox} alt="题目配图" className="max-h-full max-w-full rounded-md bg-white object-contain" />
    <button
      type="button"
      onClick={() => setLightbox(null)}
      aria-label="关闭图片"
      className="absolute right-4 top-4 rounded-md bg-white/90 px-2 py-1 text-sm text-gray-700"
    >
      关闭
    </button>
  </div>
)}
    </>
  )
}
