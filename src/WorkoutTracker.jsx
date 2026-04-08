import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { loadWorkoutsFromCloud, saveWorkoutsToCloud, loadHistoryFromCloud, saveHistoryToCloud } from "./cloudStorage";

// ── STORAGE ────────────────────────────────────────────────────────────────
// Uses window.storage (artifact persistent storage) as primary layer —
// this survives closing the tab, background, and app restarts.
// Falls back to localStorage and then in-memory for environments without it.
const STORAGE_KEY = "gymlog_workouts_v2";
const HISTORY_KEY = "gymlog_history_v2";

const _mem = {};
const storage = {
  // Sync read: checks _mem cache first (populated on async hydration)
  get(key) {
    if (_mem[key] !== undefined) return _mem[key];
    try { const v = localStorage.getItem(key); if (v != null) return v; } catch (_) {}
    return null;
  },
  // Sync write: updates cache + localStorage immediately
  set(key, value) {
    _mem[key] = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    // Also persist to artifact storage asynchronously (fire-and-forget)
    if (window.storage?.set) {
      window.storage.set(key, value).catch(() => {});
    }
  },
  // Async hydrate: pulls from artifact storage into _mem + localStorage on startup
  async hydrate(keys) {
    if (!window.storage?.get) return;
    await Promise.all(keys.map(async (key) => {
      try {
        const result = await window.storage.get(key);
        if (result?.value != null) {
          _mem[key] = result.value;
          try { localStorage.setItem(key, result.value); } catch (_) {}
        }
      } catch (_) {}
    }));
  },
};

// ── CONSTANTS ──────────────────────────────────────────────────────────────
// Treinos com nomes livres — até 5
const MAX_WORKOUTS = 5;
const MUSCLE_COLORS = {
  Peito: "#f97316", Costas: "#3b82f6", Quadríceps: "#eab308",
  "Post. Coxa": "#f59e0b", Glúteos: "#ec4899", Panturrilha: "#14b8a6",
  Bíceps: "#a78bfa", Tríceps: "#6366f1", Ombros: "#a855f7",
  Trapézio: "#64748b", Antebraço: "#0ea5e9", Core: "#ef4444",
};
const GROUP_ORDER = ["Peito", "Costas", "Quadríceps", "Post. Coxa", "Glúteos", "Panturrilha", "Bíceps", "Tríceps", "Ombros", "Trapézio", "Antebraço", "Core"];
const REST_PRESETS = [60, 90, 120, 180];

const EXERCISE_LIBRARY = {
  Peito: [
    { name: "Supino Reto com Barra", unit: "kg", desc: "Deitado no banco, desce a barra até o peito. Exercício base para peitoral." },
    { name: "Supino Inclinado com Barra", unit: "kg", desc: "Banco a ~30–45°, foco na porção superior do peitoral." },
    { name: "Supino Reto com Halteres", unit: "kg", desc: "Igual ao supino com barra, mas halteres permitem maior amplitude." },
    { name: "Supino Inclinado com Halteres", unit: "kg", desc: "Banco inclinado com halteres. Maior amplitude de movimento." },
    { name: "Peck Deck (Fly na Máquina)", unit: "kg", desc: "Máquina de abrir e fechar. Isola o peitoral, seguro para iniciantes." },
    { name: "Crossover Alto (Cabo)", unit: "kg", desc: "Cabo puxado de cima para baixo cruzando na frente do corpo." },
    { name: "Crossover Baixo (Cabo)", unit: "kg", desc: "Cabo puxado de baixo para cima cruzando na frente. Ênfase no peitoral superior." },
    { name: "Flexão de Braço (Push-up)", unit: "reps", desc: "No chão, empurra o corpo com as mãos. Exercício funcional completo." },
    { name: "Dip em Paralelas (foco peito)", unit: "reps", desc: "Corpo inclinado para frente nas barras. Foco no peitoral inferior." },
    { name: "Pullover com Halter", unit: "kg", desc: "Deitado no banco transversal, desce o halter atrás da cabeça. Expande caixa torácica." },
  ],
  Costas: [
    { name: "Pulldown (Puxada Frontal)", unit: "kg", desc: "Puxa a barra da polia alta até o peito. Fundamental para largura das costas." },
    { name: "Pull-up (Barra Fixa Pronada)", unit: "reps", desc: "Tração na barra com pegada pronada. Um dos melhores exercícios para costas." },
    { name: "Chin-up (Barra Fixa Supinada)", unit: "reps", desc: "Tração com palmas viradas para você. Ativa mais bíceps." },
    { name: "Remada Curvada com Barra", unit: "kg", desc: "Tronco inclinado, puxa a barra até o abdômen. Espessura das costas." },
    { name: "Remada Unilateral com Halter", unit: "kg", desc: "Um joelho no banco, puxa o halter. Excelente para correção de desequilíbrios." },
    { name: "Remada Baixa no Cabo (Seated Row)", unit: "kg", desc: "Sentado na polia baixa, puxa em direção ao abdômen." },
    { name: "Levantamento Terra (Deadlift)", unit: "kg", desc: "Exercício rei do corpo todo. Fundamental para força e massa." },
    { name: "Deadlift Romeno", unit: "kg", desc: "Barra desce pela frente com joelhos levemente flexionados. Isquiotibiais e lombar." },
    { name: "Hiperextensão no Banco Romano", unit: "reps", desc: "Tronco desce e sobe no banco romano. Fortalece lombar e glúteos." },
    { name: "Face Pull no Cabo", unit: "kg", desc: "Cabo na altura do rosto, puxa em direção ao rosto separando os braços." },
  ],
  Quadríceps: [
    { name: "Agachamento Livre com Barra", unit: "kg", desc: "Barra nas costas, desce até pelvis abaixo dos joelhos. Rei dos exercícios de perna." },
    { name: "Leg Press 45°", unit: "kg", desc: "Empurra a plataforma inclinada com as pernas. Seguro e eficaz." },
    { name: "Hack Squat na Máquina", unit: "kg", desc: "Máquina específica com costas apoiadas. Excelente isolamento de quadríceps." },
    { name: "Extensão de Pernas (Leg Extension)", unit: "kg", desc: "Máquina de extensão de joelhos. Isola o quadríceps completamente." },
    { name: "Passada Búlgara (Bulgarian Split Squat)", unit: "kg", desc: "Pé traseiro elevado no banco. Excelente para força e equilíbrio unilateral." },
    { name: "Agachamento Goblet", unit: "kg", desc: "Halter ou kettlebell no peito, postura ereta. Ótimo para iniciantes." },
    { name: "Avanço com Halteres", unit: "kg", desc: "Passo à frente com halteres. Trabalha quadríceps, glúteos e equilíbrio." },
  ],
  "Post. Coxa": [
    { name: "Mesa Flexora (Leg Curl Deitado)", unit: "kg", desc: "Deitado, curla as pernas contra resistência. Isola isquiotibiais." },
    { name: "Cadeira Flexora (Leg Curl Sentado)", unit: "kg", desc: "Sentado, curla as pernas. Posição mais funcional que deitado." },
    { name: "Deadlift Romeno (foco isquio)", unit: "kg", desc: "Barra ou halteres, desce pela frente com joelhos levemente flexionados." },
    { name: "Stiff", unit: "kg", desc: "Joelhos bem retos, desce a barra pela frente. Isquiotibiais em máxima amplitude." },
    { name: "Nordic Curl", unit: "reps", desc: "Joelhos no chão, segura os calcanhares e desce o corpo. Previne lesões." },
    { name: "Good Morning", unit: "kg", desc: "Barra nas costas, inclina o tronco para frente mantendo as costas retas." },
  ],
  Glúteos: [
    { name: "Hip Thrust com Barra", unit: "kg", desc: "Ombros no banco, barra no quadril, empurra o quadril para cima. Melhor exercício para glúteos." },
    { name: "Hip Thrust na Máquina", unit: "kg", desc: "Versão guiada do hip thrust. Mais seguro e consistente." },
    { name: "Glute Bridge", unit: "reps", desc: "Deitado no chão, eleva o quadril. Versão mais acessível do hip thrust." },
    { name: "Kickback no Cabo", unit: "kg", desc: "Em 4 apoios ou em pé, chuta a perna para trás no cabo." },
    { name: "Abdução de Quadril na Máquina", unit: "kg", desc: "Sentado, abre as pernas contra resistência. Glúteo médio." },
    { name: "Agachamento Búlgaro (foco glúteo)", unit: "kg", desc: "Pé traseiro elevado, tronco mais inclinado para frente. Ativa mais o glúteo." },
  ],
  Panturrilha: [
    { name: "Elevação em Pé (Standing Calf Raise)", unit: "kg", desc: "Em pé, sobe nas pontas dos pés. Ativa principalmente o gastrocnêmio." },
    { name: "Elevação Sentado (Seated Calf Raise)", unit: "kg", desc: "Sentado com resistência nos joelhos. Ativa principalmente o sóleo." },
    { name: "Leg Press Calf Raise", unit: "kg", desc: "No leg press, empurra a plataforma apenas com as pontas dos pés." },
    { name: "Elevação Unilateral com Halter", unit: "kg", desc: "Uma perna por vez, halter na mão. Maior amplitude e foco unilateral." },
  ],
  Bíceps: [
    { name: "Rosca Direta com Barra", unit: "kg", desc: "Em pé, curla a barra com pegada supinada. Fundamental para bíceps." },
    { name: "Rosca Direta com Halteres", unit: "kg", desc: "Curla bilateral com halteres. Permite maior amplitude de movimento." },
    { name: "Rosca Alternada com Halteres", unit: "kg", desc: "Um braço por vez. Melhor foco e contração peak." },
    { name: "Rosca Martelo (Hammer Curl)", unit: "kg", desc: "Pegada neutra (polegar para cima). Trabalha braquial e braquiorradial." },
    { name: "Rosca Concentrada", unit: "kg", desc: "Cotovelo apoiado na coxa, curla o halter. Máximo isolamento." },
    { name: "Rosca Scott com Barra", unit: "kg", desc: "Braços apoiados no banco inclinado. Remove o impulso do corpo." },
    { name: "Rosca Inclinada com Halteres", unit: "kg", desc: "Deitado em banco inclinado, braços esticados. Alongamento máximo." },
  ],
  Tríceps: [
    { name: "Tríceps Testa com Barra (Skull Crusher)", unit: "kg", desc: "Deitado, desce a barra até a testa. Exercício composto de tríceps." },
    { name: "Tríceps Testa com Halteres", unit: "kg", desc: "Versão com halteres do skull crusher. Permite maior amplitude." },
    { name: "Pushdown no Cabo (Barra Reta)", unit: "kg", desc: "Em pé, empurra a barra do cabo para baixo. Clássico de tríceps." },
    { name: "Pushdown com Corda", unit: "kg", desc: "Mesmo padrão, mas com corda que abre no final. Maior ativação da cabeça lateral." },
    { name: "Extensão sobre a Cabeça com Halter", unit: "kg", desc: "Halter atrás da cabeça, estende os braços. Foco na cabeça longa." },
    { name: "Dip em Paralelas (foco tríceps)", unit: "reps", desc: "Corpo reto nas barras, cotovelos fechados. Excelente para massa de tríceps." },
    { name: "Close Grip Bench Press", unit: "kg", desc: "Supino com pegada fechada. Composto para tríceps com cargas altas." },
  ],
  Ombros: [
    { name: "Desenvolvimento Militar com Barra (OHP)", unit: "kg", desc: "Em pé ou sentado, empurra a barra acima da cabeça. Rei dos exercícios de ombro." },
    { name: "Desenvolvimento com Halteres", unit: "kg", desc: "Sentado ou em pé, empurra os halteres acima da cabeça." },
    { name: "Desenvolvimento Arnold", unit: "kg", desc: "Começa com palmas para você e gira durante o movimento. Trabalha todos os feixes." },
    { name: "Elevação Lateral com Halteres", unit: "kg", desc: "Braços abertos lateralmente até a altura dos ombros. Deltóide medial." },
    { name: "Elevação Lateral no Cabo", unit: "kg", desc: "Mesmo movimento no cabo. Tensão constante durante todo o movimento." },
    { name: "Face Pull no Cabo", unit: "kg", desc: "Cabo na altura do rosto, puxa em direção ao rosto. Saúde do manguito rotador." },
    { name: "Fly Invertido (Deltóide Posterior)", unit: "kg", desc: "Tronco inclinado, abre os braços para os lados. Deltóide posterior." },
  ],
  Trapézio: [
    { name: "Encolhimento com Barra (Shrug)", unit: "kg", desc: "Em pé, eleva os ombros em direção às orelhas. Trapézio superior." },
    { name: "Encolhimento com Halteres", unit: "kg", desc: "Igual ao shrug com barra, mas halteres ao lado do corpo." },
    { name: "Farmer's Walk", unit: "kg", desc: "Carrega halteres pesados e caminha. Trabalha trapézio, core e grip." },
  ],
  Antebraço: [
    { name: "Rosca de Punho (Wrist Curl)", unit: "kg", desc: "Antebraços apoiados, curla o punho. Flexores do antebraço." },
    { name: "Rosca de Punho Inverso", unit: "kg", desc: "Mesma posição, mas curla para baixo. Extensores do antebraço." },
    { name: "Dead Hang na Barra", unit: "seg", desc: "Suspende o corpo na barra pelo maior tempo possível. Grip e antebraço." },
    { name: "Farmer's Walk", unit: "kg", desc: "Carrega peso pesado e caminha. O melhor funcional para antebraço." },
  ],
  Core: [
    { name: "Crunch no Chão", unit: "reps", desc: "Eleva o tronco parcialmente do chão contra resistência da gravidade." },
    { name: "Crunch no Cabo", unit: "kg", desc: "De joelhos, puxa o cabo com a cabeça. Carga progressiva para abdômen." },
    { name: "Prancha Frontal (Plank)", unit: "seg", desc: "Apoio no antebraço, corpo reto. Exercício isométrico para core." },
    { name: "Ab Wheel Rollout", unit: "reps", desc: "Roda de abdômen, empurra para frente e puxa de volta. Avançado." },
    { name: "Elevação de Pernas Suspenso", unit: "reps", desc: "Suspenso na barra, eleva as pernas retas até a horizontal." },
    { name: "Russian Twist", unit: "kg", desc: "Sentado inclinado, gira o tronco com disco ou halter. Oblíquos." },
    { name: "Woodchop no Cabo", unit: "kg", desc: "Cabo em diagonal, puxa de cima para baixo ou de baixo para cima. Rotação de core." },
    { name: "Dead Bug", unit: "reps", desc: "Deitado, braço e perna opostos se estendem sem tocar o chão. Anti-extensão." },
  ],
};

function genId() { return Math.random().toString(36).slice(2, 9); }
function makeEx(name, group, sets, reps, unit = "kg", restTime = 90) {
  return { id: genId(), name, group, sets, reps, unit, restTime, weight: null, setWeights: Array(sets).fill(""), done: [] };
}

// Estrutura inicial — sem treinos
const DEFAULT_WORKOUTS = { workouts: [] };
// workouts = [{ id, name, exercises: [] }, ...]

function loadWorkouts() {
  try {
    const s = storage.get(STORAGE_KEY);
    if (s) {
      const saved = JSON.parse(s);
      // Support new format { workouts: [...] }
      if (saved && Array.isArray(saved.workouts)) {
        saved.workouts = saved.workouts.map(w => ({
          ...w,
          exercises: (w.exercises || []).map(ex =>
            ex.restTime == null ? { ...ex, restTime: 90 } : ex
          ),
        }));
        return saved;
      }
    }
  } catch (_) {}
  return { workouts: [] };
}
function loadHistory() {
  try { const s = storage.get(HISTORY_KEY); if (s) return JSON.parse(s); } catch (_) {}
  return [];
}
function saveHistory(h) { storage.set(HISTORY_KEY, JSON.stringify(h)); }

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── TIMER HOOK ────────────────────────────────────────────────────────────
function useElapsedTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [running]);
  return elapsed;
}

// ── STEPPER ───────────────────────────────────────────────────────────────
function Stepper({ label, val, onDec, onInc }) {
  return (
    <div style={{ background: "#1f2937", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onDec} style={{ background: "#374151", border: "none", borderRadius: 8, width: 36, height: 36, cursor: "pointer", color: "#f9fafb", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#f9fafb", minWidth: 28, textAlign: "center" }}>{val}</span>
        <button onClick={onInc} style={{ background: "#374151", border: "none", borderRadius: 8, width: 36, height: 36, cursor: "pointer", color: "#f9fafb", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      </div>
    </div>
  );
}

// ── CONFIG STEP ──────────────────────────────────────────────────────────
const REST_OPTIONS = [0, 30, 60, 90, 120, 180, 240];
function ConfigStep({ name, group, unit, desc, sets, reps, weight, restTime, setSets, setReps, setWeight, setRestTime, onBack, onConfirm }) {
  const color = MUSCLE_COLORS[group] || "#6b7280";
  return (
    <>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: "0 0 12px", display: "flex", alignItems: "center", gap: 4 }}>
        ← Voltar
      </button>
      <div style={{ background: "#1f2937", borderRadius: 12, padding: 16, marginBottom: 20, borderLeft: `3px solid ${color}` }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>{group}</p>
        <p style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>{name}</p>
        {desc && <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{desc}</p>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Stepper label="Séries" val={sets} onDec={() => setSets(v => Math.max(1, v - 1))} onInc={() => setSets(v => v + 1)} />
        <Stepper label="Reps" val={reps} onDec={() => setReps(v => Math.max(1, v - 1))} onInc={() => setReps(v => v + 1)} />
        <div style={{ background: "#1f2937", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Carga ({unit})</span>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—"
            style={{ background: "none", border: "none", fontSize: 22, fontWeight: 700, color: "#f9fafb", width: "100%", textAlign: "center", outline: "none" }} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>⏱ Descanso entre séries</p>
        <div style={{ display: "flex", gap: 5 }}>
          {REST_OPTIONS.map(s => (
            <button key={s} onClick={() => setRestTime(s)} style={{
              flex: 1, background: restTime === s ? color + "33" : "#1f2937",
              border: `1.5px solid ${restTime === s ? color : "#374151"}`,
              borderRadius: 8, padding: "8px 0", cursor: "pointer",
              fontSize: 11, fontWeight: 700,
              color: restTime === s ? color : "#6b7280",
            }}>
              {s === 0 ? "—" : s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onConfirm} style={{ width: "100%", background: "#a3e635", border: "none", borderRadius: 12, padding: "14px 0", cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#0a0a0a" }}>
        + ADICIONAR
      </button>
    </>
  );
}

// ── PICKER MODAL ─────────────────────────────────────────────────────────
function PickerModal({ onClose, onAdd }) {
  const [group, setGroup] = useState(null);
  const [mode, setMode] = useState("library");
  const [exName, setExName] = useState(null);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(12);
  const [weight, setWeight] = useState("");
  const [restTime, setRestTime] = useState(90);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("kg");
  const [customGroup, setCustomGroup] = useState("Peito");
  const [customStep, setCustomStep] = useState("form");

  function confirmLibrary() {
    const ex = EXERCISE_LIBRARY[group].find(e => e.name === exName);
    onAdd({ id: genId(), name: exName, group, sets, reps, unit: ex?.unit || "kg", restTime, weight: weight ? Number(weight) : null, setWeights: Array(sets).fill(weight || ""), done: [] });
    onClose();
  }
  function confirmCustom() {
    if (!customName.trim()) return;
    onAdd({ id: genId(), name: customName.trim(), group: customGroup, sets, reps, unit: customUnit, restTime, weight: weight ? Number(weight) : null, setWeights: Array(sets).fill(weight || ""), done: [] });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#111827", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px", paddingBottom: "max(40px, env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb" }}>
            {mode === "custom" ? (customStep === "form" ? "Exercício personalizado" : customName) : (!group ? "Escolha o grupo" : !exName ? group : group)}
          </span>
          <button onClick={onClose} style={{ background: "#1f2937", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#9ca3af", fontSize: 13 }}>✕</button>
        </div>

        {mode === "library" && !group && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {GROUP_ORDER.map(g => (
                <button key={g} onClick={() => setGroup(g)} style={{ background: "#1f2937", border: `1.5px solid ${MUSCLE_COLORS[g]}33`, borderRadius: 12, padding: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: MUSCLE_COLORS[g], flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{g}</span>
                  <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>{EXERCISE_LIBRARY[g].length}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setMode("custom"); setCustomStep("form"); }} style={{ width: "100%", background: "#1f2937", border: "1.5px dashed #374151", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20, color: "#6b7280" }}>✏️</span>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#d1d5db" }}>Exercício personalizado</p>
                <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Crie com nome e grupo</p>
              </div>
            </button>
          </>
        )}

        {mode === "library" && group && !exName && (
          <>
            <button onClick={() => setGroup(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: "0 0 12px", display: "flex", alignItems: "center", gap: 4 }}>← Grupos</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EXERCISE_LIBRARY[group].map(ex => (
                <button key={ex.name} onClick={() => setExName(ex.name)} style={{ background: "#1f2937", border: "1.5px solid #1f2937", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: "#f9fafb", fontWeight: 600, marginBottom: 3 }}>{ex.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{ex.desc}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#6b7280", background: "#0a0f1a", padding: "3px 7px", borderRadius: 6, flexShrink: 0, marginTop: 2 }}>{ex.unit}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {mode === "library" && group && exName && (
          <ConfigStep name={exName} group={group} unit={EXERCISE_LIBRARY[group]?.find(e => e.name === exName)?.unit || "kg"}
            desc={EXERCISE_LIBRARY[group]?.find(e => e.name === exName)?.desc}
            sets={sets} reps={reps} weight={weight} restTime={restTime} setSets={setSets} setReps={setReps} setWeight={setWeight} setRestTime={setRestTime}
            onBack={() => setExName(null)} onConfirm={confirmLibrary} />
        )}

        {mode === "custom" && customStep === "form" && (
          <>
            <button onClick={() => setMode("library")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: "0 0 12px", display: "flex", alignItems: "center", gap: 4 }}>← Biblioteca</button>
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>NOME DO EXERCÍCIO</p>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Ex: Rosca Scott, Face Pull..."
                style={{ width: "100%", background: "#1f2937", border: "1.5px solid #374151", borderRadius: 10, padding: "12px 14px", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>GRUPO MUSCULAR</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GROUP_ORDER.map(g => (
                  <button key={g} onClick={() => setCustomGroup(g)} style={{ background: customGroup === g ? MUSCLE_COLORS[g] + "33" : "#1f2937", border: `1.5px solid ${customGroup === g ? MUSCLE_COLORS[g] : "#374151"}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: customGroup === g ? MUSCLE_COLORS[g] : "#9ca3af" }}>{g}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>UNIDADE</p>
              <div style={{ display: "flex", gap: 8 }}>
                {["kg", "reps", "seg"].map(u => (
                  <button key={u} onClick={() => setCustomUnit(u)} style={{ flex: 1, background: customUnit === u ? "#a3e635" : "#1f2937", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 14, fontWeight: 700, color: customUnit === u ? "#0a0a0a" : "#6b7280" }}>{u}</button>
                ))}
              </div>
            </div>
            <button onClick={() => { if (customName.trim()) setCustomStep("config"); }} style={{ width: "100%", background: customName.trim() ? "#a3e635" : "#1f2937", border: "none", borderRadius: 12, padding: "14px 0", cursor: "pointer", fontSize: 15, fontWeight: 800, color: customName.trim() ? "#0a0a0a" : "#4b5563" }}>
              Próximo →
            </button>
          </>
        )}

        {mode === "custom" && customStep === "config" && (
          <ConfigStep name={customName} group={customGroup} unit={customUnit}
            sets={sets} reps={reps} weight={weight} restTime={restTime} setSets={setSets} setReps={setReps} setWeight={setWeight} setRestTime={setRestTime}
            onBack={() => setCustomStep("form")} onConfirm={confirmCustom} />
        )}
      </div>
    </div>
  );
}


// ── PUSH NOTIFICATION HELPER (global) ────────────────────────────────────
// Sempre usa o Service Worker — único método que funciona com tela bloqueada.
// new Notification() direto não funciona em background/tela bloqueada.
function sendPushNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if (navigator.serviceWorker?.controller) {
      // SW ativo: postMessage → SW chama showNotification()
      navigator.serviceWorker.controller.postMessage({ type: "PUSH", title, body });
    } else {
      // SW registrado mas ainda sem controller (primeiro load) — usa registration
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: "/favicon.svg",
          badge: "/favicon.svg",
          vibrate: [200, 100, 200],
          silent: false,
          requireInteraction: false,
          tag: "trainefy",
        });
      }).catch(() => {});
    }
  } catch (_) {}
}

// ── REST BAR — wall-clock based, survives background/reopen ─────────────
// startedAt is a Date.now() timestamp saved at the moment the set was checked.
// Each tick recomputes remaining = duration - elapsed, so losing focus or
// closing the tab never desynchronises the display.
function RestBar({ duration, startedAt, color, onDone }) {
  const calc = () => Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));
  const [remaining, setRemaining] = useState(calc);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Fire immediately in case we reopened after the timer already expired
    const initial = calc();
    if (initial === 0) { onDoneRef.current?.(); return; }
    setRemaining(initial);

    const iv = setInterval(() => {
      const r = calc();
      setRemaining(r);
      if (r === 0) { clearInterval(iv); onDoneRef.current?.(); }
    }, 500); // 500ms tick — snappier catch-up after returning to tab
    return () => clearInterval(iv);
  }, [startedAt, duration]);

  const progress = remaining / duration; // 1 → 0
  const label = remaining >= 60
    ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
    : `${remaining}s`;

  return (
    <div style={{ position: "relative", height: 28, background: color + "14" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: color + "30",
        transformOrigin: "left",
        transform: `scaleX(${progress})`,
        transition: "transform 0.45s linear",
      }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
          ⏱ {label}
        </span>
      </div>
    </div>
  );
}

// ── EXERCISE CARD ─────────────────────────────────────────────────────────
function ExerciseCard({ exercise, onRemove, onToggleSet, onUpdateSetWeight, onUpdateExercise, sessionActive }) {
  const color = MUSCLE_COLORS[exercise.group] || "#6b7280";
  const doneSets = exercise.done.length;
  const totalSets = exercise.sets;
  const fullyDone = doneSets === totalSets;
  const [restingSet, setRestingSet] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editSets, setEditSets] = useState(exercise.sets);
  const [editReps, setEditReps] = useState(exercise.reps);
  const [editRest, setEditRest] = useState(exercise.restTime ?? 90);

  const [confirmUncheck, setConfirmUncheck] = useState(null); // set index to confirm

  const handleToggle = (i) => {
    const wasDone = exercise.done.includes(i);
    if (wasDone) {
      // Ask for confirmation before unchecking
      setConfirmUncheck(i);
      return;
    }
    onToggleSet(exercise.id, i);
    if (sessionActive && exercise.restTime > 0) {
      setRestingSet({ index: i, startedAt: Date.now() });
    }
  };

  const confirmUnchecked = (i) => {
    onToggleSet(exercise.id, i);
    if (restingSet?.index === i) setRestingSet(null);
    setConfirmUncheck(null);
  };

  const [menuOpen, setMenuOpen] = useState(false);

  const openEdit = () => {
    setEditSets(exercise.sets);
    setEditReps(exercise.reps);
    setEditRest(exercise.restTime ?? 90);
    setEditing(true);
    setMenuOpen(false);
  };

  const saveEdit = () => {
    onUpdateExercise(exercise.id, { sets: editSets, reps: editReps, restTime: editRest });
    setEditing(false);
  };

  return (
    <div style={{
      background: "#111827", borderRadius: 16,
      border: `1px solid ${fullyDone ? color + "55" : editing ? color + "44" : "#1a2234"}`,
      overflow: "hidden",
      transition: "border-color 0.3s",
      boxShadow: fullyDone ? `0 0 20px ${color}18` : "none",
    }}>
      <div style={{ padding: "14px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", textAlign: "left" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
            <span style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>{exercise.group}</span>
            {exercise.restTime > 0 && (
              <span style={{ fontSize: 10, color: "#4b5563", fontWeight: 600 }}>
                · ⏱ {exercise.restTime < 60 ? `${exercise.restTime}s` : `${exercise.restTime / 60}min`}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f9fafb", textAlign: "left" }}>{exercise.name}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {doneSets > 0 && !editing && (
            <span style={{ fontSize: 12, color, fontWeight: 700, background: color + "22", padding: "3px 8px", borderRadius: 20 }}>{doneSets}/{totalSets}</span>
          )}

          {/* ⋯ menu or save button when editing */}
          {editing ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={saveEdit} style={{
                background: color, border: "none", borderRadius: 8,
                padding: "8px 14px", cursor: "pointer",
                fontSize: 13, fontWeight: 800, color: "#0a0a0a",
                minHeight: 38,
              }}>✓ salvar</button>
              <button onClick={() => setEditing(false)} style={{
                background: "#1f2937", border: "none", borderRadius: 8,
                width: 38, height: 38, cursor: "pointer", color: "#6b7280", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  background: menuOpen ? "#374151" : "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: 8, width: 38, height: 38,
                  cursor: "pointer", color: "#9ca3af",
                  fontSize: 16, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  letterSpacing: "1px", transition: "background 0.15s",
                }}
              >
                ···
              </button>
              {menuOpen && (
                <>
                  {/* invisible backdrop to close on outside click */}
                  <div
                    onClick={() => setMenuOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 10 }}
                  />
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20,
                    background: "#1f2937", borderRadius: 10,
                    border: "1px solid #374151",
                    overflow: "hidden",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    minWidth: 130,
                  }}>
                    <button onClick={openEdit} style={{
                      width: "100%", background: "none", border: "none",
                      padding: "11px 14px", cursor: "pointer", textAlign: "left",
                      fontSize: 13, fontWeight: 600, color: "#f9fafb",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span>✏️</span> Editar
                    </button>
                    <div style={{ height: 1, background: "#374151" }} />
                    <button onClick={() => { setMenuOpen(false); onRemove(exercise.id); }} style={{
                      width: "100%", background: "none", border: "none",
                      padding: "11px 14px", cursor: "pointer", textAlign: "left",
                      fontSize: 13, fontWeight: 600, color: "#ef4444",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span>🗑️</span> Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT PANEL ── */}
      {editing && (
        <div style={{ margin: "4px 16px 14px", background: "#0d1524", borderRadius: 12, padding: "14px 14px 16px", border: `1px solid ${color}33` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[{ label: "Séries", val: editSets, set: setEditSets }, { label: "Reps", val: editReps, set: setEditReps }].map(({ label, val, set }) => (
              <div key={label} style={{ flex: 1, background: "#1f2937", borderRadius: 10, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => set(v => Math.max(1, v - 1))} style={{ background: "#374151", border: "none", borderRadius: 8, width: 36, height: 36, cursor: "pointer", color: "#f9fafb", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", minWidth: 28, textAlign: "center" }}>{val}</span>
                  <button onClick={() => set(v => v + 1)} style={{ background: "#374151", border: "none", borderRadius: 8, width: 36, height: 36, cursor: "pointer", color: "#f9fafb", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px" }}>⏱ Descanso</p>
          <div style={{ display: "flex", gap: 5 }}>
            {REST_OPTIONS.map(s => (
              <button key={s} onClick={() => setEditRest(s)} style={{
                flex: 1, background: editRest === s ? color + "33" : "#1f2937",
                border: `1.5px solid ${editRest === s ? color : "#374151"}`,
                borderRadius: 8, padding: "7px 0", cursor: "pointer",
                fontSize: 10, fontWeight: 700,
                color: editRest === s ? color : "#6b7280",
              }}>
                {s === 0 ? "—" : s < 60 ? `${s}s` : `${s / 60}m`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "2px 16px 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#4b5563", flex: "0 0 60px" }}>Série</span>
        <span style={{ fontSize: 11, color: "#4b5563", flex: 1, textAlign: "center" }}>{exercise.unit === "kg" ? "Carga (kg)" : exercise.unit === "seg" ? "Tempo (seg)" : "Reps"}</span>
        <span style={{ fontSize: 11, color: "#4b5563", flex: "0 0 40px", textAlign: "center" }}>✓</span>
      </div>

      <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: totalSets }, (_, i) => {
          const isDone = exercise.done.includes(i);
          const setWeight = exercise.setWeights?.[i] ?? (exercise.weight ?? "");
          const isResting = restingSet?.index === i;
          const borderColor = isDone ? color + "44" : "#1f2937";
          return (
            // Outer wrapper owns the border and radius — set row + rest bar live inside it
            <div key={i} style={{
              borderRadius: 10,
              border: `1px solid ${isResting ? color + "66" : borderColor}`,
              overflow: "hidden",
              transition: "border-color 0.2s",
            }}>
              {/* Set row */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: isDone ? color + "18" : "#1a2234",
                padding: "4px 12px 4px 16px",
                transition: "background 0.2s",
              }}>
                <span style={{ flex: "0 0 60px", fontSize: 13, fontWeight: 600, color: isDone ? color : "#4b5563" }}>
                  Série {i + 1}
                </span>
                <div style={{ flex: 1, height: 1, background: isDone ? color + "33" : "#374151" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#111827", borderRadius: 10, opacity: isDone ? 0.4 : 1 }}>
                  <button onClick={() => { if (isDone) return; const cur = Number(setWeight) || 0; onUpdateSetWeight(exercise.id, i, Math.max(0, cur - 5)); }}
                    style={{ background: "none", border: "none", color: "#6b7280", cursor: isDone ? "default" : "pointer", fontSize: 20, fontWeight: 300, width: 36, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                  <input type="number" value={setWeight} readOnly={isDone}
                    onChange={e => { if (!isDone) onUpdateSetWeight(exercise.id, i, e.target.value); }} placeholder="—"
                    style={{ background: "none", border: "none", width: 40, textAlign: "center", color: isDone ? color : "#f9fafb", fontSize: 14, fontWeight: 700, outline: "none", pointerEvents: isDone ? "none" : "auto" }} />
                  <button onClick={() => { if (isDone) return; const cur = Number(setWeight) || 0; onUpdateSetWeight(exercise.id, i, cur + 5); }}
                    style={{ background: "none", border: "none", color: "#6b7280", cursor: isDone ? "default" : "pointer", fontSize: 20, fontWeight: 300, width: 36, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                </div>
                <button onClick={() => handleToggle(i)} style={{
                  flex: "0 0 44px", height: 44, borderRadius: 10,
                  background: isDone ? color : "transparent",
                  border: isDone ? "none" : "1.5px solid #374151",
                  color: isDone ? "#0a0a0a" : "#4b5563",
                  fontSize: isDone ? 18 : 16, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {isDone ? "✓" : "○"}
                </button>
              </div>
              {/* Rest bar sits flush inside the same container — no gap, no border mismatch */}
              {isResting && (
                <RestBar
                  key={`rest-${i}-${restingSet?.startedAt}`}
                  duration={exercise.restTime}
                  startedAt={restingSet?.startedAt ?? Date.now()}
                  color={color}
                  onDone={() => {
                    setRestingSet(null);
                    sendPushNotification("Fim do descanso, hora da próxima série 💪", exercise.name);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm uncheck modal */}
      {confirmUncheck !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ background: "#1f2937", borderRadius: 16, padding: 24, width: "100%", maxWidth: 340, border: "1px solid #374151" }}>
            <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>Desmarcar série?</p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>Tem certeza que deseja desmarcar a Série {confirmUncheck + 1}?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmUncheck(null)} style={{ flex: 1, background: "#374151", border: "none", borderRadius: 10, padding: "12px 0", cursor: "pointer", color: "#9ca3af", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => confirmUnchecked(confirmUncheck)} style={{ flex: 1, background: "#ef4444", border: "none", borderRadius: 10, padding: "12px 0", cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 800 }}>Desmarcar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HISTORY SCREEN ───────────────────────────────────────────────────────
function HistoryScreen({ onClose, onDelete, history: historyProp }) {
  const [history, setHistoryLocal] = useState(() => historyProp?.length ? historyProp : loadHistory());
  const [selectedEx, setSelectedEx] = useState(null);

  function deleteSession(indexFromEnd) {
    const realIndex = history.length - 1 - indexFromEnd;
    const updated = history.filter((_, i) => i !== realIndex);
    setHistoryLocal(updated);
    saveHistory(updated);
    if (onDelete) onDelete(updated);
  }

  const allExNames = [...new Set(history.flatMap(s => s.exercises.map(e => e.name)))].sort();
  const chartData = selectedEx
    ? history.filter(s => s.exercises.some(e => e.name === selectedEx)).map(s => {
        const ex = s.exercises.find(e => e.name === selectedEx);
        const weights = (ex.setWeights || []).map(Number).filter(w => w > 0);
        const maxW = weights.length ? Math.max(...weights) : 0;
        return { date: s.dateShort, max: maxW, vol: ex.done.length * ex.reps * maxW };
      })
    : [];

  const groupColor = selectedEx
    ? (() => { for (const s of history) { const ex = s.exercises.find(e => e.name === selectedEx); if (ex) return MUSCLE_COLORS[ex.group] || "#a3e635"; } return "#a3e635"; })()
    : "#a3e635";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0f1a", zIndex: 200, overflowY: "auto" }}>
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#a3e635", letterSpacing: "2px", textTransform: "uppercase" }}>TRAINEFY</p>
          <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 800, color: "#f9fafb" }}>📊 Histórico</h1>
        </div>
        <button onClick={onClose} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
      </div>

      {history.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48 }}>🏋️</div>
          <p style={{ fontSize: 14, color: "#4b5563", textAlign: "center", margin: "12px 0 0" }}>Nenhum treino registrado ainda.</p>
        </div>
      ) : (
        <div style={{ padding: "0 20px 100px" }}>
          {allExNames.length > 0 && (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>PROGRESSO POR EXERCÍCIO</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {allExNames.map(name => {
                  const isSelected = selectedEx === name;
                  const grp = (() => { for (const s of history) { const e = s.exercises.find(x => x.name === name); if (e) return e.group; } return null; })();
                  const c = MUSCLE_COLORS[grp] || "#6b7280";
                  return (
                    <button key={name} onClick={() => setSelectedEx(isSelected ? null : name)} style={{ background: isSelected ? c + "22" : "#1f2937", border: `1.5px solid ${isSelected ? c : "#374151"}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: isSelected ? 700 : 400, color: isSelected ? c : "#9ca3af" }}>
                      {name}
                    </button>
                  );
                })}
              </div>

              {selectedEx && chartData.length > 0 && (
                <div style={{ background: "#111827", borderRadius: 16, padding: "16px 8px 12px", marginBottom: 24, border: `1px solid ${groupColor}33` }}>
                  <p style={{ margin: "0 0 4px 12px", fontSize: 11, color: groupColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>{selectedEx}</p>
                  <p style={{ margin: "0 0 16px 12px", fontSize: 11, color: "#4b5563" }}>Carga máxima por sessão (kg)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#1f2937", border: `1px solid ${groupColor}44`, borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: groupColor }} formatter={(v) => [`${v} kg`, "Carga máx."]} />
                      <Line type="monotone" dataKey="max" stroke={groupColor} strokeWidth={2.5} dot={{ fill: groupColor, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {chartData.length === 1 && (
                    <p style={{ margin: "8px 12px 0", fontSize: 11, color: "#4b5563" }}>Complete mais treinos para ver o progresso.</p>
                  )}
                </div>
              )}
            </>
          )}

          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase" }}>SESSÕES RECENTES</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...history].reverse().map((session, i) => (
              <div key={i} style={{ background: "#111827", borderRadius: 14, padding: "14px 16px", border: "1px solid #1f2937" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{session.date}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>⏱ {session.duration} · 📦 {Math.round(session.volume)}kg volume</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ background: "#1f2937", borderRadius: 20, padding: "4px 10px", fontSize: 12, color: "#6b7280" }}>
                      {session.exercises.length} exercícios
                    </span>
                    <button onClick={() => deleteSession(i)} style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: 18, padding: "4px", lineHeight: 1, flexShrink: 0 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {session.exercises.map((ex, j) => {
                    const weights = (ex.setWeights || []).map(Number).filter(w => w > 0);
                    const maxW = weights.length ? Math.max(...weights) : null;
                    const c = MUSCLE_COLORS[ex.group] || "#6b7280";
                    return (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#d1d5db" }}>{ex.name}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {ex.done.length}/{ex.sets} séries{maxW ? ` · ${maxW}kg` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Copyright />
    </div>
  );
}

// ── COPYRIGHT ─────────────────────────────────────────────────────────────
function Copyright() {
  return (
    <p style={{
      margin: 0,
      padding: "16px 0 8px",
      textAlign: "center",
      fontSize: 11,
      color: "#374151",
      fontWeight: 500,
      letterSpacing: "0.3px",
    }}>
      Criado por Thiago Camargo Betti
    </p>
  );
}

// ── WORKOUT SUMMARY ───────────────────────────────────────────────────────
function WorkoutSummary({ session, onClose }) {
  const { workoutName, date, duration, volume, exercises = [] } = session;

  const totalSets = exercises.reduce((a, ex) => a + ex.done.length, 0);
  const totalExs  = exercises.filter(ex => ex.done.length > 0).length;

  const MUSCLE_COLORS_S = {
    Peito: "#f97316", Costas: "#3b82f6", Quadríceps: "#eab308",
    "Post. Coxa": "#f59e0b", Glúteos: "#ec4899", Panturrilha: "#14b8a6",
    Bíceps: "#a78bfa", Tríceps: "#6366f1", Ombros: "#a855f7",
    Trapézio: "#64748b", Antebraço: "#0ea5e9", Core: "#ef4444",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Hero section */}
      <div style={{ background: "linear-gradient(160deg, #0f1f0a 0%, #0a0f1a 60%)", paddingTop: "calc(env(safe-area-inset-top) + 40px)", paddingBottom: 32, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 12, animation: "popIn 0.4s ease" }}>🏆</div>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#a3e635", letterSpacing: "2px", textTransform: "uppercase" }}>Treino concluído!</p>
        <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#f9fafb" }}>{workoutName}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>{date}</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "0 16px", marginTop: -16, marginBottom: 20 }}>
        {[
          { icon: "⏱", label: "Duração",   value: duration },
          { icon: "📦", label: "Volume",    value: `${Math.round(volume)}kg` },
          { icon: "✅", label: "Séries",    value: totalSets },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ background: "#111827", borderRadius: 16, padding: "16px 10px", textAlign: "center", border: "1px solid #1f2937" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#a3e635" }}>{value}</div>
            <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Exercise list */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px", paddingBottom: "calc(env(safe-area-inset-bottom) + 100px)" }}>
        <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "1.5px" }}>
          {totalExs} exercício{totalExs !== 1 ? "s" : ""} realizados
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exercises.filter(ex => ex.done.length > 0).map((ex, i) => {
            const color = MUSCLE_COLORS_S[ex.group] || "#6b7280";
            const weights = (ex.setWeights || []).filter(w => Number(w) > 0).map(Number);
            const maxW = weights.length ? Math.max(...weights) : null;
            const seriesCompleted = ex.done.length;
            return (
              <div key={i} style={{ background: "#111827", borderRadius: 14, padding: "14px 16px", border: `1px solid ${color}22`, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{ex.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4b5563" }}>{ex.group}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color }}>
                    {maxW ? `${maxW}kg` : `${seriesCompleted}x`}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>{seriesCompleted} série{seriesCompleted !== 1 ? "s" : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))", background: "linear-gradient(to top, #0a0f1a 70%, transparent)" }}>
        <button onClick={onClose} style={{ width: "100%", background: "#a3e635", border: "none", borderRadius: 16, padding: "16px 0", cursor: "pointer", color: "#0a0a0a", fontSize: 16, fontWeight: 900, letterSpacing: "0.5px" }}>
          Concluir 💪
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── DASHBOARD SCREEN ──────────────────────────────────────────────────────
function DashboardScreen({ history, workouts, onClose }) {
  const [copied, setCopied] = useState(false);

  // ── COMPUTE METRICS ─────────────────────────────────────────────────────
  const now = new Date();

  // 1. Total sessions and last 30 days
  const sessions30 = history.filter(s => {
    const [d, m, y] = (s.dateShort || "").split("/");
    if (!d) return false;
    const date = new Date(`20${y || now.getFullYear().toString().slice(2)}-${m}-${d}`);
    return (now - date) / 86400000 <= 30;
  });

  // 2. Weekly frequency (last 4 weeks)
  const weeklyCount = [0, 0, 0, 0];
  history.forEach(s => {
    const [d, m] = (s.dateShort || "").split("/");
    if (!d) return;
    const date = new Date(`${now.getFullYear()}-${m}-${d}`);
    const daysAgo = Math.floor((now - date) / 86400000);
    if (daysAgo < 7) weeklyCount[0]++;
    else if (daysAgo < 14) weeklyCount[1]++;
    else if (daysAgo < 21) weeklyCount[2]++;
    else if (daysAgo < 28) weeklyCount[3]++;
  });
  const avgWeekly = weeklyCount.filter(w => w > 0).length > 0
    ? (weeklyCount.reduce((a, b) => a + b, 0) / 4).toFixed(1)
    : "0";

  // 3. Streak
  let streak = 0;
  const sessionDates = [...new Set(history.map(s => s.dateShort))].sort().reverse();
  let cursor = new Date();
  cursor.setHours(0,0,0,0);
  for (const ds of sessionDates) {
    const [d, m] = (ds || "").split("/");
    if (!d) continue;
    const date = new Date(`${cursor.getFullYear()}-${m}-${d}`);
    const diff = Math.floor((cursor - date) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = date; }
    else break;
  }

  // 4. Volume trend (this week vs last week)
  const volThisWeek = history.filter(s => {
    const [d, m] = (s.dateShort||"").split("/");
    if(!d) return false;
    return (now - new Date(`${now.getFullYear()}-${m}-${d}`)) / 86400000 < 7;
  }).reduce((a, s) => a + (s.volume || 0), 0);

  const volLastWeek = history.filter(s => {
    const [d, m] = (s.dateShort||"").split("/");
    if(!d) return false;
    const days = (now - new Date(`${now.getFullYear()}-${m}-${d}`)) / 86400000;
    return days >= 7 && days < 14;
  }).reduce((a, s) => a + (s.volume || 0), 0);

  const volTrend = volLastWeek > 0
    ? Math.round(((volThisWeek - volLastWeek) / volLastWeek) * 100)
    : null;

  // 5. PRs (best weight per exercise across all history)
  const prMap = {};
  history.forEach(s => {
    (s.exercises || []).forEach(ex => {
      const weights = (ex.setWeights || []).map(Number).filter(w => w > 0);
      if (!weights.length) return;
      const best = Math.max(...weights);
      if (!prMap[ex.name] || best > prMap[ex.name].weight) {
        const [d, m] = (s.dateShort||"").split("/");
        prMap[ex.name] = { weight: best, date: s.dateShort, group: ex.group };
      }
    });
  });
  const topPRs = Object.entries(prMap)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 5);

  // 6. Muscle balance (count sessions per group)
  const groupCount = {};
  history.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex.group) groupCount[ex.group] = (groupCount[ex.group] || 0) + 1;
    });
  });
  const topGroups = Object.entries(groupCount).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const maxGroupCount = topGroups[0]?.[1] || 1;

  // ── BUILD SUMMARY FOR AI ─────────────────────────────────────────────────
  function buildPrompt() {
    const prList = topPRs.map(([name, {weight}]) => `${name}: ${weight}kg`).join(", ");
    const groups = topGroups.map(([g, c]) => `${g}(${c}x)`).join(", ");
    const totalVol = history.reduce((a, s) => a + (s.volume || 0), 0);
    const avgDur = history.length > 0
      ? history.map(s => {
          const t = (s.duration||"0:00").split(":");
          return t.length === 2 ? parseInt(t[0])*60+parseInt(t[1]) : 0;
        }).reduce((a,b)=>a+b,0) / history.length
      : 0;

    return `Você é um coach de musculação experiente analisando os dados de treino de um atleta. Seja direto, motivador e personalizado. Escreva em português, com no máximo 5 frases. NÃO use markdown, bullets ou títulos — apenas texto corrido.

Dados do atleta:
- Total de sessões registradas: ${history.length}
- Sessões nos últimos 30 dias: ${sessions30.length}
- Frequência média semanal: ${avgWeekly}x/semana
- Sequência atual: ${streak} dia${streak !== 1 ? "s" : ""} consecutivos
- Volume esta semana: ${Math.round(volThisWeek)}kg${volTrend !== null ? ` (${volTrend > 0 ? "+" : ""}${volTrend}% vs semana passada)` : ""}
- Volume total histórico: ${Math.round(totalVol)}kg
- Duração média de treino: ${Math.round(avgDur/60)}min
- Melhores cargas (top PRs): ${prList || "sem dados ainda"}
- Grupos mais treinados: ${groups || "sem dados ainda"}
- Treinos cadastrados: ${workouts.map(w=>w.name).join(", ") || "nenhum"}

Faça uma análise motivadora e honesta: aponte o que está bom, identifique padrões, e dê UMA sugestão de melhoria concreta baseada nos dados reais acima.`;
  }

  function copyPrompt() {
    const text = buildPrompt();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const MUSCLE_COLORS_LOCAL = {
    Peito: "#f97316", Costas: "#3b82f6", Quadríceps: "#eab308",
    "Post. Coxa": "#f59e0b", Glúteos: "#ec4899", Panturrilha: "#14b8a6",
    Bíceps: "#a78bfa", Tríceps: "#6366f1", Ombros: "#a855f7",
    Trapézio: "#64748b", Antebraço: "#0ea5e9", Core: "#ef4444",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#0a0f1a", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ padding: "14px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#a3e635", letterSpacing: "2px" }}>TRAINEFY</p>
            <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#f9fafb" }}>🤖 Dashboard IA</h1>
          </div>
          <button onClick={onClose} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
        </div>
        <div style={{ height: 1, background: "#1a2234" }} />
      </div>

      <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 80px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)", padding: "calc(env(safe-area-inset-top) + 88px) 16px calc(env(safe-area-inset-bottom) + 24px)" }}>

        {history.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
            <span style={{ fontSize: 56 }}>📊</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", textAlign: "center" }}>Sem dados ainda</p>
            <p style={{ fontSize: 13, color: "#4b5563", textAlign: "center", lineHeight: 1.6 }}>Complete alguns treinos para ver seus insights personalizados aqui.</p>
          </div>
        ) : (
          <>
            {/* ── STAT CARDS ROW ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Sessões", value: history.length, icon: "📅", color: "#3b82f6" },
                { label: "Frequência", value: `${avgWeekly}x/sem`, icon: "⚡", color: "#a3e635" },
                { label: "Streak", value: `${streak}d`, icon: "🔥", color: "#f97316" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{ background: "#111827", borderRadius: 14, padding: "14px 10px", border: `1px solid ${color}33`, textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>{icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
                  <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── VOLUME TREND ── */}
            <div style={{ background: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #1f2937" }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>📈 Volume semanal</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb" }}>{Math.round(volThisWeek).toLocaleString()}</span>
                  <span style={{ fontSize: 13, color: "#4b5563", marginLeft: 4 }}>kg esta semana</span>
                </div>
                {volTrend !== null && (
                  <div style={{ background: volTrend >= 0 ? "#a3e63522" : "#ef444422", borderRadius: 10, padding: "6px 12px", border: `1px solid ${volTrend >= 0 ? "#a3e635" : "#ef4444"}44` }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: volTrend >= 0 ? "#a3e635" : "#ef4444" }}>
                      {volTrend > 0 ? "+" : ""}{volTrend}%
                    </span>
                    <span style={{ fontSize: 10, color: "#4b5563", marginLeft: 4 }}>vs sem. passada</span>
                  </div>
                )}
              </div>
              {volTrend === null && volLastWeek === 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4b5563" }}>Complete treinos por 2 semanas para ver a comparação.</p>
              )}
            </div>

            {/* ── MUSCLE BALANCE ── */}
            {topGroups.length > 0 && (
              <div style={{ background: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #1f2937" }}>
                <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>⚖️ Frequência por grupo muscular</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topGroups.map(([group, count]) => {
                    const color = MUSCLE_COLORS_LOCAL[group] || "#6b7280";
                    const pct = Math.round((count / maxGroupCount) * 100);
                    return (
                      <div key={group}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#d1d5db" }}>{group}</span>
                          <span style={{ fontSize: 12, color: "#4b5563" }}>{count}x</span>
                        </div>
                        <div style={{ height: 6, background: "#1f2937", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TOP PRs ── */}
            {topPRs.length > 0 && (
              <div style={{ background: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #1f2937" }}>
                <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>🏆 Melhores cargas (PRs)</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topPRs.map(([name, { weight, group, date }], idx) => {
                    const color = MUSCLE_COLORS_LOCAL[group] || "#6b7280";
                    return (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#0d1524", borderRadius: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: idx === 0 ? "#fbbf24" : "#4b5563", minWidth: 20 }}>{idx === 0 ? "🥇" : `${idx+1}.`}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f9fafb" }}>{name}</p>
                          <p style={{ margin: 0, fontSize: 11, color }}>{group}</p>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#a3e635" }}>{weight}kg</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── COPY PROMPT ── */}
            <div style={{ background: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #a3e63533" }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#a3e635", textTransform: "uppercase", letterSpacing: "1px" }}>🤖 Análise com IA</p>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                Copie seus dados de treino e cole no <strong style={{ color: "#d1d5db" }}>claude.ai</strong> para receber uma análise personalizada do seu coach IA.
              </p>
              <button
                onClick={copyPrompt}
                style={{
                  width: "100%",
                  background: copied ? "#a3e63522" : "#1f2937",
                  border: `1.5px solid ${copied ? "#a3e635" : "#374151"}`,
                  borderRadius: 12, padding: "14px 0", cursor: "pointer",
                  color: copied ? "#a3e635" : "#f9fafb",
                  fontSize: 14, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ Copiado! Cole no claude.ai" : "📋 Copiar dados para análise"}
              </button>
            </div>
          </>
        )}
        <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 11, color: "#1f2937" }}>Criado por Thiago Camargo Betti</p>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}


// ── AI GENERATOR SCREEN ───────────────────────────────────────────────────
function AIGeneratorScreen({ onClose, onImport }) {
  const TOTAL_STEPS = 7;
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    days: null, duration: 60, level: null,
    goals: [], weight: "", height: "", focus: [],
  });
  const [copied, setCopied] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [importMsg, setImportMsg] = useState("");

  const imc = answers.weight && answers.height
    ? (parseFloat(answers.weight) / Math.pow(parseFloat(answers.height) / 100, 2)).toFixed(1)
    : null;
  const imcLabel = imc
    ? imc < 18.5 ? "Abaixo do peso" : imc < 25 ? "Peso normal" : imc < 30 ? "Sobrepeso" : "Obesidade"
    : null;

  function buildPrompt() {
    const { days, duration, level, goals, weight, height, focus } = answers;
    const focusTxt = focus.length ? `Foco extra em: ${focus.join(", ")}.` : "";
    const measuresTxt = weight && height ? `Peso: ${weight}kg, Altura: ${height}cm (IMC ${imc} — ${imcLabel}).` : "";
    return `Você é um personal trainer especialista. Crie um plano de treino completo em formato CSV.

PERFIL DO ALUNO:
- Frequência: ${days} dias por semana
- Duração por sessão: ${duration} minutos
- Nível: ${level}
- Objetivo: ${goals.join(", ")}
${measuresTxt}
${focusTxt}

INSTRUÇÕES OBRIGATÓRIAS:
1. Gere EXATAMENTE ${days} treinos distintos, nomeados como "Treino A", "Treino B", etc.
2. Cada treino deve caber em ${duration} minutos considerando séries, reps e descanso.
3. Use grupos musculares SOMENTE desta lista: Peito, Costas, Quadríceps, Post. Coxa, Glúteos, Panturrilha, Bíceps, Tríceps, Ombros, Trapézio, Antebraço, Core
4. Adapte volume e intensidade para nível ${level}.

FORMATO DE SAÍDA — responda APENAS com o CSV, sem texto adicional:

Treino,Exercício,Grupo,Séries,Reps,Carga (kg),Descanso (seg)
Treino A,Supino Reto com Barra,Peito,4,10,60,90

Regras: separador vírgula, sem aspas, carga em kg (0 para bodyweight), descanso em segundos (60-180), reps 6-20, séries 3-5, mínimo 4 exercícios por treino.`;
  }

  function handleCopy() {
    const prompt = buildPrompt();
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = prompt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  }

  function parseCSVText(text) {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) throw new Error("Conteúdo inválido ou vazio.");
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const workoutIdx = headers.findIndex(h => h.includes("treino") || h.includes("dia"));
    const nameIdx    = headers.findIndex(h => h.includes("exerc"));
    const groupIdx   = headers.findIndex(h => h.includes("grupo"));
    const setsIdx    = headers.findIndex(h => h.includes("sér") || h.includes("serie") || h.includes("séri"));
    const repsIdx    = headers.findIndex(h => h.includes("rep"));
    const weightIdx  = headers.findIndex(h => h.includes("carga") || h.includes("kg"));
    const restIdx    = headers.findIndex(h => h.includes("descanso") || h.includes("seg"));
    if (workoutIdx === -1 || nameIdx === -1) throw new Error("Formato inválido. O CSV precisa ter colunas Treino e Exercício.");
    const workoutMap = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      const wName = cols[workoutIdx] || ""; const exName = cols[nameIdx] || "";
      if (!wName || !exName) continue;
      const group    = groupIdx   !== -1 ? cols[groupIdx]  : "Core";
      const sets     = setsIdx    !== -1 ? Math.max(1, parseInt(cols[setsIdx])  || 3)  : 3;
      const reps     = repsIdx    !== -1 ? Math.max(1, parseInt(cols[repsIdx])  || 12) : 12;
      const weight   = weightIdx  !== -1 ? parseFloat(cols[weightIdx]) || null : null;
      const restTime = restIdx    !== -1 ? parseInt(cols[restIdx]) || 90 : 90;
      if (!workoutMap.has(wName)) workoutMap.set(wName, []);
      workoutMap.get(wName).push({
        id: Math.random().toString(36).slice(2, 9),
        name: exName, group, sets, reps, unit: "kg", weight, restTime,
        setWeights: Array(sets).fill(weight ? String(weight) : ""), done: [],
      });
    }
    if (workoutMap.size === 0) throw new Error("Nenhum exercício encontrado no conteúdo colado.");
    const workouts = Array.from(workoutMap.entries()).map(([name, exercises]) => ({
      id: Math.random().toString(36).slice(2, 9), name, exercises,
    }));
    return { workouts, total: workouts.reduce((s, w) => s + w.exercises.length, 0) };
  }

  function handleImport() {
    setImportStatus(null);
    try {
      const { workouts, total } = parseCSVText(pastedText);
      setImportStatus("success");
      setImportMsg(`${total} exercício${total > 1 ? "s" : ""} importado${total > 1 ? "s" : ""} com sucesso!`);
      setTimeout(() => onImport({ workouts }), 1200);
    } catch (err) {
      setImportStatus("error"); setImportMsg(err.message);
    }
  }

  const canAdvance = () => {
    if (step === 1) return answers.days !== null;
    if (step === 3) return answers.level !== null;
    if (step === 4) return answers.goals.length > 0;
    return true;
  };

  const stepTitles = ["Frequência", "Duração", "Nível", "Objetivo", "Medidas", "Foco muscular", "Gerar treino"];

  function renderStep() {
    const { days, duration, level, goals, weight, height, focus } = answers;

    if (step === 1) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 15, color: "#9ca3af", lineHeight: 1.5 }}>Quantos dias por semana você pretende treinar?</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {[2, 3, 4, 5, 6, 7].map(d => (
            <button key={d} onClick={() => setAnswers(a => ({ ...a, days: d }))} style={{
              background: days === d ? "#22d3ee" : "#1f2937",
              border: `2px solid ${days === d ? "#22d3ee" : "#374151"}`,
              borderRadius: 12, padding: "16px 0",
              cursor: "pointer", fontSize: 20, fontWeight: 800,
              color: days === d ? "#0a0a0a" : "#f9fafb", transition: "all 0.15s",
            }}>{d}</button>
          ))}
        </div>
        {days && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#4b5563", textAlign: "center" }}>{days} dias/semana selecionado</p>}
      </div>
    );

    if (step === 2) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <p style={{ margin: 0, fontSize: 15, color: "#9ca3af", lineHeight: 1.5, alignSelf: "flex-start" }}>Quanto tempo você tem por sessão?</p>
        <div style={{ background: "#111827", borderRadius: 20, padding: "28px 32px", border: "1px solid #22d3ee33", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", boxSizing: "border-box" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#22d3ee", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px" }}>Duração da sessão</p>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <button onClick={() => setAnswers(a => ({ ...a, duration: Math.max(20, a.duration - 10) }))} style={{ width: 52, height: 52, borderRadius: 14, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 24, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{duration}</span>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>minutos</p>
            </div>
            <button onClick={() => setAnswers(a => ({ ...a, duration: Math.min(120, a.duration + 10) }))} style={{ width: 52, height: 52, borderRadius: 14, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 24, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[30, 45, 60, 90].map(m => (
              <button key={m} onClick={() => setAnswers(a => ({ ...a, duration: m }))} style={{
                background: duration === m ? "#22d3ee22" : "#0a0f1a",
                border: `1.5px solid ${duration === m ? "#22d3ee" : "#374151"}`,
                borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                fontSize: 12, fontWeight: 700, color: duration === m ? "#22d3ee" : "#6b7280",
              }}>{m}min</button>
            ))}
          </div>
        </div>
      </div>
    );

    if (step === 3) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 15, color: "#9ca3af", lineHeight: 1.5 }}>Qual é o seu nível de experiência?</p>
        {[
          { lv: "Iniciante", icon: "🌱", sub: "Menos de 1 ano de treino" },
          { lv: "Intermediário", icon: "💪", sub: "1 a 3 anos de treino" },
          { lv: "Avançado", icon: "🔥", sub: "Mais de 3 anos de treino" },
        ].map(({ lv, icon, sub }) => (
          <button key={lv} onClick={() => setAnswers(a => ({ ...a, level: lv }))} style={{
            background: level === lv ? "#22d3ee18" : "#111827",
            border: `2px solid ${level === lv ? "#22d3ee" : "#1f2937"}`,
            borderRadius: 16, padding: "20px", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 28 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: level === lv ? "#22d3ee" : "#f9fafb" }}>{lv}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4b5563" }}>{sub}</p>
            </div>
            {level === lv && <span style={{ color: "#22d3ee", fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>
    );

    if (step === 4) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, color: "#9ca3af", lineHeight: 1.5 }}>Qual é o seu objetivo? <span style={{ color: "#6b7280", fontSize: 13 }}>(até 2)</span></p>
        {[
          { id: "Hipertrofia", sub: "Ganho de massa muscular", icon: "🏋️" },
          { id: "Emagrecimento", sub: "Queima de gordura", icon: "🔥" },
          { id: "Condicionamento físico", sub: "Resistência e energia", icon: "🫀" },
          { id: "Força", sub: "Aumentar força máxima", icon: "⚡" },
          { id: "Saúde geral", sub: "Bem-estar e longevidade", icon: "🌿" },
        ].map(({ id, sub, icon }) => {
          const sel = goals.includes(id);
          const maxed = goals.length >= 2 && !sel;
          return (
            <button key={id} onClick={() => { if (maxed) return; setAnswers(a => ({ ...a, goals: sel ? a.goals.filter(g => g !== id) : [...a.goals, id] })); }} style={{
              background: sel ? "#22d3ee18" : "#111827",
              border: `2px solid ${sel ? "#22d3ee" : "#1f2937"}`,
              borderRadius: 14, padding: "14px 16px", cursor: maxed ? "default" : "pointer",
              textAlign: "left", display: "flex", alignItems: "center", gap: 12,
              opacity: maxed ? 0.4 : 1, transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: sel ? "#22d3ee" : "#f9fafb" }}>{id}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4b5563" }}>{sub}</p>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? "#22d3ee" : "#374151"}`, background: sel ? "#22d3ee" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {sel && <span style={{ color: "#0a0a0a", fontSize: 12, fontWeight: 800 }}>✓</span>}
              </div>
            </button>
          );
        })}
      </div>
    );

    if (step === 5) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, color: "#9ca3af", lineHeight: 1.5 }}>Suas medidas <span style={{ color: "#4b5563", fontSize: 13 }}>(opcional)</span></p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { key: "weight", label: "Peso", unit: "kg", placeholder: "ex: 75" },
            { key: "height", label: "Altura", unit: "cm", placeholder: "ex: 175" },
          ].map(({ key, label, unit, placeholder }) => (
            <div key={key} style={{ background: "#111827", borderRadius: 14, padding: 16, border: "1px solid #1f2937" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>{label}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <input type="number" value={answers[key]} onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ background: "none", border: "none", fontSize: 28, fontWeight: 800, color: "#f9fafb", width: "100%", outline: "none" }} />
                <span style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
        {imc && (
          <div style={{ background: "#111827", borderRadius: 12, padding: "12px 16px", border: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>IMC calculado</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{imc} <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>— {imcLabel}</span></span>
          </div>
        )}
        <p style={{ margin: 0, fontSize: 12, color: "#374151", textAlign: "center" }}>As medidas ajudam a IA a personalizar melhor o treino</p>
      </div>
    );

    if (step === 6) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, color: "#9ca3af", lineHeight: 1.5 }}>Foco muscular extra <span style={{ color: "#4b5563", fontSize: 13 }}>(opcional)</span></p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { id: "Peito", icon: "🫁" }, { id: "Costas", icon: "🔙" },
            { id: "Pernas", icon: "🦵" }, { id: "Ombros", icon: "🤸" },
            { id: "Braços", icon: "💪" }, { id: "Glúteos", icon: "🍑" },
            { id: "Core", icon: "🎯" },
          ].map(({ id, icon }) => {
            const sel = focus.includes(id);
            return (
              <button key={id} onClick={() => setAnswers(a => ({ ...a, focus: sel ? a.focus.filter(f => f !== id) : [...a.focus, id] }))} style={{
                background: sel ? "#22d3ee18" : "#111827",
                border: `2px solid ${sel ? "#22d3ee" : "#1f2937"}`,
                borderRadius: 14, padding: "16px 14px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: sel ? "#22d3ee" : "#f9fafb" }}>{id}</span>
                {sel && <span style={{ marginLeft: "auto", color: "#22d3ee", fontSize: 14 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    );

    if (step === 7) return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#111827", borderRadius: 16, padding: 16, border: "1px solid #22d3ee33" }}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#22d3ee", textTransform: "uppercase", letterSpacing: "1px" }}>Resumo do seu perfil</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["📅 Frequência", `${answers.days} dias/semana`],
              ["⏱ Duração", `${answers.duration} min/sessão`],
              ["🎯 Nível", answers.level],
              ["💡 Objetivo", answers.goals.join(", ")],
              answers.weight && answers.height ? ["📏 Medidas", `${answers.weight}kg · ${answers.height}cm · IMC ${imc}`] : null,
              answers.focus.length ? ["🏋️ Foco", answers.focus.join(", ")] : null,
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#d1d5db", textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#111827", borderRadius: 16, padding: 16, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ background: "#22d3ee22", color: "#22d3ee", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20 }}>Passo 1</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>Copie o prompt gerado</p>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>Cole no <strong style={{ color: "#d1d5db" }}>claude.ai</strong> ou outra IA de sua preferência.</p>
          <button onClick={handleCopy} style={{
            width: "100%", background: copied ? "#22d3ee22" : "#1f2937",
            border: `1.5px solid ${copied ? "#22d3ee" : "#374151"}`,
            borderRadius: 12, padding: "14px 0", cursor: "pointer",
            color: copied ? "#22d3ee" : "#f9fafb", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s",
          }}>
            {copied ? "✓ Copiado! Cole no claude.ai" : "📋 Copiar prompt"}
          </button>
        </div>

        <div style={{ background: "#111827", borderRadius: 16, padding: 16, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ background: "#a3e63522", color: "#a3e635", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20 }}>Passo 2</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>Cole a resposta da IA</p>
          </div>
          <textarea value={pastedText} onChange={e => { setPastedText(e.target.value); setImportStatus(null); }}
            placeholder={"Cole aqui o CSV gerado pela IA...\n\nTreino,Exercício,Grupo,Séries,Reps,Carga (kg),Descanso (seg)\nTreino A,Supino Reto com Barra,Peito,4,10,60,90"}
            style={{
              width: "100%", minHeight: 130, background: "#0d1524",
              border: "1.5px solid #374151", borderRadius: 10,
              padding: "12px 14px", color: "#d1d5db", fontSize: 12,
              fontFamily: "monospace", lineHeight: 1.5, outline: "none",
              resize: "vertical", boxSizing: "border-box", marginBottom: 12,
            }} />
          {importStatus && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: importStatus === "success" ? "#a3e63522" : "#ef444422", border: `1px solid ${importStatus === "success" ? "#a3e635" : "#ef4444"}` }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: importStatus === "success" ? "#a3e635" : "#ef4444" }}>
                {importStatus === "success" ? "✓ " : "✕ "}{importMsg}
              </p>
            </div>
          )}
          <button onClick={handleImport} disabled={!pastedText.trim()} style={{
            width: "100%", background: pastedText.trim() ? "#a3e635" : "#1f2937",
            border: "none", borderRadius: 12, padding: "14px 0",
            cursor: pastedText.trim() ? "pointer" : "default",
            color: pastedText.trim() ? "#0a0a0a" : "#4b5563",
            fontSize: 15, fontWeight: 800, transition: "all 0.2s",
          }}>
            ✓ Importar treino
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#0a0f1a", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ padding: "14px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#22d3ee", letterSpacing: "2px" }}>TRAINEFY</p>
            <h1 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>✨ Gerar com IA</h1>
          </div>
          <button onClick={onClose} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
        </div>
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? "#22d3ee" : "#1f2937", transition: "background 0.3s" }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>Etapa {step} de {TOTAL_STEPS} — {stepTitles[step - 1]}</p>
        </div>
        <div style={{ height: 1, background: "#1a2234" }} />
      </div>

      <div style={{ flex: 1, padding: "24px 20px", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "calc(env(safe-area-inset-bottom) + 100px)" }}>
        {renderStep()}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0f1a", borderTop: "1px solid #1a2234", padding: "12px 20px", paddingBottom: "max(16px, env(safe-area-inset-bottom))", display: "flex", gap: 10 }}>
        {step > 1 && step < 7 && (
          <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, background: "#1f2937", border: "1.5px solid #374151", borderRadius: 14, padding: "14px 0", cursor: "pointer", color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>← Voltar</button>
        )}
        {step < 7 && (
          <button onClick={() => { if (canAdvance()) setStep(s => s + 1); }} style={{
            flex: 2, background: canAdvance() ? "#22d3ee" : "#1f2937",
            border: "none", borderRadius: 14, padding: "14px 0",
            cursor: canAdvance() ? "pointer" : "default",
            color: canAdvance() ? "#0a0a0a" : "#4b5563",
            fontSize: 15, fontWeight: 800, transition: "all 0.2s",
          }}>
            {step === 6 ? "Gerar treino →" : step === 5 && !answers.weight && !answers.height ? "Pular →" : "Continuar →"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── HIIT SCREEN ───────────────────────────────────────────────────────────
function HiitScreen({ onClose }) {
  const PRESETS_WORK   = [20, 30, 40, 45, 60];
  const PRESETS_REST   = [10, 15, 20, 30, 45];
  const PRESETS_ROUNDS = [4, 6, 8, 10, 12];

  const [workTime,     setWorkTime]     = useState(40);
  const [restTime,     setRestTime]     = useState(20);
  const [totalRounds,  setTotalRounds]  = useState(8);
  const [phase,        setPhase]        = useState(null); // null|"work"|"rest"|"done"
  const [remaining,    setRemaining]    = useState(0);
  const [round,        setRound]        = useState(0);
  const [running,      setRunning]      = useState(false);

  const intervalRef    = useRef(null);
  const startTsRef     = useRef(null);
  const durationRef    = useRef(0);
  const phaseRef       = useRef(null);
  const roundRef       = useRef(0);
  const workTimeRef    = useRef(40);
  const restTimeRef    = useRef(20);
  const totalRoundsRef = useRef(8);

  useEffect(() => { workTimeRef.current    = workTime;    }, [workTime]);
  useEffect(() => { restTimeRef.current    = restTime;    }, [restTime]);
  useEffect(() => { totalRoundsRef.current = totalRounds; }, [totalRounds]);

  function tick() {
    const elapsed = Math.floor((Date.now() - startTsRef.current) / 1000);
    const left = durationRef.current - elapsed;
    if (left <= 0) advance(); else setRemaining(left);
  }

  function startPhase(p, duration, r) {
    clearInterval(intervalRef.current);
    phaseRef.current    = p;
    roundRef.current    = r;
    durationRef.current = duration;
    startTsRef.current  = Date.now();
    setPhase(p); setRemaining(duration); setRound(r);
    intervalRef.current = setInterval(tick, 200);
  }

  function advance() {
    clearInterval(intervalRef.current);
    const cp  = phaseRef.current;
    const cr  = roundRef.current;
    const max = totalRoundsRef.current;
    if (cp === "work") {
      sendPushNotification("Hora de descansar 💤", `${restTimeRef.current}s — rodada ${cr} de ${max}`);
      startPhase("rest", restTimeRef.current, cr);
    } else {
      const next = cr + 1;
      if (next > max) {
        clearInterval(intervalRef.current);
        setPhase("done"); setRunning(false);
        sendPushNotification("HIIT concluído 🏆", `${max} rodadas completas. Ótimo trabalho`);
      } else {
        sendPushNotification("Hora do treino 💪", `Rodada ${next} de ${max}`);
        startPhase("work", workTimeRef.current, next);
      }
    }
  }

  async function handleStart() {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setRunning(true);
    startPhase("work", workTime, 1);
  }

  function handleStop() {
    clearInterval(intervalRef.current);
    setRunning(false); setPhase(null); setRemaining(0); setRound(0);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const fmtSec = s => {
    const v = Math.max(0, s);
    return v >= 60 ? `${Math.floor(v/60)}:${String(v%60).padStart(2,"0")}` : String(v);
  };

  const isWork = phase === "work";
  const isRest = phase === "rest";
  const isDone = phase === "done";
  const COLOR_WORK = "#a3e635";
  const COLOR_REST = "#3b82f6";
  const phaseColor = isWork ? COLOR_WORK : COLOR_REST;
  const total = isWork ? workTime : isRest ? restTime : 1;
  const progress = total > 0 ? Math.max(0, remaining) / total : 0;
  const SIZE = 240, R = 106;
  const circ = 2 * Math.PI * R;
  const dashOffset = circ * (1 - progress);

  return (
    <div style={{
      minHeight: "100vh",
      background: isWork ? "#0a1a05" : isRest ? "#05101a" : "#0a0f1a",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
      transition: "background 0.5s",
    }}>
      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#a3e635", letterSpacing: "3px" }}>TRAINEFY</p>
          <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800, color: "#f9fafb" }}>HIIT</h1>
        </div>
        <button onClick={() => { handleStop(); onClose(); }} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
      </div>

      {/* SETUP */}
      {!running && !isDone && (
        <div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", gap: 16, paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)", overflowY: "auto" }}>

          {/* Work */}
          <div style={{ background: "#111827", borderRadius: 16, padding: 18, border: "1px solid #a3e63533" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#a3e635", textTransform: "uppercase", letterSpacing: "1px" }}>Treino</p>
                <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 900, color: "#f9fafb" }}>{workTime}s</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setWorkTime(v => Math.max(5, v - 5))} style={{ width: 40, height: 40, borderRadius: 10, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <button onClick={() => setWorkTime(v => v + 5)} style={{ width: 40, height: 40, borderRadius: 10, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {PRESETS_WORK.map(s => (
                <button key={s} onClick={() => setWorkTime(s)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", background: workTime === s ? "#a3e63533" : "#1f2937", border: `1.5px solid ${workTime === s ? "#a3e635" : "#374151"}`, color: workTime === s ? "#a3e635" : "#6b7280", fontSize: 12, fontWeight: 700 }}>{s}s</button>
              ))}
            </div>
          </div>

          {/* Rest */}
          <div style={{ background: "#111827", borderRadius: 16, padding: 18, border: "1px solid #3b82f633" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "1px" }}>Descanso</p>
                <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 900, color: "#f9fafb" }}>{restTime}s</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRestTime(v => Math.max(5, v - 5))} style={{ width: 40, height: 40, borderRadius: 10, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <button onClick={() => setRestTime(v => v + 5)} style={{ width: 40, height: 40, borderRadius: 10, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {PRESETS_REST.map(s => (
                <button key={s} onClick={() => setRestTime(s)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", background: restTime === s ? "#3b82f633" : "#1f2937", border: `1.5px solid ${restTime === s ? "#3b82f6" : "#374151"}`, color: restTime === s ? "#3b82f6" : "#6b7280", fontSize: 12, fontWeight: 700 }}>{s}s</button>
              ))}
            </div>
          </div>

          {/* Rounds */}
          <div style={{ background: "#111827", borderRadius: 16, padding: 18, border: "1px solid #f9731633" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: "1px" }}>Séries</p>
                <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 900, color: "#f9fafb" }}>{totalRounds}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setTotalRounds(v => Math.max(1, v - 1))} style={{ width: 40, height: 40, borderRadius: 10, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <button onClick={() => setTotalRounds(v => v + 1)} style={{ width: 40, height: 40, borderRadius: 10, background: "#1f2937", border: "none", color: "#f9fafb", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {PRESETS_ROUNDS.map(n => (
                <button key={n} onClick={() => setTotalRounds(n)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", background: totalRounds === n ? "#f9731633" : "#1f2937", border: `1.5px solid ${totalRounds === n ? "#f97316" : "#374151"}`, color: totalRounds === n ? "#f97316" : "#6b7280", fontSize: 12, fontWeight: 700 }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: "#111827", borderRadius: 14, padding: "14px 20px", border: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#4b5563" }}>Duração estimada</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, color: "#f9fafb" }}>
                {Math.floor(((workTime + restTime) * totalRounds) / 60)}min {((workTime + restTime) * totalRounds) % 60}s
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>{totalRounds}× ({workTime}s + {restTime}s)</p>
          </div>

          <button onClick={handleStart} style={{ width: "100%", background: "#a3e635", border: "none", borderRadius: 16, padding: "20px 0", cursor: "pointer", fontSize: 18, fontWeight: 900, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>▶</span> Iniciar HIIT
          </button>
        </div>
      )}

      {/* TIMER ATIVO */}
      {running && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px calc(env(safe-area-inset-bottom) + 40px)" }}>
          <p style={{ margin: "0 0 4px", fontSize: 44, fontWeight: 900, color: phaseColor, letterSpacing: "3px", textTransform: "uppercase", transition: "color 0.4s" }}>
            {isWork ? "TREINO" : "DESCANSO"}
          </p>
          <p style={{ margin: "0 0 32px", fontSize: 14, color: "#4b5563", fontWeight: 700 }}>
            Rodada {round} de {totalRounds}
          </p>

          {/* Ring */}
          <div style={{ position: "relative", width: SIZE, height: SIZE, marginBottom: 36 }}>
            <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#1f2937" strokeWidth={10} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={phaseColor} strokeWidth={10}
                strokeDasharray={circ} strokeDashoffset={dashOffset} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.18s linear, stroke 0.4s" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 80, fontWeight: 900, color: "#f9fafb", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {fmtSec(remaining)}
              </span>
            </div>
          </div>

          {/* Próxima fase */}
          <div style={{ background: "#111827", borderRadius: 14, padding: "12px 28px", border: `1px solid ${phaseColor}22`, marginBottom: 32, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>A seguir</p>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 800, color: isWork ? COLOR_REST : COLOR_WORK }}>
              {isWork ? `DESCANSO — ${restTime}s` : round < totalRounds ? `TREINO — ${workTime}s` : "FIM"}
            </p>
          </div>

          <button onClick={handleStop} style={{ background: "#1f2937", border: "1.5px solid #374151", borderRadius: 14, padding: "16px 48px", cursor: "pointer", color: "#6b7280", fontSize: 15, fontWeight: 700 }}>
            ■ Parar
          </button>
        </div>
      )}

      {/* CONCLUÍDO */}
      {isDone && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px calc(env(safe-area-inset-bottom) + 40px)", gap: 16, textAlign: "center" }}>
          <span style={{ fontSize: 72 }}>🏆</span>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#f9fafb" }}>HIIT concluído</p>
          <p style={{ margin: 0, fontSize: 15, color: "#4b5563" }}>
            {totalRounds} rodadas · {Math.floor(((workTime + restTime) * totalRounds) / 60)}min {((workTime + restTime) * totalRounds) % 60}s
          </p>
          <button onClick={handleStop} style={{ marginTop: 16, background: "#a3e635", border: "none", borderRadius: 16, padding: "18px 48px", cursor: "pointer", fontSize: 16, fontWeight: 900, color: "#0a0a0a" }}>
            Novo HIIT
          </button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

// ── RESET SCREEN ──────────────────────────────────────────────────────────
function ResetScreen({ onClose, onReset }) {
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  function handleReset() {
    if (!confirm) { setConfirm(true); return; }
    onReset();
    setDone(true);
    setTimeout(() => onClose(), 1500);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#a3e635", letterSpacing: "3px" }}>TRAINEFY</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, color: "#f9fafb" }}>Zerar dados</h1>
        </div>
        <button onClick={onClose} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#111827", borderRadius: 16, padding: 20, border: "1px solid #ef444433" }}>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>⚠️ Atenção</p>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
            Esta ação irá apagar <strong style={{ color: "#f9fafb" }}>todos os treinos e histórico</strong> permanentemente. Não é possível desfazer.
          </p>

          {done ? (
            <div style={{ padding: "14px", background: "#a3e63522", borderRadius: 10, border: "1px solid #a3e635", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#a3e635" }}>✓ Dados zerados com sucesso</p>
            </div>
          ) : (
            <>
              {confirm && (
                <div style={{ padding: "12px 14px", background: "#ef444422", borderRadius: 10, border: "1px solid #ef4444", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#ef4444" }}>Tem certeza? Toque novamente para confirmar.</p>
                </div>
              )}
              <button onClick={handleReset} style={{
                width: "100%", background: confirm ? "#ef4444" : "#1f2937",
                border: `1.5px solid ${confirm ? "#ef4444" : "#374151"}`,
                borderRadius: 12, padding: "15px 0", cursor: "pointer",
                fontSize: 15, fontWeight: 800,
                color: confirm ? "#fff" : "#ef4444",
                transition: "all 0.2s",
              }}>
                {confirm ? "✕ Confirmar exclusão" : "Apagar todos os dados"}
              </button>
            </>
          )}
        </div>
      </div>
      <Copyright />
    </div>
  );
}

// ── IMPORT SCREEN ─────────────────────────────────────────────────────────
function ImportScreen({ onClose, onImport }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  function downloadTemplate() {
    const header = "Treino,Exercício,Grupo,Séries,Reps,Carga (kg),Descanso (seg)";
    const rows = [
      "Treino A,Supino Reto com Barra,Peito,4,10,60,90",
      "Treino A,Rosca Direta com Barra,Bíceps,3,12,40,60",
      "Treino B,Pulldown (Puxada Frontal),Costas,4,10,55,90",
      "Treino B,Desenvolvimento com Halteres,Ombros,3,12,20,60",
      "Treino C,Agachamento Livre com Barra,Quadríceps,4,8,80,120",
      "Treino C,Hip Thrust com Barra,Glúteos,4,12,60,90",
    ];
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trainefy_modelo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text) {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) throw new Error("Arquivo vazio ou sem dados.");

    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

    const workoutIdx = headers.findIndex(h => h.includes("treino") || h.includes("dia"));
    const nameIdx = headers.findIndex(h => h.includes("exerc"));
    const groupIdx = headers.findIndex(h => h.includes("grupo"));
    const setsIdx = headers.findIndex(h => h.includes("sér") || h.includes("serie") || h.includes("séri"));
    const repsIdx = headers.findIndex(h => h.includes("rep"));
    const weightIdx = headers.findIndex(h => h.includes("carga") || h.includes("kg"));
    const restIdx = headers.findIndex(h => h.includes("descanso") || h.includes("seg"));

    if (workoutIdx === -1 || nameIdx === -1) throw new Error("Colunas 'Treino' e 'Exercício' são obrigatórias.");

    // Group exercises by workout name (free name, not fixed days)
    const workoutMap = new Map(); // name -> [exercises]

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      const workoutName = cols[workoutIdx] || "";
      const exName = cols[nameIdx] || "";
      if (!workoutName || !exName) continue;

      const group = groupIdx !== -1 ? cols[groupIdx] : "Core";
      const sets = setsIdx !== -1 ? Math.max(1, parseInt(cols[setsIdx]) || 3) : 3;
      const reps = repsIdx !== -1 ? Math.max(1, parseInt(cols[repsIdx]) || 12) : 12;
      const weight = weightIdx !== -1 ? parseFloat(cols[weightIdx]) || null : null;
      const restTime = restIdx !== -1 ? parseInt(cols[restIdx]) || 90 : 90;

      if (!workoutMap.has(workoutName)) workoutMap.set(workoutName, []);
      workoutMap.get(workoutName).push({
        id: Math.random().toString(36).slice(2, 9),
        name: exName, group, sets, reps, unit: "kg", weight, restTime,
        setWeights: Array(sets).fill(weight ? String(weight) : ""),
        done: [],
      });
    }

    if (workoutMap.size === 0) throw new Error("Nenhum exercício encontrado. Verifique o arquivo.");

    const workouts = Array.from(workoutMap.entries()).map(([name, exercises]) => ({
      id: Math.random().toString(36).slice(2, 9),
      name,
      exercises,
    }));

    const total = workouts.reduce((s, w) => s + w.exercises.length, 0);
    return { workouts, total };
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setStatus("error"); setMessage("Use um arquivo .csv"); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { workouts, total } = parseCSV(e.target.result);
        setStatus("success");
        setMessage(`${total} exercício${total > 1 ? "s" : ""} importado${total > 1 ? "s" : ""} com sucesso!`);
        setTimeout(() => onImport({ workouts }), 1200);
      } catch (err) {
        setStatus("error"); setMessage(err.message);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#a3e635", letterSpacing: "3px" }}>TRAINEFY</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, color: "#f9fafb" }}>Importar treino</h1>
        </div>
        <button onClick={onClose} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Step 1 — Download template */}
        <div style={{ background: "#111827", borderRadius: 16, padding: 20, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ background: "#a3e63522", color: "#a3e635", fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 20 }}>Passo 1</span>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>Baixe o modelo</p>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            Baixe a planilha modelo em CSV, preencha com seus treinos e faça o upload abaixo. A coluna <strong style={{ color: "#d1d5db" }}>Treino</strong> deve ter o nome exato de cada treino (ex: Treino A, Peito e Tríceps).
          </p>
          <button onClick={downloadTemplate} style={{ width: "100%", background: "#1f2937", border: "1.5px solid #374151", borderRadius: 12, padding: "14px 0", cursor: "pointer", color: "#a3e635", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>⬇️</span> Baixar modelo CSV
          </button>
        </div>

        {/* Step 2 — Upload */}
        <div style={{ background: "#111827", borderRadius: 16, padding: 20, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 12, fontWeight: 800, padding: "3px 8px", borderRadius: 20 }}>Passo 2</span>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>Envie o arquivo preenchido</p>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
            Selecione o arquivo .csv preenchido. Os treinos existentes serão substituídos.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#a3e635" : "#374151"}`,
              borderRadius: 12, padding: "32px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              cursor: "pointer", transition: "border-color 0.2s",
              background: dragging ? "#a3e63511" : "transparent",
            }}
          >
            <span style={{ fontSize: 32 }}>📂</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>Toque para selecionar o arquivo</p>
            <p style={{ margin: 0, fontSize: 12, color: "#4b5563" }}>Apenas .csv</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={e => handleFile(e.target.files[0])} style={{ display: "none" }} />

          {/* Status */}
          {status && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: status === "success" ? "#a3e63522" : "#ef444422", border: `1px solid ${status === "success" ? "#a3e635" : "#ef4444"}` }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: status === "success" ? "#a3e635" : "#ef4444" }}>
                {status === "success" ? "✓ " : "✕ "}{message}
              </p>
            </div>
          )}
        </div>

        {/* Format reference */}
        <div style={{ background: "#111827", borderRadius: 16, padding: 20, border: "1px solid #1f2937" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Formato esperado</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Treino", "Exercício", "Grupo", "Séries", "Reps", "Carga (kg)", "Descanso (seg)"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", background: "#1f2937", color: "#6b7280", fontWeight: 700, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Treino A", "Supino Reto", "Peito", "4", "10", "60", "90"],
                  ["Treino B", "Pulldown", "Costas", "4", "10", "55", "90"],
                ].map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: "6px 10px", color: "#9ca3af", borderTop: "1px solid #1f2937", whiteSpace: "nowrap" }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Copyright />
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function WorkoutTracker({ userId, userEmail }) {
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState(loadWorkouts); // { workouts: [{id, name, exercises}] }
  const [activeIdx, setActiveIdx] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const tripleClickRef = useRef({ count: 0, timer: null });
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(160);

  useEffect(() => {
    if (!headerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setHeaderHeight(e.contentRect.height);
    });
    obs.observe(headerRef.current);
    return () => obs.disconnect();
  }, []);
  const [sessionActive, setSessionActive] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lastSession, setLastSession] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [screen, setScreen] = useState("home"); // "home" | "workout"
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHiit, setShowHiit] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editingWorkoutName, setEditingWorkoutName] = useState('');
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const saveTimeoutRef = useRef(null);
  useEffect(() => { setShowMenu(false); }, [activeIdx]);

  const workouts = data.workouts || [];
  const activeWorkout = workouts[activeIdx] || null;
  const exercises = activeWorkout?.exercises || [];

  // Carrega dados da nuvem ao montar.
  useEffect(() => {
    async function hydrate() {
      try {
        const [cloudData, cloudHistory] = await Promise.all([
          loadWorkoutsFromCloud(userId),
          loadHistoryFromCloud(userId),
        ]);
        if (cloudData && Array.isArray(cloudData.workouts)) {
          cloudData.workouts = cloudData.workouts.map(w => ({
            ...w,
            exercises: (w.exercises || []).map(ex =>
              ex.restTime == null ? { ...ex, restTime: 90 } : ex
            ),
          }));
          setData(cloudData);
          if (cloudData.workouts.length > 0) setActiveIdx(0);
        }
        if (cloudHistory) setHistory(cloudHistory);
      } catch (e) {
        console.warn("Erro ao carregar da nuvem:", e);
      }
      const savedTs = storage.get(SESSION_START_KEY);
      if (savedTs && Number(savedTs) > 0) {
        setSessionStartTs(Number(savedTs));
        setSessionActive(true);
      }
      setHydrated(true);

      // Registrar SW para notificações com tela bloqueada
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").then(reg => {
          // Se há um SW waiting (novo deploy), força ativação imediata
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          reg.addEventListener("updatefound", () => {
            const newSW = reg.installing;
            if (newSW) newSW.addEventListener("statechange", () => {
              if (newSW.state === "installed" && reg.waiting) {
                reg.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        }).catch(() => {});
      }
    }
    hydrate();
  }, [userId]);
  // Persistent session start — saved to storage so closing the app doesn't lose it
  const SESSION_START_KEY = "gymlog_session_start_v2";
  const [sessionStartTs, setSessionStartTs] = useState(() => {
    const saved = storage.get(SESSION_START_KEY);
    return saved ? Number(saved) : null;
  });
  const elapsed = useElapsedTimer(sessionActive);
  // Salva na nuvem com debounce
  useEffect(() => {
    if (!hydrated) return;
    try { storage.set(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveWorkoutsToCloud(userId, data);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      } catch (e) {
        console.warn("Erro ao salvar na nuvem:", e);
      }
    }, 1500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [data, hydrated, userId]);

  const doneCount = exercises.filter(e => e.done.length === e.sets).length;
  const volume = exercises.reduce((acc, ex) => acc + ex.done.reduce((s, setIdx) => {
    const w = ex.setWeights?.[setIdx] ?? ex.weight ?? 0;
    return s + Number(w) * ex.reps;
  }, 0), 0);

  // Helper to update exercises of active workout
  function updateExercises(updater) {
    setData(prev => ({
      ...prev,
      workouts: prev.workouts.map((w, i) =>
        i === activeIdx ? { ...w, exercises: updater(w.exercises || []) } : w
      ),
    }));
  }

  function addExercise(ex) {
    const setWeights = Array.from({ length: ex.sets }, () => ex.weight ?? "");
    updateExercises(prev => [...prev, { ...ex, setWeights }]);
  }
  function removeExercise(id) {
    updateExercises(prev => prev.filter(e => e.id !== id));
  }
  function toggleSet(exId, setIdx) {
    updateExercises(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      const done = ex.done.includes(setIdx) ? ex.done.filter(s => s !== setIdx) : [...ex.done, setIdx];
      return { ...ex, done };
    }));
  }
  function updateSetWeight(exId, setIdx, val) {
    updateExercises(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      const setWeights = [...(ex.setWeights || Array.from({ length: ex.sets }, () => ex.weight ?? ""))];
      setWeights[setIdx] = val === "" ? "" : Number(val);
      return { ...ex, setWeights };
    }));
  }
  function updateExercise(exId, changes) {
    updateExercises(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      const newSets = changes.sets ?? ex.sets;
      const setWeights = Array.from({ length: newSets }, (_, i) => ex.setWeights?.[i] ?? ex.weight ?? "");
      const done = ex.done.filter(s => s < newSets);
      return { ...ex, ...changes, setWeights, done };
    }));
  }
  // Workout CRUD
  function createWorkout(name) {
    if (!name.trim() || workouts.length >= MAX_WORKOUTS) return;
    const newW = { id: genId(), name: name.trim(), exercises: [] };
    setData(prev => ({ ...prev, workouts: [...prev.workouts, newW] }));
    setActiveIdx(workouts.length);
  }
  function deleteWorkout(idx) {
    setData(prev => ({ ...prev, workouts: prev.workouts.filter((_, i) => i !== idx) }));
    setActiveIdx(prev => Math.max(0, prev > idx ? prev - 1 : prev === idx ? 0 : prev));
  }
  function renameWorkout(idx, name) {
    setData(prev => ({
      ...prev,
      workouts: prev.workouts.map((w, i) => i === idx ? { ...w, name: name.trim() } : w),
    }));
  }
  async function startSession() {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const ts = Date.now();
    setSessionStartTs(ts);
    storage.set(SESSION_START_KEY, String(ts));
    setSessionActive(true);
  }

  function finishSession() {
    const durationSecs = sessionStartTs ? Math.floor((Date.now() - sessionStartTs) / 1000) : 0;
    const duration = fmtTime(durationSecs);
    storage.set(SESSION_START_KEY, "");
    setSessionStartTs(null);
    const now = new Date();
    const dateShort = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dateFull = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    const workoutName = activeWorkout?.name || "Treino";
    const session = { workoutName, date: dateFull, dateShort, duration, volume, exercises: exercises.map(ex => ({ ...ex })) };
    const newHistory = [...history, session];
    setHistory(newHistory);
    saveHistory(newHistory);
    saveHistoryToCloud(userId, newHistory).catch(e => console.warn("Erro ao salvar histórico:", e));
    updateExercises(prev => prev.map(ex => ({ ...ex, done: [] })));
    setSessionActive(false);
    setShowFinishConfirm(false);
    setLastSession(session);
    setShowSummary(true);
  }

  function handleLogoClick() {
    const t = tripleClickRef.current;
    t.count += 1;
    clearTimeout(t.timer);
    t.timer = setTimeout(() => { t.count = 0; }, 600);
    if (t.count >= 3) {
      t.count = 0;
      // Hard reload sem cache
      window.location.reload(true);
    }
  }

  if (!hydrated) return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 36 }}>💪</div>
      <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>Carregando treino...</p>
    </div>
  );

  if (showHistory) return <HistoryScreen history={history} onClose={() => setShowHistory(false)} onDelete={(updated) => { setHistory(updated); saveHistoryToCloud(userId, updated).catch(() => {}); }} />;
  if (showImport) return <ImportScreen onClose={() => setShowImport(false)} onImport={(imported) => { setData(imported); setActiveIdx(0); setShowImport(false); }} />;
  if (showReset) return <ResetScreen onClose={() => setShowReset(false)} onReset={() => {
    const empty = { workouts: [] };
    setData(empty);
    setActiveIdx(0);
    setHistory([]);
    saveHistory([]);
    saveWorkoutsToCloud(userId, empty).catch(() => {});
    saveHistoryToCloud(userId, []).catch(() => {});
  }} />;

  // ── SCREEN: home grid or workout detail
  // When entering workout, set active idx
  function openWorkout(idx) {
    setActiveIdx(idx);
    setScreen("workout");
  }

  // ── HOME SCREEN ──────────────────────────────────────────────────────────
  if (showSummary && lastSession) return (
    <WorkoutSummary
      session={lastSession}
      onClose={() => { setShowSummary(false); setScreen("home"); }}
    />
  );

  if (showDashboard) return <DashboardScreen history={history} workouts={workouts} onClose={() => setShowDashboard(false)} />;
  if (showAIGenerator) return <AIGeneratorScreen onClose={() => setShowAIGenerator(false)} onImport={(imported) => { setData(imported); setActiveIdx(0); setShowAIGenerator(false); }} />;
  if (showHiit) return <HiitScreen onClose={() => setShowHiit(false)} />;

  if (screen === "home") return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Fixed top */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#0a0f1a", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ padding: "16px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: "#a3e635", letterSpacing: "3px" }}>TRAINEFY</span>
          <span style={{ fontSize: 11, color: "#4b5563" }}>{userEmail}</span>
        </div>
        <div style={{ height: 1, background: "#1a2234" }} />
      </div>

      {/* Scrollable grid */}
      <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 72px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)", padding: "calc(env(safe-area-inset-top) + 80px) 16px calc(env(safe-area-inset-bottom) + 24px)" }}>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px" }}>Meus treinos</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Workout buttons */}
          {workouts.map((w, i) => {
            const done = w.exercises.filter(e => e.done.length === e.sets).length;
            const total = w.exercises.length;
            const allDone = total > 0 && done === total;
            return (
              <button key={w.id} onClick={() => openWorkout(i)} style={{
                background: "#111827",
                border: `1.5px solid ${allDone ? "#a3e63555" : "#1f2937"}`,
                borderRadius: 16, padding: "20px 16px",
                cursor: "pointer", textAlign: "left",
                display: "flex", flexDirection: "column", gap: 8,
                minHeight: 110,
                boxShadow: allDone ? "0 0 20px #a3e63518" : "none",
                transition: "border-color 0.2s",
              }}>
                <span style={{ fontSize: 24 }}>🏋️</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", lineHeight: 1.3 }}>{w.name}</span>
                {total > 0 && (
                  <span style={{ fontSize: 12, color: allDone ? "#a3e635" : "#4b5563", fontWeight: 600 }}>
                    {allDone ? "✓ Concluído" : `${total} exercício${total > 1 ? "s" : ""}`}
                  </span>
                )}
                {total === 0 && <span style={{ fontSize: 12, color: "#374151" }}>Vazio</span>}
              </button>
            );
          })}

          {/* New workout button */}
          {workouts.length < MAX_WORKOUTS && (
            <button onClick={() => setShowNewWorkout(true)} style={{
              background: "transparent", border: "1.5px dashed #374151",
              borderRadius: 16, padding: "20px 16px",
              cursor: "pointer", textAlign: "left",
              display: "flex", flexDirection: "column", gap: 8,
              minHeight: 110, alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 28, color: "#4b5563" }}>+</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#4b5563" }}>Novo treino</span>
            </button>
          )}
        </div>

        {/* Function buttons */}
        <div style={{ marginTop: 24 }}>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px" }}>Ferramentas</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => setShowDashboard(true)} style={{ background: "#111827", border: "1.5px solid #a3e63533", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100, boxShadow: "0 0 20px #a3e63511" }}>
              <span style={{ fontSize: 24 }}>🤖</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#a3e635" }}>Dashboard IA</span>
              <span style={{ fontSize: 11, color: "#4b5563" }}>Insights do treino</span>
            </button>
            <button onClick={() => setShowHiit(true)} style={{ background: "#111827", border: "1.5px solid #f9731633", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100, boxShadow: "0 0 20px #f9731611" }}>
              <span style={{ fontSize: 24 }}>⚡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f97316" }}>HIIT</span>
              <span style={{ fontSize: 11, color: "#4b5563" }}>Timer intervalado</span>
            </button>
            <button onClick={() => setShowAIGenerator(true)} style={{ background: "#111827", border: "1.5px solid #22d3ee33", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100, boxShadow: "0 0 20px #22d3ee11" }}>
              <span style={{ fontSize: 24 }}>✨</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#22d3ee" }}>Gerar com IA</span>
              <span style={{ fontSize: 11, color: "#4b5563" }}>Monte seu treino</span>
            </button>
            <button onClick={() => setShowHistory(true)} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
              <span style={{ fontSize: 24 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>Histórico</span>
            </button>
            <button onClick={() => setShowImport(true)} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
              <span style={{ fontSize: 24 }}>📥</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>Importar treino</span>
            </button>
            <button onClick={() => setShowReset(true)} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
              <span style={{ fontSize: 24 }}>🗑️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>Zerar dados</span>
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "20px 16px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
              <span style={{ fontSize: 24 }}>→</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#6b7280" }}>Sair</span>
            </button>
          </div>
        </div>
        <p style={{ margin: "24px 0 0", textAlign: "center", fontSize: 11, color: "#1f2937" }}>Criado por Thiago Camargo Betti</p>
      </div>

      {/* New workout modal */}
      {showNewWorkout && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#111827", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 20px", paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}>
            <p style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#f9fafb" }}>Novo treino</p>
            <input autoFocus value={newWorkoutName} onChange={e => setNewWorkoutName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newWorkoutName.trim()) { createWorkout(newWorkoutName); setNewWorkoutName(""); setShowNewWorkout(false); } }}
              placeholder="Ex: Treino A, Peito e Costas..."
              style={{ width: "100%", background: "#1f2937", border: "1.5px solid #374151", borderRadius: 12, padding: "14px 16px", color: "#f9fafb", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowNewWorkout(false); setNewWorkoutName(""); }} style={{ flex: 1, background: "#1f2937", border: "none", borderRadius: 12, padding: "14px 0", cursor: "pointer", color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>Cancelar</button>
              <button onClick={() => { if (newWorkoutName.trim()) { createWorkout(newWorkoutName); setNewWorkoutName(""); setShowNewWorkout(false); } }} style={{ flex: 2, background: newWorkoutName.trim() ? "#a3e635" : "#1f2937", border: "none", borderRadius: 12, padding: "14px 0", cursor: "pointer", color: newWorkoutName.trim() ? "#0a0a0a" : "#4b5563", fontSize: 15, fontWeight: 800 }}>Criar treino</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );

  // ── WORKOUT DETAIL SCREEN ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Fixed header */}
      <div ref={headerRef} id="fixed-header" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#0a0f1a", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ padding: "10px 20px 0" }}>
          {/* Top row: back + title + menu */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => { setScreen("home"); setShowMenu(false); }} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              ← Voltar
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>{activeWorkout?.name || ""}</span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowMenu(v => !v)} style={{ background: showMenu ? "#374151" : "#1f2937", border: "1px solid #374151", borderRadius: 10, width: 44, height: 44, cursor: "pointer", color: "#9ca3af", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>⋯</button>
              {showMenu && (
                <>
                  <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 20, background: "#1f2937", borderRadius: 14, border: "1px solid #374151", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 200 }}>
                    <button onClick={() => { setEditingWorkoutId(activeWorkout.id); setEditingWorkoutName(activeWorkout.name); setShowMenu(false); }} style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", cursor: "pointer", color: "#f9fafb", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>✏️ Renomear treino</button>
                    <div style={{ height: 1, background: "#374151" }} />
                    <button onClick={() => { deleteWorkout(activeIdx); setScreen("home"); setShowMenu(false); }} style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", cursor: "pointer", color: "#ef4444", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>🗑️ Excluir treino</button>
                    <div style={{ height: 1, background: "#374151" }} />
                    <button onClick={() => { setShowHistory(true); setShowMenu(false); }} style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", cursor: "pointer", color: "#f9fafb", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>📊 Histórico</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rename input inline */}
          {editingWorkoutId === activeWorkout?.id && (
            <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
              <input autoFocus value={editingWorkoutName} onChange={e => setEditingWorkoutName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { renameWorkout(activeIdx, editingWorkoutName); setEditingWorkoutId(null); } if (e.key === "Escape") setEditingWorkoutId(null); }}
                style={{ flex: 1, background: "#1f2937", border: "1.5px solid #a3e635", borderRadius: 10, padding: "8px 12px", color: "#f9fafb", fontSize: 14, fontWeight: 700, outline: "none" }}
              />
              <button onClick={() => { renameWorkout(activeIdx, editingWorkoutName); setEditingWorkoutId(null); }} style={{ background: "#a3e635", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#0a0a0a" }}>✓</button>
              <button onClick={() => setEditingWorkoutId(null)} style={{ background: "#1f2937", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: "#6b7280", fontSize: 14 }}>✕</button>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {volume > 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>Volume: <strong style={{ color: "#a3e635" }}>{Math.round(volume)}kg</strong></span>}
              {exercises.length > 0 && <span style={{ fontSize: 12, color: "#a3e635", fontWeight: 700 }}>{doneCount}/{exercises.length} séries</span>}
            </div>
            {sessionActive && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#a3e63522", borderRadius: 20, padding: "4px 10px", border: "1px solid #a3e63533" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a3e635", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#a3e635", letterSpacing: "0.3px" }}>em treino</span>
              </div>
            )}
          </div>
          {exercises.length > 0 && (
            <div style={{ height: 3, background: "#1f2937", borderRadius: 2 }}>
              <div style={{ height: "100%", borderRadius: 2, background: "#a3e635", width: `${(doneCount / exercises.length) * 100}%`, transition: "width 0.4s ease" }} />
            </div>
          )}
        </div>
        <div style={{ height: 1, background: "#1a2234", marginTop: 8 }} />
      </div>

      {/* Scrollable content - paddingTop measured dynamically */}
      <div style={{
        paddingTop: headerHeight + 12,
        paddingBottom: "calc(env(safe-area-inset-bottom) + 100px)",
        paddingLeft: 16,
        paddingRight: 16,
        background: "#0a0f1a",
      }}>
        {exercises.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
            <div style={{ fontSize: 48 }}>🏋️</div>
            <p style={{ fontSize: 14, textAlign: "center", margin: "12px 0 0", color: "#4b5563", lineHeight: 1.6 }}>
              Nenhum exercício ainda.<br />Toca em <strong style={{ color: "#a3e635" }}>+ Exercício</strong> para começar.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {exercises.map(ex => (
              <ExerciseCard key={ex.id} exercise={ex} onRemove={removeExercise} onToggleSet={toggleSet} onUpdateSetWeight={updateSetWeight} onUpdateExercise={updateExercise} sessionActive={sessionActive} />
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "#0a0f1a", borderTop: "1px solid #1a2234", paddingTop: 12, paddingLeft: 16, paddingRight: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        {showFinishConfirm && (
          <div style={{ background: "#1f2937", borderRadius: 14, padding: "14px 16px", border: "1px solid #374151", marginBottom: 10 }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, color: "#f9fafb", fontWeight: 700 }}>Finalizar treino?</p>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280" }}>As séries marcadas serão salvas no histórico.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowFinishConfirm(false)} style={{ flex: 1, background: "#374151", border: "none", borderRadius: 10, padding: "10px 0", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button onClick={finishSession} style={{ flex: 2, background: "#a3e635", border: "none", borderRadius: 10, padding: "10px 0", cursor: "pointer", color: "#0a0a0a", fontSize: 13, fontWeight: 800 }}>✓ Finalizar</button>
            </div>
          </div>
        )}
        {exercises.length > 0 ? (
          sessionActive ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowPicker(true)} style={{ flex: 1, background: "#1f2937", border: "1.5px solid #374151", borderRadius: 14, padding: "14px 0", cursor: "pointer", color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>+ Exercício</button>
              <button onClick={() => setShowFinishConfirm(true)} style={{ flex: 2, background: "#a3e635", border: "none", borderRadius: 14, padding: "14px 0", cursor: "pointer", color: "#0a0a0a", fontSize: 14, fontWeight: 800 }}>🏁 Finalizar</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowPicker(true)} style={{ flex: 1, background: "#1f2937", border: "1.5px solid #374151", borderRadius: 14, padding: "14px 0", cursor: "pointer", color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>+ Exercício</button>
              <button onClick={startSession} style={{ flex: 2, background: "#a3e635", border: "none", borderRadius: 14, padding: "14px 0", cursor: "pointer", color: "#0a0a0a", fontSize: 15, fontWeight: 800 }}>▶ Iniciar treino</button>
            </div>
          )
        ) : (
          <button onClick={() => setShowPicker(true)} style={{ width: "100%", background: "#a3e635", border: "none", borderRadius: 14, padding: "16px 0", cursor: "pointer", color: "#0a0a0a", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>+</span> Exercício
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {showPicker && <PickerModal onClose={() => setShowPicker(false)} onAdd={addExercise} />}
    </div>
  );
}



