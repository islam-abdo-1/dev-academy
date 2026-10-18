import { useEffect, useRef } from 'react'

function TwinklingCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let width
    let height

    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 120 }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.6 + 0.15,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      color:
        index % 6 === 0
          ? 'rgba(0,230,255,'
          : index % 9 === 0
            ? 'rgba(80,230,160,'
            : 'rgba(200,220,255,',
    }))

    let frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      frame += 0.016
      particles.forEach((particle) => {
        const alpha =
          particle.opacity *
          (0.5 + 0.5 * Math.sin(frame * particle.twinkleSpeed * 60 + particle.twinkleOffset))
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
        ctx.fillStyle = particle.color + alpha + ')'
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  )
}

export default function GlowBackground() {
  return (
    <>
      <TwinklingCanvas />
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full animate-glow-pulse"
          style={{
            background: 'radial-gradient(circle, hsla(190,100%,50%,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
            willChange: 'opacity',
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full animate-glow-pulse"
          style={{
            background: 'radial-gradient(circle, hsla(160,60%,50%,0.07) 0%, transparent 70%)',
            filter: 'blur(70px)',
            animationDelay: '2s',
            willChange: 'opacity',
          }}
        />
      </div>
    </>
  )
}
