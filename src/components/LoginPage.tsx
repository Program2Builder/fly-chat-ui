import { useEffect, useRef, useState } from 'react'
import { useChat } from '../context/ChatContext'

interface LoginPageProps {
  onLoginSuccess: () => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const chat = useChat()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const disabled =
    chat.isBootstrapping ||
    chat.status === 'connecting' ||
    !username.trim() ||
    !password.trim()

  /* ───── Animated background with cursor interaction ───── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let W = 0
    let H = 0

    // Mouse position (use center as default until first move)
    const mouse = { x: -9999, y: -9999, active: false }

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
    }
    const onMouseLeave = () => { mouse.active = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    interface Orb {
      x: number; y: number; r: number
      vx: number; vy: number
      h: number; a: number
      // base idle velocity
      bvx: number; bvy: number
    }

    const orbs: Orb[] = []
    const ORB_COUNT = 18

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < ORB_COUNT; i++) {
      const bvx = (Math.random() - 0.5) * 0.35
      const bvy = (Math.random() - 0.5) * 0.35
      orbs.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 120 + Math.random() * 220,
        vx: bvx,
        vy: bvy,
        bvx, bvy,
        h: Math.random() * 360,
        a: 0.05 + Math.random() * 0.12,
      })
    }

    /* Particle nodes */
    interface Node {
      x: number; y: number
      vx: number; vy: number
      r: number
    }
    const NODE_COUNT = 80
    const nodes: Node[] = []
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.5 + Math.random() * 2,
      })
    }

    /* Ripple pulse on the cursor */
    let rippleAlpha = 0
    let rippleR = 0
    const RIPPLE_MAX = 80

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      /* Deep background */
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#050d14')
      bg.addColorStop(1, '#08111a')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      /* ── Orbs with cursor attraction ── */
      const ORB_ATTRACT_RADIUS = 380   // orbs inside this range feel the pull
      const ORB_ATTRACT_FORCE  = 0.018 // spring strength toward cursor
      const ORB_DAMPING        = 0.97  // velocity damping (< 1 prevents runaway)

      orbs.forEach((o) => {
        if (mouse.active) {
          const dx = mouse.x - o.x
          const dy = mouse.y - o.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < ORB_ATTRACT_RADIUS && dist > 1) {
            // Attraction — force grows stronger when closer (up to a cap)
            const strength = ORB_ATTRACT_FORCE * (1 - dist / ORB_ATTRACT_RADIUS)
            o.vx += (dx / dist) * strength * o.r * 0.012
            o.vy += (dy / dist) * strength * o.r * 0.012
          } else {
            // Outside range — drift back toward idle velocity
            o.vx += (o.bvx - o.vx) * 0.02
            o.vy += (o.bvy - o.vy) * 0.02
          }
        } else {
          // No cursor — gentle return to idle
          o.vx += (o.bvx - o.vx) * 0.02
          o.vy += (o.bvy - o.vy) * 0.02
        }

        // Clamp speed so orbs don't fly off screen
        const MAX_SPEED = 3.5
        const speed = Math.sqrt(o.vx * o.vx + o.vy * o.vy)
        if (speed > MAX_SPEED) {
          o.vx = (o.vx / speed) * MAX_SPEED
          o.vy = (o.vy / speed) * MAX_SPEED
        }

        o.vx *= ORB_DAMPING
        o.vy *= ORB_DAMPING

        o.x += o.vx
        o.y += o.vy

        // Wrap around edges
        if (o.x < -o.r) o.x = W + o.r
        if (o.x > W + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = H + o.r
        if (o.y > H + o.r) o.y = -o.r

        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, `hsla(${o.h},80%,55%,${o.a})`)
        g.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      })

      /* ── Particles – repelled by cursor ── */
      const NODE_REPEL_RADIUS = 100
      const NODE_REPEL_FORCE  = 1.8
      const MAX_DIST = 130

      nodes.forEach((n) => {
        if (mouse.active) {
          const dx = n.x - mouse.x
          const dy = n.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < NODE_REPEL_RADIUS && dist > 1) {
            const push = (1 - dist / NODE_REPEL_RADIUS) * NODE_REPEL_FORCE
            n.vx += (dx / dist) * push
            n.vy += (dy / dist) * push
          }
        }

        // Speed cap for particles
        const PMAX = 3
        const pspeed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (pspeed > PMAX) { n.vx = (n.vx / pspeed) * PMAX; n.vy = (n.vy / pspeed) * PMAX }

        n.vx *= 0.97
        n.vy *= 0.97

        n.x += n.vx
        n.y += n.vy

        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,168,132,0.55)'
        ctx.fill()
      })

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DIST) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(0,168,132,${0.18 * (1 - dist / MAX_DIST)})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      /* ── Cursor aura & ripple ── */
      if (mouse.active) {
        // Soft glow around cursor
        const aura = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 60)
        aura.addColorStop(0, 'rgba(0,168,132,0.18)')
        aura.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 60, 0, Math.PI * 2)
        ctx.fillStyle = aura
        ctx.fill()

        // Expanding ripple ring
        rippleR += 1.4
        rippleAlpha = Math.max(0, 0.4 * (1 - rippleR / RIPPLE_MAX))
        if (rippleR > RIPPLE_MAX) { rippleR = 0; rippleAlpha = 0.4 }

        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, rippleR, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,212,163,${rippleAlpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Crosshair dot
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,212,163,0.9)'
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  /* Redirect after auth */
  useEffect(() => {
    if (chat.isAuthenticated && !chat.isBootstrapping) {
      onLoginSuccess()
    }
  }, [chat.isAuthenticated, chat.isBootstrapping, onLoginSuccess])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!disabled) void chat.login(username, password)
  }

  const error = chat.errors[0]?.message

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Animated canvas background */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,168,132,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,168,132,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Center card */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(11,20,26,0.72)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(0,168,132,0.22)',
          borderRadius: '24px',
          padding: '40px 36px',
          boxShadow: '0 8px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
          boxSizing: 'border-box',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', gap: '12px' }}>
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00a884 0%, #00d4a3 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 32px rgba(0,168,132,0.4), 0 4px 16px rgba(0,0,0,0.4)',
              fontSize: '28px',
            }}>
              ✈️
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                margin: 0,
                fontSize: '1.6rem',
                fontWeight: 800,
                background: 'linear-gradient(90deg, #00d4a3, #00a884)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.03em',
              }}>
                FlyChat
              </h1>
              <p style={{ margin: '6px 0 0', color: '#8696a0', fontSize: '0.88rem' }}>
                Sign in to your secure workspace
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Username field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#adbac7', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: '#8696a0', fontSize: '16px', pointerEvents: 'none',
                }}>
                  👤
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  style={{
                    width: '100%',
                    padding: '13px 14px 13px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#e9edef',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#00a884'
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,168,132,0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#adbac7', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: '#8696a0', fontSize: '16px', pointerEvents: 'none',
                }}>
                  🔒
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '13px 14px 13px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#e9edef',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#00a884'
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,168,132,0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(211,47,47,0.12)',
                border: '1px solid rgba(211,47,47,0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#ef9a9a',
                fontSize: '0.87rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={disabled}
              style={{
                marginTop: '4px',
                padding: '14px',
                background: disabled
                  ? 'rgba(0,168,132,0.3)'
                  : 'linear-gradient(135deg, #00a884 0%, #00c99e 100%)',
                border: 'none',
                borderRadius: '12px',
                color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'transform 0.18s, box-shadow 0.18s, background 0.2s',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                boxShadow: disabled ? 'none' : '0 4px 24px rgba(0,168,132,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(0,168,132,0.5)'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = disabled ? 'none' : '0 4px 24px rgba(0,168,132,0.35)'
              }}
            >
              {chat.isBootstrapping || chat.status === 'connecting' ? (
                <>
                  <span style={{
                    width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'lp-spin 0.7s linear infinite',
                  }} />
                  Signing in…
                </>
              ) : (
                <>✈️ Start Chat</>
              )}
            </button>
          </form>

          {/* Footer badges */}
          <div style={{
            marginTop: '28px',
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            {['🔐 E2E Encrypted', '⚡ Real-time', '🌐 STOMP/WebSocket'].map((label) => (
              <span key={label} style={{
                fontSize: '0.75rem',
                color: '#8696a0',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px',
                padding: '4px 10px',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Spinner keyframe injected inline */}
      <style>{`
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
