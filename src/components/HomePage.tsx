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
          const dx = mouse.x - o.x, dy = mouse.y - o.y, d = Math.sqrt(dx*dx+dy*dy)
          if (d < AR && d > 1) { const s = AF*(1-d/AR); o.vx += (dx/d)*s*o.r*0.01; o.vy += (dy/d)*s*o.r*0.01 }
          else { o.vx += (o.bvx-o.vx)*0.02; o.vy += (o.bvy-o.vy)*0.02 }
        } else { o.vx += (o.bvx-o.vx)*0.02; o.vy += (o.bvy-o.vy)*0.02 }
        const sp = Math.sqrt(o.vx*o.vx+o.vy*o.vy)
        if (sp > 3) { o.vx=(o.vx/sp)*3; o.vy=(o.vy/sp)*3 }
        o.vx*=DAMP; o.vy*=DAMP; o.x+=o.vx; o.y+=o.vy
        if (o.x < -o.r) o.x=W+o.r; if (o.x > W+o.r) o.x=-o.r
        if (o.y < -o.r) o.y=H+o.r; if (o.y > H+o.r) o.y=-o.r
        const g = ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r)
        g.addColorStop(0,`hsla(${o.h},78%,52%,${o.a})`); g.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill()
      })

      const NR = 90, NF = 1.6, MAX_D = 120
      nodes.forEach(n => {
        if (mouse.active) {
          const dx=n.x-mouse.x, dy=n.y-mouse.y, d=Math.sqrt(dx*dx+dy*dy)
          if (d<NR&&d>1) { const p=(1-d/NR)*NF; n.vx+=(dx/d)*p; n.vy+=(dy/d)*p }
        }
        const ps=Math.sqrt(n.vx*n.vx+n.vy*n.vy)
        if (ps>2.8) { n.vx=(n.vx/ps)*2.8; n.vy=(n.vy/ps)*2.8 }
        n.vx*=0.97; n.vy*=0.97; n.x+=n.vx; n.y+=n.vy
        if (n.x<0||n.x>W) n.vx*=-1; if (n.y<0||n.y>H) n.vy*=-1
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fillStyle='rgba(0,168,132,0.5)'; ctx.fill()
      })
      for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++) {
        const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y, d=Math.sqrt(dx*dx+dy*dy)
        if (d<MAX_D) { ctx.beginPath(); ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.strokeStyle=`rgba(0,168,132,${0.15*(1-d/MAX_D)})`; ctx.lineWidth=1; ctx.stroke() }
      }

      if (mouse.active) {
        const aura = ctx.createRadialGradient(mouse.x,mouse.y,0,mouse.x,mouse.y,55)
        aura.addColorStop(0,'rgba(0,168,132,0.14)'); aura.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(mouse.x,mouse.y,55,0,Math.PI*2); ctx.fillStyle=aura; ctx.fill()
        ripR+=1.3; ripA=Math.max(0,0.35*(1-ripR/75))
        if (ripR>75) { ripR=0; ripA=0.35 }
        ctx.beginPath(); ctx.arc(mouse.x,mouse.y,ripR,0,Math.PI*2); ctx.strokeStyle=`rgba(0,212,163,${ripA})`; ctx.lineWidth=1.4; ctx.stroke()
        ctx.beginPath(); ctx.arc(mouse.x,mouse.y,3,0,Math.PI*2); ctx.fillStyle='rgba(0,212,163,0.85)'; ctx.fill()
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
  { icon: '⚡', title: 'Real-time Messaging', desc: 'STOMP over SockJS powered WebSocket — messages arrive instantly without polling.' },
  { icon: '🔐', title: 'End-to-End Encrypted', desc: 'Signal Protocol (X3DH + Double Ratchet) encrypts every message before it leaves your device.' },
  { icon: '👥', title: 'Groups & Contacts', desc: 'Create groups, manage your contact list, and control who can see your presence.' },
  { icon: '📎', title: 'Media Uploads', desc: 'Share images and files seamlessly — previewed inline with authenticated access control.' },
  { icon: '⌨️', title: 'Typing Indicators', desc: 'Live "…typing" signals so conversations feel as natural as being in the same room.' },
  { icon: '🔗', title: 'Spring Boot Backend', desc: 'Drop-in frontend — point it at your existing Spring Boot REST + WebSocket API and go.' },
]

/* ─── Fake conversation preview ─── */
const MESSAGES = [
  { own: false, name: 'Alice', text: 'Hey! Did you see the new E2EE is live? 🔐', time: '09:41' },
  { own: true,  name: 'You',   text: 'Yes! Signal Protocol — couldn\'t be safer 🚀', time: '09:42' },
  { own: false, name: 'Alice', text: 'Love how fast the typing indicators are too ⌨️', time: '09:42' },
  { own: true,  name: 'You',   text: 'Real-time STOMP magic ✨', time: '09:43' },
]

export function HomePage({ onOpenChat }: HomePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useCanvasBg(canvasRef)

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#e9edef', overflowX: 'hidden' }}>

      {/* ── Canvas background ── */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />

      {/* ── Grid overlay ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,168,132,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,168,132,0.035) 1px,transparent 1px)',
        backgroundSize: '64px 64px',
      }} />

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ━━━ NAV ━━━ */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', height: '64px',
          background: 'rgba(4,12,18,0.65)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,168,132,0.12)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#00a884,#00d4a3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(0,168,132,0.4)', fontSize: '18px',
            }}>✈️</div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, background: 'linear-gradient(90deg,#00d4a3,#00a884)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FlyChat</span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            {['Features', 'Preview', 'Tech'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} style={{
                color: '#8696a0', fontSize: '0.88rem', fontWeight: 500, textDecoration: 'none',
                transition: 'color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00d4a3')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8696a0')}
              >{l}</a>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onOpenChat}
            style={{
              padding: '9px 22px',
              background: 'linear-gradient(135deg,#00a884,#00c99e)',
              border: 'none', borderRadius: '10px', color: '#fff',
              fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(0,168,132,0.3)',
              transition: 'transform 0.18s, box-shadow 0.18s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,168,132,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,168,132,0.3)' }}
          >
            Sign In →
          </button>
        </nav>

        {/* ━━━ HERO ━━━ */}
        <section style={{
          minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center',
          padding: '80px 48px',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 480px', gap: '64px', alignItems: 'center' }}>

            {/* Left: copy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                <span style={{
                  padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                  background: 'rgba(0,168,132,0.12)', border: '1px solid rgba(0,168,132,0.3)',
                  color: '#00d4a3', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>✨ Now with Signal E2EE</span>
              </div>

              {/* Headline */}
              <h1 style={{
                margin: 0, lineHeight: 1.05,
                fontSize: 'clamp(2.8rem, 5.5vw, 5rem)',
                fontWeight: 900, letterSpacing: '-0.04em',
              }}>
                <span style={{ display: 'block', color: '#e9edef' }}>WhatsApp-style</span>
                <span style={{
                  display: 'block',
                  background: 'linear-gradient(90deg, #00d4a3 0%, #00a884 50%, #4fc3f7 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>real-time chat</span>
                <span style={{ display: 'block', color: '#8696a0', fontSize: '0.6em', fontWeight: 500, letterSpacing: '-0.02em', marginTop: '8px' }}>for your Spring Boot backend.</span>
              </h1>

              {/* Sub */}
              <p style={{ margin: 0, color: '#8696a0', fontSize: '1.1rem', lineHeight: 1.7, maxWidth: '520px' }}>
                Drop in a production-ready chat frontend — groups, contacts, typing indicators,
                media uploads, and <strong style={{ color: '#00d4a3' }}>end-to-end encryption</strong> — all wired to your existing API.
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button
                  onClick={onOpenChat}
                  style={{
                    padding: '15px 32px',
                    background: 'linear-gradient(135deg,#00a884,#00c99e)',
                    border: 'none', borderRadius: '14px', color: '#fff',
                    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 6px 28px rgba(0,168,132,0.4)',
                    transition: 'transform 0.18s, box-shadow 0.18s',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,168,132,0.55)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,168,132,0.4)' }}
                >
                  ✈️ Launch Chat
                </button>
                <a
                  href="#features"
                  style={{
                    padding: '15px 32px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '14px', color: '#e9edef',
                    fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(0,168,132,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                >
                  Explore Features ↓
                </a>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '36px', marginTop: '12px', flexWrap: 'wrap' }}>
                {[['🔐', 'Signal E2EE'], ['⚡', 'Real-time'], ['📎', 'Media uploads'], ['👥', 'Group chats']].map(([icon, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    <span style={{ fontSize: '0.82rem', color: '#8696a0', fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: chat preview mockup */}
            <div id="preview" style={{
              background: 'rgba(11,20,26,0.7)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,168,132,0.18)',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            }}>
              {/* Mock header */}
              <div style={{ background: '#202c33', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#00a884,#00c99e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👩</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e9edef' }}>Alice</div>
                  <div style={{ fontSize: '0.75rem', color: '#00a884' }}>● online</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'rgba(0,168,132,0.15)', border: '1px solid rgba(0,168,132,0.3)', borderRadius: '10px', color: '#00d4a3' }}>🔒 E2EE</span>
                </div>
              </div>

              {/* Mock messages */}
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'linear-gradient(180deg,rgba(11,20,26,0.9),rgba(7,15,24,0.95))' }}>
                {MESSAGES.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.own ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px', borderRadius: m.own ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: m.own ? '#005c4b' : '#202c33',
                      fontSize: '0.88rem', lineHeight: 1.5, color: '#e9edef',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}>
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#8696a0', marginTop: '3px', paddingRight: m.own ? '2px' : 0, paddingLeft: m.own ? 0 : '2px' }}>{m.time} {m.own ? '✓✓' : ''}</span>
                  </div>
                ))}

                {/* Typing indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ padding: '8px 14px', background: '#202c33', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0, 150, 300].map(delay => (
                      <span key={delay} style={{
                        width: '6px', height: '6px', borderRadius: '50%', background: '#8696a0',
                        display: 'inline-block',
                        animation: `hp-bounce 1.2s ${delay}ms ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#8696a0' }}>Alice is typing…</span>
                </div>
              </div>

              {/* Mock composer */}
              <div style={{ background: '#202c33', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, background: '#2a3942', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem', color: '#8696a0' }}>Type a message…</div>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#00a884,#00c99e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', cursor: 'default' }}>✈️</div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FEATURES ━━━ */}
        <section id="features" style={{ padding: '100px 48px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Section header */}
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4a3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>What's inside</span>
              <h2 style={{ margin: '12px 0 0', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#e9edef' }}>
                Everything you need,<br />
                <span style={{ background: 'linear-gradient(90deg,#00d4a3,#4fc3f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>nothing you don't.</span>
              </h2>
            </div>

            {/* Feature grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '28px', borderRadius: '20px',
                    background: 'rgba(11,20,26,0.65)',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    transition: 'transform 0.22s, border-color 0.22s, box-shadow 0.22s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(-6px)'
                    el.style.borderColor = 'rgba(0,168,132,0.35)'
                    el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.4), 0 0 30px rgba(0,168,132,0.08)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(0)'
                    el.style.borderColor = 'rgba(255,255,255,0.07)'
                    el.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '16px' }}>{f.icon}</div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 700, color: '#e9edef' }}>{f.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#8696a0', lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ TECH STACK ━━━ */}
        <section id="tech" style={{ padding: '80px 48px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
              background: 'rgba(11,20,26,0.7)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,168,132,0.15)',
              borderRadius: '28px', padding: '56px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '56px', alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4a3', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tech stack</span>
                <h2 style={{ margin: '12px 0 18px', fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#e9edef' }}>Built on rock-solid<br />open standards.</h2>
                <p style={{ color: '#8696a0', lineHeight: 1.7, fontSize: '0.95rem', margin: '0 0 28px' }}>
                  No proprietary lock-in. FlyChat speaks standard STOMP over SockJS, REST for auth and media,
                  and the Signal protocol for cryptography — all of which your Spring backend already supports.
                </p>
                <button
                  onClick={onOpenChat}
                  style={{
                    padding: '13px 28px',
                    background: 'linear-gradient(135deg,#00a884,#00c99e)',
                    border: 'none', borderRadius: '12px',
                    color: '#fff', fontSize: '0.95rem', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 20px rgba(0,168,132,0.35)',
                    transition: 'transform 0.18s, box-shadow 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,168,132,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,168,132,0.35)' }}
                >
                  ✈️ Open FlyChat
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  ['⚛️', 'React 18', 'Vite + TypeScript'],
                  ['🎨', 'MUI v5', 'Component library'],
                  ['🔌', 'STOMP / SockJS', 'WebSocket layer'],
                  ['🔐', 'libsignal', 'X3DH + Double Ratchet'],
                  ['🍃', 'Spring Boot', 'Backend API'],
                  ['🗄️', 'IndexedDB', 'Key storage'],
                ].map(([icon, name, desc]) => (
                  <div key={name} style={{
                    padding: '18px', borderRadius: '16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    transition: 'border-color 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,168,132,0.3)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#e9edef' }}>{name}</div>
                    <div style={{ fontSize: '0.76rem', color: '#8696a0', marginTop: '3px' }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ FOOTER CTA ━━━ */}
        <section style={{ padding: '80px 48px 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>✈️</div>
            <h2 style={{ margin: '0 0 16px', fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#e9edef' }}>
              Ready to fly?
            </h2>
            <p style={{ margin: '0 0 36px', color: '#8696a0', fontSize: '1rem', lineHeight: 1.7 }}>
              Sign in and start chatting — your contacts, groups, and encrypted message history are waiting.
            </p>
            <button
              onClick={onOpenChat}
              style={{
                padding: '16px 40px',
                background: 'linear-gradient(135deg,#00a884,#00c99e)',
                border: 'none', borderRadius: '16px', color: '#fff',
                fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 40px rgba(0,168,132,0.45)',
                transition: 'transform 0.18s, box-shadow 0.18s',
                fontFamily: 'inherit', letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 56px rgba(0,168,132,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,168,132,0.45)' }}
            >
              ✈️ Sign In to FlyChat
            </button>
          </div>
        </section>

        {/* ━━━ FOOTER ━━━ */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '0.82rem', color: '#404040' }}>© 2026 FlyChat — Spring Boot E2EE Chat</span>
          <div style={{ display: 'flex', gap: '20px' }}>
            {['Home: /', 'Login: /login', 'Chat: /chat'].map(r => (
              <span key={r} style={{ fontSize: '0.75rem', color: '#404040', fontFamily: 'monospace' }}>{r}</span>
            ))}
          </div>
        </footer>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes hp-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
