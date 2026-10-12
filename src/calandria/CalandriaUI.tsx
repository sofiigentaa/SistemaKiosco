import React, { useState } from 'react';
import { CheckCircle2, Copy, Pause, Play, ShieldAlert, ShieldCheck, X, Clock, MessageCircle } from 'lucide-react';
import { formatMinutes, useCalandria } from './CalandriaContext';
import { CalandriaKind } from './chain';

// Logo de Cotorra: la C de circuito dentro del escudo (misma familia que TERO).
export const CalandriaMark: React.FC<{ className?: string; light?: boolean }> = ({ className, light }) => (
  <svg viewBox="0 0 100 115" fill="none" className={className} role="img" aria-label="Cotorra">
    <path
      d="M 50 6 L 89 19 C 89 62 80 92 50 110 C 20 92 11 62 11 19 Z"
      fill={light ? '#FFFFFF' : '#0B1220'}
      stroke={light ? '#0E7490' : '#22D3EE'}
      strokeWidth="6"
      strokeLinejoin="round"
    />
    <path d="M66 40 H42 L32 50 V70 L42 80 H66" stroke={light ? '#0B1220' : '#F1F5F9'} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="66" cy="40" r="6" fill="#22D3EE" />
    <circle cx="66" cy="80" r="6" fill="#22D3EE" />
  </svg>
);

export const KIND_LABEL: Record<CalandriaKind, string> = {
  reposicion: 'Pedido a proveedores',
  ingreso_habitual: 'Ingreso habitual de mercadería',
  liquidacion: 'Precio de productos por vencer',
  fiados: 'Recordatorios de fiado',
  sistema: 'Cotorra',
};
const ACTION_LABEL = { aprobada: 'Aprobada', descartada: 'Ahora no', pausa: 'Pausada', reanudada: 'Reanudada' } as const;

// Luz de estado: verde = todo en orden, ámbar = hay algo para aprobar, gris = en pausa.
const Light: React.FC<{ className?: string }> = ({ className = 'w-2.5 h-2.5' }) => {
  const { paused, suggestions } = useCalandria();
  const color = paused ? 'bg-slate-400' : suggestions.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400';
  return <span className={`${className} rounded-full inline-block ${color}`} aria-hidden="true" />;
};

// Marca del sistema: el logo de Cotorra arriba a la izquierda. Tocarlo abre el panel.
export const CalandriaBrand: React.FC<{ onDark?: boolean; onClick?: () => void }> = ({ onDark = true, onClick }) => {
  const { suggestions, setPanelOpen, minutesThisMonth, paused } = useCalandria();
  const estado = paused
    ? 'En pausa'
    : suggestions.length > 0
      ? `${suggestions.length} ${suggestions.length === 1 ? 'tarea para aprobar' : 'tareas para aprobar'}`
      : `${formatMinutes(minutesThisMonth)} ahorrados este mes`;
  return (
    <button
      id="calandria-btn"
      type="button"
      onClick={onClick || (() => setPanelOpen(true))}
      className={`relative flex items-center gap-2.5 rounded-xl pr-2 py-1 text-left transition-colors cursor-pointer ${onDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
      title="Cotorra: tareas para aprobar con un botón"
    >
      <CalandriaMark className="w-8 h-9 sm:w-9 sm:h-10 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className={`flex items-center gap-1.5 font-bold text-base sm:text-lg tracking-tight ${onDark ? 'text-white' : 'text-slate-900'}`}>
          Cotorra
          {suggestions.length > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[11px] font-black flex items-center justify-center" aria-label={`${suggestions.length} tareas para aprobar`}>
              {suggestions.length}
            </span>
          )}
        </span>
        <span className={`hidden sm:flex items-center gap-1.5 text-[11px] font-semibold ${onDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
          <Light className="w-2 h-2" />
          {estado}
        </span>
      </span>
    </button>
  );
};

export const CalandriaPanel: React.FC = () => {
  const c = useCalandria();
  if (!c.panelOpen) return null;
  const first = c.suggestions[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs" onClick={() => c.setPanelOpen(false)}>
      <aside
        role="dialog"
        aria-label="Cotorra"
        data-testid="calandria-panel"
        className="w-full sm:max-w-md h-full bg-slate-50 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
          <CalandriaMark className="w-9 h-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base leading-tight">Cotorra</div>
            <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
              <Light className="w-2 h-2" />
              {c.paused
                ? 'En pausa: no propone nada'
                : c.suggestions.length > 0
                  ? `${c.suggestions.length} ${c.suggestions.length === 1 ? 'tarea lista' : 'tareas listas'} para aprobar`
                  : 'Todo en orden'}
            </div>
          </div>
          <button
            type="button"
            onClick={c.togglePause}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
              c.paused ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400' : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title={c.paused ? 'Volver a activar Cotorra' : 'Que Cotorra deje de proponer'}
          >
            {c.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {c.paused ? 'Reanudar' : 'Pará'}
          </button>
          <button type="button" onClick={() => c.setPanelOpen(false)} className="p-1.5 rounded hover:bg-slate-800 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Contador de tiempo */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ahorrado este mes
              </div>
              <div className="text-lg font-black text-cyan-700" data-testid="calandria-minutes">
                {formatMinutes(c.minutesThisMonth)}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-500">Tareas aprobadas</div>
              <div className="text-lg font-black text-slate-800">{c.approvedCount}</div>
            </div>
          </div>

          {/* Botón grande (el mismo que el botón físico) */}
          {!c.paused && first && (
            <div className="rounded-xl bg-slate-900 p-4 flex items-center gap-4">
              <button
                type="button"
                data-testid="calandria-big-button"
                onClick={() => c.approve(first)}
                className="w-20 h-20 shrink-0 rounded-full bg-cyan-400 hover:bg-cyan-300 active:scale-95 shadow-[0_0_0_6px_rgba(34,211,238,0.25)] text-slate-900 font-black text-sm transition-transform cursor-pointer"
              >
                Aprobar
              </button>
              <div className="text-xs text-slate-300">
                <div className="text-white font-bold text-sm mb-1">{first.title}</div>
                Un toque y listo. También funciona con la tecla <b className="text-cyan-300">F9</b> o con el botón físico Cotorra.
              </div>
            </div>
          )}

          {/* Propuestas */}
          {!c.paused && c.suggestions.length === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Todo en orden. Cotorra sigue mirando y te avisa con la luz cuando haya algo para hacer.</span>
            </div>
          )}
          {c.paused && (
            <div className="rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
              Cotorra está en pausa. No propone ni hace nada hasta que toques <b>Reanudar</b>.
            </div>
          )}
          {c.suggestions.map((s) => (
            <div key={s.key} className="rounded-lg bg-white border border-slate-200 p-3.5 space-y-2" data-testid="calandria-suggestion">
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-sm text-slate-900">{s.title}</div>
                <span className="shrink-0 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-bold px-2 py-0.5">
                  ~{s.minutes} min
                </span>
              </div>
              <p className="text-xs text-slate-600">{s.detail}</p>
              <ul className="text-[11px] text-slate-700 bg-slate-50 rounded border border-slate-100 px-2.5 py-1.5 space-y-0.5">
                {s.lines.slice(0, 4).map((l, i) => (
                  <li key={i} className="truncate">• {l}</li>
                ))}
                {s.lines.length > 4 && <li className="text-slate-400">y {s.lines.length - 4} más…</li>}
              </ul>
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => c.approve(s)}
                  className="flex-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 cursor-pointer"
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  onClick={() => c.dismiss(s)}
                  className="rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-3 py-2 cursor-pointer"
                >
                  Ahora no
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Registro sellado */}
        <button
          type="button"
          onClick={() => {
            c.refreshLog();
            c.setLogOpen(true);
          }}
          className="border-t border-slate-200 bg-white px-4 py-3 text-left text-xs flex items-center gap-2 hover:bg-slate-50 cursor-pointer"
        >
          {c.verification.ok ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
          <span className="flex-1">
            <b>Registro sellado</b> · {c.verification.count + c.pending.length} acciones ·{' '}
            {c.verification.ok ? 'íntegro' : `alterado en la línea ${c.verification.brokenAt}`}
          </span>
          <span className="text-cyan-700 font-semibold">Ver</span>
        </button>
      </aside>
    </div>
  );
};

export const CalandriaLogModal: React.FC = () => {
  const c = useCalandria();
  if (!c.logOpen) return null;
  const entries = [...c.log].reverse();

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-3" onClick={() => c.setLogOpen(false)}>
      <div
        role="dialog"
        aria-label="Registro sellado de Cotorra"
        className="bg-white w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <CalandriaMark className="w-7 h-8" light />
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">Registro sellado</h3>
            <p className="text-[11px] text-slate-500">
              Qué hizo Cotorra y cuándo. Sin nombres ni datos de clientes: solo el tipo de tarea y la cantidad.
            </p>
          </div>
          <button type="button" onClick={() => c.setLogOpen(false)} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`mx-4 mt-3 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
            c.verification.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
          data-testid="calandria-verify"
        >
          {c.verification.ok ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          {c.verification.ok
            ? `Verificado: las ${c.verification.count} líneas están completas y ninguna fue modificada.`
            : `Atención: el registro no coincide desde la línea ${c.verification.brokenAt}. Alguien lo modificó o borró una parte.`}
          {c.pending.length > 0 && <span className="font-normal">({c.pending.length} pendientes de sellar, se suben al volver internet)</span>}
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-slate-500 text-left">
              <tr>
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Fecha</th>
                <th className="py-1 pr-2">Tarea</th>
                <th className="py-1 pr-2">Acción</th>
                <th className="py-1 pr-2 text-right">Cant.</th>
                <th className="py-1 pr-2 text-right">Min.</th>
                <th className="py-1 hidden sm:table-cell">Huella</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.pending.map((p) => (
                <tr key={p.localId} className="text-slate-500 italic">
                  <td className="py-1.5 pr-2">…</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(p.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-1.5 pr-2">{KIND_LABEL[p.kind]}</td>
                  <td className="py-1.5 pr-2">{ACTION_LABEL[p.action]}</td>
                  <td className="py-1.5 pr-2 text-right">{p.qty}</td>
                  <td className="py-1.5 pr-2 text-right">{p.minutes}</td>
                  <td className="py-1.5 hidden sm:table-cell">pendiente</td>
                </tr>
              ))}
              {entries.map((e) => (
                <tr key={e.seq}>
                  <td className="py-1.5 pr-2 font-mono text-slate-400">{e.seq}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(e.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-1.5 pr-2">{KIND_LABEL[e.kind] || e.kind}</td>
                  <td className="py-1.5 pr-2">{ACTION_LABEL[e.action] || e.action}</td>
                  <td className="py-1.5 pr-2 text-right">{e.qty}</td>
                  <td className="py-1.5 pr-2 text-right">{e.minutes}</td>
                  <td className="py-1.5 font-mono text-[10px] text-slate-400 hidden sm:table-cell">{e.hash.slice(0, 12)}…</td>
                </tr>
              ))}
              {entries.length === 0 && c.pending.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">Todavía no hay acciones registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // sin permiso de portapapeles: igual se ve el texto para copiarlo a mano
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
    >
      <Copy className="w-3 h-3" /> {done ? 'Copiado' : 'Copiar'}
    </button>
  );
};

// WhatsApp se abre con el texto listo; la persona elige el contacto y decide si lo manda.
const WhatsAppButton: React.FC<{ text: string }> = ({ text }) => (
  <a
    href={`https://wa.me/?text=${encodeURIComponent(text)}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white"
  >
    <MessageCircle className="w-3 h-3" /> WhatsApp
  </a>
);

export const CalandriaResultModal: React.FC = () => {
  const { result, clearResult } = useCalandria();
  if (!result) return null;
  const blocks =
    result.type === 'reposicion'
      ? result.bySupplier.map((b) => ({ title: b.supplier, text: b.text }))
      : result.messages.map((m) => ({ title: m.customer, text: m.text }));

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-3">
      <div role="dialog" aria-label="Resultado de Cotorra" className="bg-white w-full max-w-lg max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <CalandriaMark className="w-7 h-8" light />
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">{result.type === 'reposicion' ? 'Pedido armado' : 'Mensajes listos'}</h3>
            <p className="text-[11px] text-slate-500">
              {result.type === 'reposicion' ? 'Copialo o mandalo a cada proveedor.' : 'Vos elegís a quién mandarlo. Al cerrar se borran: Cotorra no guarda nombres.'}
            </p>
          </div>
          <button type="button" onClick={clearResult} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {blocks.map((b, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm text-slate-900">{b.title}</div>
                <div className="flex gap-1.5">
                  <CopyButton text={b.text} />
                  <WhatsAppButton text={b.text} />
                </div>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 rounded p-2">{b.text}</pre>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
          <button type="button" onClick={clearResult} className="rounded-md bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

export const CalandriaToast: React.FC = () => {
  const { toast } = useCalandria();
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white pl-2 pr-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-semibold">
      <CalandriaMark className="w-5 h-6" />
      {toast}
    </div>
  );
};
