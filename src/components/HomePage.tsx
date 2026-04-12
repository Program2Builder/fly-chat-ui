import { useEffect, useRef } from 'react'

interface HomePageProps {
  onOpenChat: () => void
}

/* ─── tiny hook: run animated canvas ─── */
function useCanvasBg(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let id: number
    let W = 0, H = 0

    const mouse = { x: -9999, y: -9999, active: false }
    const onMM = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true }
    const onML = () => { mouse.active = false }
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseleave', onML)

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    interface Orb { x: number; y: number; r: number; vx: number; vy: number; bvx: number; bvy: number; h: number; a: number }
    const orbs: Orb[] = []
    for (let i = 0; i < 16; i++) {
      const bvx = (Math.random() - 0.5) * 0.3
      const bvy = (Math.random() - 0.5) * 0.3
      orbs.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, r: 140 + Math.random() * 240, vx: bvx, vy: bvy, bvx, bvy, h: Math.random() * 360, a: 0.04 + Math.random() * 0.09 })
    }

    interface Node { x: number; y: number; vx: number; vy: number; r: number }
    const nodes: Node[] = []
    for (let i = 0; i < 70; i++)
      nodes.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, vx: (Math.random() - 0.5) * 0.38, vy: (Math.random() - 0.5) * 0.38, r: 1.4 + Math.random() * 1.8 })

    let ripR = 0, ripA = 0

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#040c12'); bg.addColorStop(1, '#070f18')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      const AR = 400, AF = 0.016, DAMP = 0.97
      orbs.forEach(o => {
        if (mouse.active) {
          const dx = mouse.x - o.x, dy = mouse.y - o.y, d = Math.sqrt(dx * dx + dy * dy)
          if (d < AR && d > 1) { const s = AF * (1 - d / AR); o.vx += (dx / d) * s * o.r * 0.01; o.vy += (dy / d) * s * o.r * 0.01 }
          else { o.vx += (o.bvx - o.vx) * 0.02; o.vy += (o.bvy - o.vy) * 0.02 }
        } else { o.vx += (o.bvx - o.vx) * 0.02; o.vy += (o.bvy - o.vy) * 0.02 }
        const sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy)
        if (sp > 3) { o.vx = (o.vx / sp) * 3; o.vy = (o.vy / sp) * 3 }
        o.vx *= DAMP; o.vy *= DAMP; o.x += o.vx; o.y += o.vy
        if (o.x < -o.r) o.x = W + o.r; if (o.x > W + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = H + o.r; if (o.y > H + o.r) o.y = -o.r
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, `hsla(${o.h},78%,52%,${o.a})`); g.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
      })

      const NR = 90, NF = 1.6, MAX_D = 120
      nodes.forEach(n => {
        if (mouse.active) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.sqrt(dx * dx + dy * dy)
          if (d < NR && d > 1) { const p = (1 - d / NR) * NF; n.vx += (dx / d) * p; n.vy += (dy / d) * p }
        }
        const ps = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (ps > 2.8) { n.vx = (n.vx / ps) * 2.8; n.vy = (n.vy / ps) * 2.8 }
        n.vx *= 0.97; n.vy *= 0.97; n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,168,132,0.5)'; ctx.fill()
      })
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d = Math.sqrt(dx * dx + dy * dy)
        if (d < MAX_D) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.strokeStyle = `rgba(0,168,132,${0.15 * (1 - d / MAX_D)})`; ctx.lineWidth = 1; ctx.stroke() }
      }

      if (mouse.active) {
        const aura = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 55)
        aura.addColorStop(0, 'rgba(0,168,132,0.14)'); aura.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 55, 0, Math.PI * 2); ctx.fillStyle = aura; ctx.fill()
        ripR += 1.3; ripA = Math.max(0, 0.35 * (1 - ripR / 75))
        if (ripR > 75) { ripR = 0; ripA = 0.35 }
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, ripR, 0, Math.PI * 2); ctx.strokeStyle = `rgba(0,212,163,${ripA})`; ctx.lineWidth = 1.4; ctx.stroke()
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,212,163,0.85)'; ctx.fill()
      }
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseleave', onML)
    }
  }, [ref])
}

/* ─── Feature card data ─── */
const FEATURES = [
  {
    icon: '⚡',
    title: 'Real-time Velocity',
    desc: 'Powered by STOMP over SockJS. Messages, presence, and typing signals are delivered with sub-50ms latency.',
    tech: 'WS + STOMP'
  },
  {
    icon: '🔐',
    title: 'Military-Grade E2EE',
    desc: 'Signal Protocol integration using X3DH and Double Ratchet. Your keys never leave your device.',
    tech: 'libsignal + WebCrypto'
  },
  {
    icon: '👥',
    title: 'Dynamic Social',
    desc: 'Rich group management, real-time presence indicators, and intelligent contact synchronization.',
    tech: 'Reactive State'
  },
  {
    icon: '📎',
    title: 'Media Suite',
    desc: 'End-to-end encrypted file sharing with a built-in canvas editor for image annotations.',
    tech: 'Fabric.js + REST'
  },
  {
    icon: '⌨️',
    title: 'Natural Flow',
    desc: 'Smooth typing indicators and read receipts make digital conversations feel physically present.',
    tech: 'Event Buffering'
  },
  {
    icon: '🏗️',
    title: 'Stateless Core',
    desc: 'Connect the frontend to any Spring Boot implementation. Built for scalability and easy deployment.',
    tech: 'Spring Architecture'
  },
]

/* ─── Fake conversation preview ─── */
const MESSAGES = [
  { own: false, name: 'Alice', text: 'Santanu, did you finish the E2EE update? 🔐', time: '09:41' },
  { own: true, name: 'You', text: 'Yes! Double Ratchet is fully integrated. 🚀', time: '09:42' },
  { own: false, name: 'Alice', text: 'The latency is incredible. Feels instant. ⌨️', time: '09:42' },
  { own: true, name: 'You', text: 'That\'s the power of STOMP magic ✨', time: '09:43' },
]

export function HomePage({ onOpenChat }: HomePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useCanvasBg(canvasRef)

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Outfit', 'Inter', sans-serif", color: '#e9edef', overflowX: 'hidden', backgroundColor: '#040c12' }}>

      {/* ── Google Font Embed (Outfit) ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes hp-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes liquid {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes nav-glow {
          0%, 100% { box-shadow: 0 10px 30px -10px rgba(0,168,132,0.3); }
          50% { box-shadow: 0 15px 45px -5px rgba(5,240,255,0.4); }
        }
      `}</style>

      {/* ── Canvas background ── */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />

      {/* ── Grid/Grain Overlay ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,168,132,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,168,132,0.035) 1px,transparent 1px)',
        backgroundSize: '80px 80px',
      }} />

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ━━━ NAV ━━━ */}
        <div style={{
          position: 'fixed', top: '20px', left: 0, width: '100%',
          zIndex: 1000, padding: '0 24px', pointerEvents: 'none'
        }}>
          <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            maxWidth: '1200px', margin: '0 auto',
            padding: '0 32px', height: '80px',
            pointerEvents: 'auto',
            background: 'linear-gradient(-45deg, rgba(4,12,18,0.8), rgba(11,20,26,0.8), rgba(0,168,132,0.15), rgba(4,12,18,0.8))',
            backgroundSize: '400% 400%',
            animation: 'liquid 15s ease infinite, nav-glow 6s ease-in-out infinite',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '14px',
                background: 'linear-gradient(135deg,#00a884,#05f0ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(0,168,132,0.3)', fontSize: '22px',
              }}>✈️</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(90deg,#fff,#8696a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.02em' }}>FlyChat</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00d4a3', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '-2px' }}>v1.0 Release</span>
              </div>
            </div>

            {/* Nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
              {['Features', 'Architect', 'Portfolio'].map(l => {
                const href = 
                  l === 'Portfolio' ? 'https://devsantanu.xyz/' : 
                  l === 'Architect' ? '#architect' : `#${l.toLowerCase()}`;
                return (
                  <a key={l} href={href} target={l === 'Portfolio' ? '_blank' : '_self'} style={{
                    color: '#8696a0', fontSize: '0.9rem', fontWeight: 500, textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.textShadow = '0 0 8px rgba(255,255,255,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#8696a0'; e.currentTarget.style.textShadow = 'none' }}
                  >{l}</a>
                );
              })}
            </div>

            {/* CTA */}
            <button
              onClick={onOpenChat}
              style={{
                padding: '12px 28px',
                background: '#fff',
                border: 'none', borderRadius: '14px', color: '#040c12',
                fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(255,255,255,0.25)',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(255,255,255,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,255,255,0.25)' }}
            >
              Launch Chat →
            </button>
          </nav>
        </div>

        {/* ━━━ HERO ━━━ */}
        <section style={{
          minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center',
          padding: '160px 48px 80px', // Extra top padding for floating header
        }}>
          <div style={{ maxWidth: '1260px', margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '80px', alignItems: 'center' }}>

            {/* Left: copy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                <span style={{
                  padding: '6px 14px', borderRadius: '30px', fontSize: '0.75rem', fontWeight: 700,
                  background: 'rgba(0,168,132,0.1)', border: '1px solid rgba(0,168,132,0.2)',
                  color: '#00d4a3', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>✨ Crafted with Passion by Santanu Sau</span>
              </div>

              {/* Headline */}
              <h1 style={{
                margin: 0,
                fontSize: 'clamp(3rem, 6vw, 5.5rem)',
                fontWeight: 900, letterSpacing: '-0.05em',
                lineHeight: 1,
              }}>
                <span style={{ display: 'block', color: '#fff' }}>Messaging.</span>
                <span style={{
                  display: 'block',
                  backgroundImage: 'linear-gradient(90deg, #00d4a3 0%, #05f0ff 100%)',
                  backgroundSize: '100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent', // Ensuring fallback is consistent
                }}>Engineered.</span>
                <span style={{ display: 'block', color: '#8696a0', fontSize: '0.55em', fontWeight: 500, letterSpacing: '-0.025em', marginTop: '12px' }}>High-performance real-time chat architecture.</span>
              </h1>

              {/* Sub */}
              <p style={{ margin: 0, color: '#8696a0', fontSize: '1.2rem', lineHeight: 1.6, maxWidth: '560px' }}>
                A production-ready communication suite featuring <strong style={{ color: '#fff' }}>Signal Protocol E2EE</strong>,
                STOMP WebSocket velocity, and a modern media editor—all built with React & Spring Boot.
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                <button
                  onClick={onOpenChat}
                  style={{
                    padding: '16px 36px',
                    background: 'linear-gradient(135deg,#00a884,#00c99e)',
                    border: 'none', borderRadius: '16px', color: '#fff',
                    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 8px 32px rgba(0,168,132,0.4)',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,168,132,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,168,132,0.4)' }}
                >
                  🚀 Get Started
                </button>
                <a
                  href="https://devsantanu.xyz/"
                  target="_blank"
                  style={{
                    padding: '16px 36px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px', color: '#fff',
                    fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#00d4a3' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  About the Dev →
                </a>
              </div>
            </div>

            {/* Right: Premium Mockup */}
            <div id="preview" style={{
              position: 'relative',
              animation: 'float 6s ease-in-out infinite',
            }}>
              {/* Decorative elements */}
              <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(0,168,132,0.15) 0%, transparent 70%)', zIndex: -1 }} />

              <div style={{
                background: 'rgba(11,20,26,0.85)',
                backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '32px',
                overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
              }}>
                {/* Mock header */}
                <div style={{ background: 'rgba(32,44,51,0.5)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg,#00a884,#00c99e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>👩‍💻</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Alice (Signal 🔐)</div>
                    <div style={{ fontSize: '0.78rem', color: '#00d4a3' }}>Verified Session</div>
                  </div>
                </div>

                {/* Mock messages */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {MESSAGES.map((m, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.own ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '85%', padding: '12px 18px', borderRadius: m.own ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                        background: m.own ? 'linear-gradient(135deg, #005c4b, #00735e)' : '#202c33',
                        fontSize: '0.92rem', lineHeight: 1.5, color: '#fff',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}>
                        {m.text}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#667781', marginTop: '6px', fontWeight: 600 }}>{m.time} {m.own ? '✓✓' : ''}</span>
                    </div>
                  ))}
                </div>

                {/* Mock composer */}
                <div style={{ background: 'rgba(32,44,51,0.5)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, background: '#2a3942', borderRadius: '14px', padding: '12px 18px', fontSize: '0.9rem', color: '#8696a0', border: '1px solid transparent' }}>Encrypted message…</div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✈️</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FEATURES GRID ━━━ */}
        <section id="features" style={{ padding: '120px 48px', backgroundColor: 'rgba(4,12,18,0.5)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '80px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00d4a3', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Showcase</span>
              <h2 style={{ margin: '16px 0 0', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff' }}>
                Engineered for <span style={{ color: '#00d4a3' }}>Excellence.</span>
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '40px', borderRadius: '24px',
                    background: 'rgba(11,20,26,0.4)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                    position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(-8px)'
                    el.style.borderColor = 'rgba(0,168,132,0.4)'
                    el.style.background = 'rgba(11,20,26,0.7)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(0)'
                    el.style.borderColor = 'rgba(255,255,255,0.05)'
                    el.style.background = 'rgba(11,20,26,0.4)'
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '24px' }}>{f.icon}</div>
                  <h3 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{f.title}</h3>
                  <p style={{ margin: '0 0 20px', fontSize: '0.95rem', color: '#8696a0', lineHeight: 1.7 }}>{f.desc}</p>
                  <div style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: '8px',
                    background: 'rgba(0,168,132,0.1)', border: '1px solid rgba(0,168,132,0.2)',
                    fontSize: '0.7rem', fontWeight: 700, color: '#00d4a3', textTransform: 'uppercase'
                  }}>
                    {f.tech}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ MEET THE ARCHITECT ━━━ */}
        <section id="architect" style={{ padding: '120px 48px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(11,20,26,0.95), rgba(4,12,18,1))',
              border: '1px solid rgba(0,168,132,0.25)',
              borderRadius: '48px', padding: '80px',
              display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '80px', alignItems: 'flex-start',
              boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)',
            }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00d4a3', letterSpacing: '0.15em', textTransform: 'uppercase' }}>The Core Dev</span>
                <h2 style={{ margin: '20px 0 24px', fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>Meet Santanu Sau.</h2>
                <div style={{ color: '#8696a0', lineHeight: 1.8, fontSize: '1.15rem' }}>
                  <p style={{ margin: '0 0 24px' }}>
                    I am a <strong>Backend Engineer & Android Developer</strong> with 4 years of experience crafting high-performance, scalable systems. 
                    Currently at Softmint Digital Services Pvt. Ltd., I specialize in Java, Spring Boot, and robust mobile architectures.
                  </p>
                  <p style={{ margin: '0 0 32px' }}>
                    FlyChat is the culmination of my journey into secure, real-time engineering. I am currently expanding my vision into <strong>AI/ML</strong>, 
                    Data Science, and NLP to build the next generation of intelligent communication tools.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  {[
                    { label: 'Portfolio', href: 'https://devsantanu.xyz/', primary: true },
                    { label: 'GitHub', href: 'https://github.com/Program2Builder', primary: false },
                    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/santanu-sau-449334225', primary: false },
                  ].map(btn => (
                    <a
                      key={btn.label}
                      href={btn.href}
                      target="_blank"
                      style={{
                        padding: '14px 28px',
                        background: btn.primary ? '#fff' : 'rgba(255,255,255,0.05)',
                        border: btn.primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '14px',
                        color: btn.primary ? '#040c12' : '#fff',
                        fontSize: '0.95rem', fontWeight: 700,
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        if (!btn.primary) e.currentTarget.style.borderColor = '#00d4a3';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        if (!btn.primary) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      }}
                    >
                      {btn.label}
                    </a>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{
                  padding: '3px',
                  borderRadius: '32px',
                  background: 'linear-gradient(135deg, #00d4a3, #05f0ff)',
                  boxShadow: '0 30px 60px -12px rgba(0,168,132,0.3)',
                }}>
                  <img 
                    src="https://github.com/Program2Builder.png" 
                    style={{ width: '100%', borderRadius: '30px', display: 'block' }} 
                    alt="Santanu Sau" 
                  />
                </div>
                {/* Statistics overlay */}
                <div style={{
                  position: 'absolute', bottom: '-20px', left: '-20px',
                  background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
                  padding: '20px 32px', borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>4+ Years</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00d4a3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scaling Systems</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FOOTER ━━━ */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '60px 48px', backgroundColor: '#020609' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✈️</div>
                <span style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>FlyChat</span>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#404040' }}>© 2026 Crafted with Passion by <a href="https://devsantanu.xyz/" target="_blank" style={{ color: '#00d4a3', textDecoration: 'none', fontWeight: 600 }}>Santanu Sau</a></span>
            </div>

            <div style={{ display: 'flex', gap: '32px' }}>
              {[
                { label: 'Portfolio', href: 'https://devsantanu.xyz/' },
                { label: 'GitHub', href: 'https://github.com/Program2Builder' },
                { label: 'LinkedIn', href: 'https://www.linkedin.com/in/santanu-sau-449334225' },
              ].map(item => (
                <a key={item.label} href={item.href} target="_blank" style={{ fontSize: '0.85rem', color: '#8696a0', textDecoration: 'none', fontWeight: 500 }}>{item.label}</a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

