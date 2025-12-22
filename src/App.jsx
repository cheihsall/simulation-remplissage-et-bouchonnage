import React, { useEffect, useState, useRef } from 'react'

// Simulateur 3D de remplissage et bouchonnage de bouteilles d'eau avec intégration Way2tech.ai

function parseParams() {
  const p = new URLSearchParams(window.location.search)
  const keys = ['session_id','learner_id','resource_id','api_key','callback_url']
  const out = {}
  keys.forEach(k => out[k] = p.get(k))
  out.mode = p.get('mode') || 'learning'
  return out
}

function nowISO() { return new Date().toISOString() }

async function sendWithRetry(url, payload, apiKey, maxAttempts = 3) {
  let attempt = 0
  let lastErr = null
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      attempt += 1
      const delay = Math.pow(2, attempt) * 500
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// Composant 3D de la ligne d'embouteillage utilisant Canvas
function BottlingLine3D({ waterLevel, progress, running, conveyorSpeed, bottlesFilled, waitingForFilling, waitingForCapping }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const conveyorPosRef = useRef(0)
  const bottleAnimRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Initialiser les bouteilles sur le convoyeur
    if (bottleAnimRef.current.length === 0) {
      for (let i = 0; i < 5; i++) {
        bottleAnimRef.current.push({
          x: -100 - i * 150,
          filled: false,
          capped: false,
          fillLevel: 0
        })
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)
      
      // Fond avec gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
      bgGrad.addColorStop(0, '#0f172a')
      bgGrad.addColorStop(1, '#1e293b')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(width/2, height/2)
      
      // Convoyeur (bande transporteuse)
      ctx.fillStyle = '#374151'
      ctx.fillRect(-300, 80, 600, 40)
      
      // Lignes du convoyeur pour effet de mouvement
      ctx.strokeStyle = '#4b5563'
      ctx.lineWidth = 2
      for (let i = 0; i < 15; i++) {
        const lineX = -300 + ((i * 40 + conveyorPosRef.current) % 600)
        ctx.beginPath()
        ctx.moveTo(lineX, 80)
        ctx.lineTo(lineX + 20, 120)
        ctx.stroke()
      }

      // Structure de support
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-320, 120, 20, 60)
      ctx.fillRect(300, 120, 20, 60)

      // Station de remplissage (à gauche)
      ctx.fillStyle = '#475569'
      ctx.fillRect(-200, -100, 80, 100)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 3
      ctx.strokeRect(-200, -100, 80, 100)
      
      // Réservoir d'eau
      const tankGrad = ctx.createLinearGradient(-180, -140, -180, -100)
      tankGrad.addColorStop(0, '#3b82f6')
      tankGrad.addColorStop(1, '#1d4ed8')
      ctx.fillStyle = tankGrad
      ctx.fillRect(-180, -140, 40, 40)
      ctx.strokeStyle = '#1e40af'
      ctx.lineWidth = 2
      ctx.strokeRect(-180, -140, 40, 40)

      // Bec de remplissage
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(-165, -100, 10, 40)
      
      // Effet d'eau qui coule (si en cours de remplissage)
      if (waitingForFilling && waterLevel < 100) {
        const waterStream = ctx.createLinearGradient(-160, -60, -160, 20)
        waterStream.addColorStop(0, 'rgba(59, 130, 246, 0.8)')
        waterStream.addColorStop(1, 'rgba(59, 130, 246, 0.3)')
        ctx.fillStyle = waterStream
        ctx.fillRect(-163, -60, 6, 80)
        
        // Gouttes d'eau animées
        for (let i = 0; i < 3; i++) {
          const dropY = -60 + (conveyorPosRef.current * 2 + i * 30) % 80
          ctx.beginPath()
          ctx.arc(-160, dropY, 3, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(96, 165, 250, 0.6)'
          ctx.fill()
        }
      }

      // Station de bouchonnage (à droite)
      ctx.fillStyle = '#475569'
      ctx.fillRect(120, -80, 80, 80)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 3
      ctx.strokeRect(120, -80, 80, 80)
      
      // Bras de bouchonnage
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(155, -80, 10, 50)
      
      // Distributeur de bouchons
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(145, -30, 30, 10)

      // Déplacer et dessiner les bouteilles
      if (running) {
        conveyorPosRef.current += conveyorSpeed
        
        bottleAnimRef.current.forEach(bottle => {
          bottle.x += conveyorSpeed
          
          // Remplissage quand sous le bec
          if (bottle.x > -180 && bottle.x < -140 && !bottle.filled) {
            bottle.fillLevel = Math.min(100, bottle.fillLevel + 2)
            if (bottle.fillLevel >= 100) {
              bottle.filled = true
            }
          }
          
          // Bouchonnage quand sous la station
          if (bottle.x > 140 && bottle.x < 180 && bottle.filled && !bottle.capped) {
            bottle.capped = true
          }
          
          // Réinitialiser les bouteilles qui sortent
          if (bottle.x > 350) {
            bottle.x = -100
            bottle.filled = false
            bottle.capped = false
            bottle.fillLevel = 0
          }
        })
      }

      // Dessiner les bouteilles
      bottleAnimRef.current.forEach(bottle => {
        if (bottle.x > -320 && bottle.x < 320) {
          drawBottle(ctx, bottle.x, 60, bottle.fillLevel, bottle.capped)
        }
      })

      // Panneau de contrôle
      const panelY = 140
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-100, panelY, 200, 50)
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 2
      ctx.strokeRect(-100, panelY, 200, 50)
      
      // Voyant d'état
      ctx.beginPath()
      ctx.arc(-70, panelY + 25, 8, 0, Math.PI * 2)
      ctx.fillStyle = running ? '#10b981' : '#6b7280'
      ctx.fill()
      if (running) {
        ctx.shadowColor = '#10b981'
        ctx.shadowBlur = 15
        ctx.fill()
        ctx.shadowBlur = 0
      }
      
      // Compteur de bouteilles
      ctx.fillStyle = '#000'
      ctx.fillRect(-20, panelY + 10, 80, 30)
      ctx.fillStyle = '#00ff00'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${bottlesFilled} BTL`, 20, panelY + 30)

      ctx.restore()
    }

    function drawBottle(ctx, x, y, fillLevel, capped) {
      // Corps de la bouteille
      const bottleGrad = ctx.createLinearGradient(x - 15, y - 40, x + 15, y)
      bottleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)')
      bottleGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)')
      bottleGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)')
      ctx.fillStyle = bottleGrad
      
      ctx.beginPath()
      ctx.moveTo(x - 12, y)
      ctx.lineTo(x - 12, y - 30)
      ctx.lineTo(x - 8, y - 35)
      ctx.lineTo(x - 8, y - 42)
      ctx.lineTo(x + 8, y - 42)
      ctx.lineTo(x + 8, y - 35)
      ctx.lineTo(x + 12, y - 30)
      ctx.lineTo(x + 12, y)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Eau dans la bouteille
      if (fillLevel > 0) {
        const waterHeight = (fillLevel / 100) * 30
        const waterGrad = ctx.createLinearGradient(x, y, x, y - waterHeight)
        waterGrad.addColorStop(0, '#3b82f6')
        waterGrad.addColorStop(1, '#60a5fa')
        ctx.fillStyle = waterGrad
        
        ctx.beginPath()
        ctx.moveTo(x - 11, y)
        ctx.lineTo(x - 11, y - waterHeight)
        ctx.lineTo(x + 11, y - waterHeight)
        ctx.lineTo(x + 11, y)
        ctx.closePath()
        ctx.fill()
        
        // Reflets sur l'eau
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.fillRect(x - 10, y - waterHeight + 2, 4, waterHeight - 4)
      }

      // Bouchon
      if (capped) {
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(x - 8, y - 45, 16, 5)
        ctx.strokeStyle = '#991b1b'
        ctx.lineWidth = 1
        ctx.strokeRect(x - 8, y - 45, 16, 5)
      }
    }

    function animate() {
      draw()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [waterLevel, running, conveyorSpeed, bottlesFilled, waitingForFilling, waitingForCapping])

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={400}
      className="w-full rounded-lg shadow-2xl"
    />
  )
}

export default function App() {
  const params = parseParams()
  const [sessionParams] = useState(params)
  const [message, setMessage] = useState('')
  const [stage, setStage] = useState('idle') // idle, filling, capping, finished

  // État de la simulation
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [targetBottles, setTargetBottles] = useState(50)
  const [waterLevel, setWaterLevel] = useState(0)
  const [bottlesFilled, setBottlesFilled] = useState(0)
  const [conveyorSpeed, setConveyorSpeed] = useState(2)
  const [fillRate, setFillRate] = useState(5)
  const [events, setEvents] = useState([])
  const [currentBottleReady, setCurrentBottleReady] = useState(true)
  const [waitingForFilling, setWaitingForFilling] = useState(false)
  const [waitingForCapping, setWaitingForCapping] = useState(false)
  const intervalRef = useRef(null)
  const startedAtRef = useRef(null)

  const hasValidParams = sessionParams.session_id && sessionParams.api_key && sessionParams.callback_url

  useEffect(() => {
    if (running) {
      startedAtRef.current = new Date()
      setEvents(ev => [...ev, { ts: nowISO(), code: 'ACTION.START', label: 'Démarrage de la ligne d\'embouteillage' }])
      intervalRef.current = setInterval(() => {
        setProgress(p => p + 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  // Fonction manuelle de remplissage
  function startFilling() {
    if (!running || !currentBottleReady || waitingForFilling) return
    
    setWaitingForFilling(true)
    setStage('filling')
    setEvents(ev => [...ev, { ts: nowISO(), code: 'ACTION.FILL_START', label: 'Début du remplissage' }])
    
    const fillInterval = setInterval(() => {
      setWaterLevel(w => {
        if (w >= 100) {
          clearInterval(fillInterval)
          setWaitingForFilling(false)
          setWaitingForCapping(true)
          setStage('capping')
          setEvents(ev => [...ev, { ts: nowISO(), code: 'ACTION.FILL_COMPLETE', label: 'Remplissage terminé' }])
          return 100
        }
        return w + fillRate
      })
    }, 100)
  }

  // Fonction manuelle de bouchonnage
  function startCapping() {
    if (!running || !waitingForCapping) return
    
    setEvents(ev => [...ev, { ts: nowISO(), code: 'ACTION.CAP_START', label: 'Bouchonnage en cours' }])
    
    setTimeout(() => {
      setBottlesFilled(b => {
        const newCount = b + 1
        if (newCount >= targetBottles) {
          setRunning(false)
          setStage('finished')
        }
        
        if (newCount % 10 === 0) {
          setEvents(ev => [...ev, { 
            ts: nowISO(), 
            code: 'EVENT.MILESTONE', 
            label: `${newCount} bouteilles remplies`,
            meta: { count: newCount }
          }])
        }
        
        return newCount
      })
      
      setWaterLevel(0)
      setWaitingForCapping(false)
      setCurrentBottleReady(true)
      setStage('idle')
      setEvents(ev => [...ev, { ts: nowISO(), code: 'ACTION.CAP_COMPLETE', label: 'Bouteille terminée' }])
    }, 1000)
  }

  function start() {
    if (!hasValidParams) {
      setMessage('⚠️ Mode démo: Les paramètres ne seront pas envoyés (paramètres manquants)')
    } else {
      setMessage('Simulation démarrée - Les résultats seront envoyés')
    }
    setEvents([])
    setProgress(0)
    setWaterLevel(0)
    setBottlesFilled(0)
    setStage('idle')
    setCurrentBottleReady(true)
    setWaitingForFilling(false)
    setWaitingForCapping(false)
    setRunning(true)
  }

  function stop() {
    setRunning(false)
    setStage('finished')
    setEvents(ev => [...ev, { ts: nowISO(), code: 'ACTION.STOP', label: 'Arrêt manuel de la ligne' }])
  }

  async function finishAndSend() {
    const endedAt = new Date()
    const startedAt = startedAtRef.current || new Date(endedAt.getTime() - progress * 1000)

    const efficiency = Math.min(100, (bottlesFilled / targetBottles) * 100)
    const timeScore = Math.max(0, 100 - (progress / (targetBottles * 2)) * 100)
    const score = Math.round(Math.min(100, (efficiency * 0.7 + timeScore * 0.3)))

    const payload = {
      schema_version: '1.0.0',
      session_id: sessionParams.session_id,
      resource_id: sessionParams.resource_id || 'resource-unknown',
      learner_id: sessionParams.learner_id || 'learner-unknown',
      mode: sessionParams.mode || 'learning',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      summary: {
        score: score,
        status: 'completed',
        grade: score >= 85 ? 'A' : score >= 70 ? 'B' : 'C'
      },
      metrics: [
        { code: 'TIME_TOTAL', label: 'Temps total', value: progress, unit: 's' },
        { code: 'BOTTLES_FILLED', label: 'Bouteilles remplies', value: bottlesFilled, unit: 'btl' },
        { code: 'EFFICIENCY', label: 'Efficacité', value: Math.round(efficiency), unit: '%' }
      ],
      events,
      competencies: [],
      artifacts: [
        { type: 'file', label: 'Session log', url: 'data:application/json;base64,' + btoa(JSON.stringify({ events })) }
      ],
      raw_logs: [`Simulation 3D générée. bottles=${bottlesFilled}`],
      diagnostics: {
        simulator_version: '2.0.0-bottling-3d',
        engine: 'react-canvas-3d',
        user_agent: navigator.userAgent
      }
    }

    // Prefer sending results to the parent window; the parent is responsible for forwarding to the callback URL.
    setMessage('📤 Envoi des résultats au parent...')
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'SIMULATION_RESULTS', payload, meta: { from: 'bottling-simulator' } }, '*')
        setMessage('✓ Résultats envoyés au parent — le parent doit les transférer au callback URL')
        return
      }

      // If there is no parent (running standalone), fallback to sending directly if callback_url is provided.
      if (hasValidParams && sessionParams.callback_url) {
        setMessage('📤 Pas de parent détecté — envoi direct au callback URL...')
        if (!sessionParams.callback_url.startsWith('http://') && !sessionParams.callback_url.startsWith('https://')) {
          throw new Error('callback_url doit être HTTP/HTTPS')
        }
        const res = await sendWithRetry(sessionParams.callback_url, payload, sessionParams.api_key, 3)
        setMessage('✓ Résultats envoyés directement: ' + (res?.message || 'OK'))
        return
      }

      // If neither parent nor callback is available, mark as demo finished.
      setMessage('✓ Simulation terminée (Mode démo - aucune destination de rapport trouvée)')
    } catch (err) {
      console.error(err)
      setMessage('❌ Échec envoi résultats: ' + (err?.message || String(err)))
    }
  }

  useEffect(() => {
    if (!running && progress > 0 && stage === 'finished') {
      finishAndSend()
    }
  }, [running, stage])

  const stageLabels = {
    idle: '⏳ Prêt pour remplissage',
    filling: '💧 Remplissage en cours',
    capping: '✓ Prêt pour bouchonnage',
    finished: '✓ Production terminée'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-slate-800 shadow-2xl rounded-xl p-6 mb-4 border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            💧 Simulateur 3D Ligne d'Embouteillage d'Eau
          </h1>
          <p className="text-slate-300 text-sm mb-4">
            Simulation interactive de remplissage et bouchonnage avec visualisation 3D et intégration Way2tech.ai
          </p>

          {!hasValidParams && (
            <div className="bg-amber-900 bg-opacity-30 border border-amber-600 text-amber-200 p-3 rounded-lg mb-4">
              ⚠️ Mode démo: Paramètres manquants (session_id, api_key, callback_url). La simulation fonctionnera mais aucune donnée ne sera envoyée.
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Gauche: Visualisation 3D */}
            <div className="space-y-4">

              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                <BottlingLine3D 
                  waterLevel={waterLevel}
                  progress={progress}
                  running={running}
                  conveyorSpeed={conveyorSpeed}
                  bottlesFilled={bottlesFilled}
                  waitingForFilling={waitingForFilling}
                  waitingForCapping={waitingForCapping}
                />
              </div>

              {/* Indicateur d'étape */}
              <div className="bg-slate-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">{stageLabels[stage]}</div>
                <div className="text-slate-300">{bottlesFilled} / {targetBottles} bouteilles</div>
                <div className="w-full bg-slate-600 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 h-full transition-all duration-300"
                    style={{ width: `${(bottlesFilled / targetBottles) * 100}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Droite: Contrôles et informations */}
            <div className="space-y-4">
              {/* Contrôles */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">⚙️ ContrOles</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-300 text-sm block mb-1">Nombre de bouteilles cible</label>
                    <input 
                      type="number" 
                      value={targetBottles} 
                      onChange={e => setTargetBottles(Number(e.target.value))} 
                      disabled={running}
                      className="w-full p-2 bg-slate-600 text-white rounded border border-slate-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm block mb-1">Vitesse de remplissage</label>
                    <input 
                      type="range" 
                      min="2" 
                      max="10" 
                      step="1"
                      value={fillRate} 
                      onChange={e => setFillRate(Number(e.target.value))}
                      disabled={running}
                      className="w-full disabled:opacity-50"
                    />
                    <div className="text-xs text-slate-400 text-center">{fillRate} L/s</div>
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm block mb-1">Vitesse du convoyeur</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      step="0.5"
                      value={conveyorSpeed} 
                      onChange={e => setConveyorSpeed(Number(e.target.value))}
                      disabled={running}
                      className="w-full disabled:opacity-50"
                    />
                    <div className="text-xs text-slate-400 text-center">{conveyorSpeed} m/s</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {!running ? (
                      <button 
                        onClick={start} 
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition"
                      >
                        ▶️ Démarrer
                      </button>
                    ) : (
                      <button 
                        onClick={stop} 
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition"
                      >
                        ⏹️ Arrêter
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions manuelles */}
              {running && (
                <div className="bg-slate-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">🖐️ Actions Manuelles</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={startFilling}
                      disabled={!currentBottleReady || waitingForFilling || waitingForCapping}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      💧 Lancer le Remplissage
                      {waitingForFilling && <span className="text-xs">(en cours...)</span>}
                    </button>
                    
                    <button 
                      onClick={startCapping}
                      disabled={!waitingForCapping}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      🔴 Placer le Bouchon
                      {!waitingForCapping && waterLevel === 0 && <span className="text-xs">(remplir d'abord)</span>}
                    </button>

                    <div className="bg-slate-800 p-3 rounded text-sm">
                      <div className="text-slate-400 mb-2">État actuel:</div>
                      <div className="text-white font-semibold">
                        {currentBottleReady && !waitingForFilling && !waitingForCapping && '⏳ Bouteille prête - Cliquez sur "Lancer le Remplissage"'}
                        {waitingForFilling && '💧 Remplissage en cours...'}
                        {waitingForCapping && '✓ Bouteille pleine - Cliquez sur "Placer le Bouchon"'}
                      </div>
                    </div>
                  </div>
                </div>

              )}

              {/* Niveau d'eau */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">💧 Niveau d'Eau</h3>
                
                <div className="w-full bg-slate-600 h-6 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 h-full transition-all duration-300"
                    style={{ width: `${waterLevel}%` }}
                  />
                </div>
                <div className="text-slate-300 text-sm mt-2 text-center">{Math.round(waterLevel)}%</div>

              </div>

              {/* Métriques */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">📊 Métriques</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-600 p-3 rounded">
                    <div className="text-xs text-slate-400">Bouteilles</div>
                    <div className="text-2xl font-bold text-blue-400">{bottlesFilled}</div>
                  </div>
                  <div className="bg-slate-600 p-3 rounded">
                    <div className="text-xs text-slate-400">Progression</div>
                    <div className="text-2xl font-bold text-green-400">{Math.round((bottlesFilled/targetBottles)*100)}%</div>
                  </div>
                  <div className="bg-slate-600 p-3 rounded">
                    <div className="text-xs text-slate-400">Temps écoulé</div>
                    <div className="text-2xl font-bold text-cyan-400">{progress}s</div>
                  </div>
                  <div className="bg-slate-600 p-3 rounded">
                    <div className="text-xs text-slate-400">Niveau eau</div>
                    <div className="text-2xl font-bold text-sky-400">{Math.round(waterLevel)}%</div>
                  </div>
                </div>
              </div>

              {/* Journal d'événements */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">📝 Événements</h3>
                <div className="bg-slate-900 rounded p-3 h-40 overflow-y-auto">
                  {events.length === 0 ? (
                    <div className="text-slate-500 text-sm">Aucun événement</div>
                  ) : (
                    events.slice().reverse().slice(0, 10).map((e, i) => (
                      <div key={i} className="text-xs text-slate-300 mb-1 font-mono">
                        <span className="text-cyan-400">{e.code}</span> — {e.label}
                        {e.meta && <span className="text-slate-500"> {JSON.stringify(e.meta)}</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>


          </div>

          {message && (
            <div className="mt-4 bg-slate-700 text-white p-3 rounded-lg text-sm border border-slate-600">
              {message}
            </div>
          )}
        </div>

        <div className="text-center text-slate-500 text-xs">
          Simulateur v2.0 avec rendu 3D — Ligne d'embouteillage — Way2tech.ai integration
        </div>

      </div>
    </div>
  )
}