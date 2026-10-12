import React, { useEffect } from 'react';
import { Check, X, Share2, Printer, ArrowUpRight, ChevronRight } from 'lucide-react';
import { formatMinutes, useCalandria, CalandriaResult } from './CalandriaContext';
import { CalandriaMark, KIND_LABEL } from './CalandriaUI';

// Pantalla principal: la G de Golondrina y nada más.
// - Tocar la G (o el botón físico / F9) aprueba la primera notificación.
// - Las notificaciones son las tareas que Golondrina propone.
// - Compartir e Imprimir sacan el resumen del día y lo que preparó Golondrina.
// - "Abrir sistema" lleva al sistema completo (vender, cargar, etc.).

export interface ResumenSeccion {
  titulo: string;
  lineas: string[];
  pendientes?: number; // cuántas cosas para revisar (eventos con saldo, tareas de hoy, productos a reponer…)
  ver?: () => void; // lleva a la pantalla donde se ven en detalle
}

interface Props {
  negocio: string; // va en el encabezado de lo que se comparte / imprime
  resumen: () => ResumenSeccion[];
  onOpenSystem: () => void;
}

function seccionesPreparadas(r: CalandriaResult | null): ResumenSeccion[] {
  if (!r) return [];
  if (r.type === 'reposicion')
    return r.bySupplier.map((b) => ({
      titulo: `Pedido para ${b.supplier}`,
      lineas: b.text.split('\n').filter((l) => l.startsWith('•')).map((l) => l.replace(/^•\s*/, '')),
    }));
  return [{ titulo: 'Recordatorios de fiado', lineas: r.messages.map((m) => m.text) }];
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const CalandriaHome: React.FC<Props> = ({ negocio, resumen, onOpenSystem }) => {
  const c = useCalandria();
  const first = c.suggestions[0];

  useEffect(() => {
    c.setHomeActive(true);
    return () => c.setHomeActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fecha = f.charAt(0).toUpperCase() + f.slice(1);

  // Lo que Golondrina hizo hoy (sale del registro: sin datos de clientes).
  const hoy = new Date().toDateString();
  const hechasHoy = c.log.filter((e) => e.action === 'aprobada' && new Date(e.at).toDateString() === hoy);
  const calandriaHoy: ResumenSeccion = {
    titulo: 'Golondrina hoy',
    lineas: hechasHoy.length
      ? [...hechasHoy.map((e) => `${KIND_LABEL[e.kind] || e.kind}: ${e.qty}`), `Tiempo ahorrado este mes: ${formatMinutes(c.minutesThisMonth)} (estimado)`]
      : ['Todavía no se aprobó ninguna tarea hoy.'],
  };

  calandriaHoy.ver = () => {
    c.refreshLog();
    c.setLogOpen(true);
  };

  const armarSecciones = () => [...resumen(), calandriaHoy, ...seccionesPreparadas(c.lastResult)];

  // Informe en pantalla: lo mismo que se imprime, pero cada parte lleva a su detalle.
  const informe = [...resumen(), calandriaHoy];
  const totalPendientes = informe.reduce((a, x) => a + (x.pendientes || 0), 0);

  const compartir = async () => {
    const secciones = armarSecciones();
    const texto = [`${negocio} · ${fecha}`, '', ...secciones.flatMap((s) => [`*${s.titulo}*`, ...s.lineas.map((l) => `• ${l}`), '']), 'Golondrina · una solución de tecnoros.ar'].join('\n');
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: `Resumen · ${negocio}`, text: texto });
        return;
      } catch {
        // cancelado o no disponible: se ofrece WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  };

  const imprimir = () => {
    const secciones = armarSecciones();
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen · ${escapar(negocio)}</title>
      <style>body{font-family:system-ui,sans-serif;color:#0B1220;margin:32px;max-width:720px}h1{font-size:20px;margin:0}
      .f{color:#475569;font-size:13px;margin:4px 0 20px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #CBD5E1;padding-bottom:4px}
      li{font-size:13px;margin:3px 0;white-space:pre-wrap}footer{margin-top:28px;font-size:11px;color:#64748B;border-top:1px solid #E2E8F0;padding-top:8px}</style></head>
      <body><h1>${escapar(negocio)}</h1><div class="f">${escapar(fecha)}</div>
      ${secciones.map((s) => `<h2>${escapar(s.titulo)}</h2><ul>${s.lineas.map((l) => `<li>${escapar(l)}</li>`).join('')}</ul>`).join('')}
      <footer>Golondrina · una solución de tecnoros<span style="color:#06B6D4">.ar</span></footer></body></html>`;
    // iframe oculto: imprime sin abrir otra pestaña
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    }, 200);
  };

  // "Todo en orden" solo si no hay nada para aprobar NI nada pendiente para revisar.
  const estado = c.paused
    ? 'En pausa'
    : first
      ? 'Tocá la G para aprobar la primera'
      : totalPendientes > 0
        ? `Nada para aprobar · ${totalPendientes} ${totalPendientes === 1 ? 'cosa' : 'cosas'} para revisar abajo`
        : 'Todo en orden';
  const anillo = c.paused
    ? 'shadow-[0_0_0_10px_rgba(148,163,184,0.15)]'
    : first
      ? 'shadow-[0_0_0_10px_rgba(251,191,36,0.25),0_0_60px_rgba(251,191,36,0.35)] animate-[cal-pulso_2.2s_ease-in-out_infinite] motion-reduce:animate-none'
      : totalPendientes > 0
        ? 'shadow-[0_0_0_10px_rgba(34,211,238,0.22),0_0_60px_rgba(34,211,238,0.3)]'
        : 'shadow-[0_0_0_10px_rgba(52,211,153,0.18),0_0_60px_rgba(34,211,238,0.25)]';

  return (
    <div
      data-testid="calandria-home"
      className="min-h-screen flex flex-col text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 25%, #10314a 0%, #070A12 60%)' }}
    >
      <style>{'@keyframes cal-pulso{0%,100%{opacity:.55}50%{opacity:1}}'}</style>
      <div className="flex justify-end px-4 sm:px-6 pt-4">
        <button
          type="button"
          id="abrir-sistema"
          onClick={onOpenSystem}
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
        >
          Abrir sistema <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <main className="flex-1 w-full max-w-md mx-auto px-4 flex flex-col items-center">
        <button
          type="button"
          data-testid="calandria-c"
          onClick={() => (first && !c.paused ? c.approve(first) : undefined)}
          aria-label={first ? `Aprobar: ${first.title}` : 'Golondrina'}
          className="relative mt-6 sm:mt-10 rounded-[2.5rem] p-5 transition-transform active:scale-95 cursor-pointer"
        >
          <span aria-hidden="true" className={`absolute inset-0 rounded-[2.5rem] ${anillo}`} />
          <CalandriaMark className="relative w-32 h-[148px] sm:w-40 sm:h-[184px]" />
        </button>
        <p className="mt-5 text-sm font-semibold text-slate-300">{estado}</p>
        <button
          type="button"
          onClick={() => c.setPanelOpen(true)}
          className="mt-1 text-[11px] text-cyan-300/80 hover:text-cyan-200 cursor-pointer"
          data-testid="calandria-minutes"
        >
          {formatMinutes(c.minutesThisMonth)} ahorrados este mes
        </button>

        {/* Notificaciones */}
        <section className="w-full mt-7 space-y-2.5" aria-label="Notificaciones">
          {!c.paused &&
            c.suggestions.map((s, i) => (
              <div
                key={s.key}
                data-testid="calandria-suggestion"
                className={`rounded-2xl border px-4 py-3 backdrop-blur-sm ${i === 0 ? 'border-amber-300/50 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{s.title}</div>
                    <div className="text-xs text-slate-300 mt-0.5 line-clamp-2">{s.lines.slice(0, 2).join(' · ')}{s.lines.length > 2 ? ` · y ${s.lines.length - 2} más` : ''}</div>
                    <div className="text-[10px] text-cyan-300 mt-1">ahorra ~{s.minutes} min</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => c.approve(s)}
                      aria-label={`Aprobar: ${s.title}`}
                      className="w-9 h-9 rounded-full bg-cyan-400 text-slate-900 hover:bg-cyan-300 flex items-center justify-center cursor-pointer"
                    >
                      <Check className="w-4.5 h-4.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => c.dismiss(s)}
                      aria-label={`Ahora no: ${s.title}`}
                      className="w-9 h-9 rounded-full bg-white/10 text-slate-300 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          {c.paused && <p className="text-center text-xs text-slate-400">Golondrina está en pausa. Tocá “ahorrados este mes” para reanudarla.</p>}
        </section>

        {/* Informe de hoy: cada parte lleva a su detalle */}
        <section className="w-full mt-7" aria-label="Hoy" data-testid="calandria-informe">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Hoy</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10 overflow-hidden">
            {informe.map((sec) => (
              <button
                key={sec.titulo}
                type="button"
                onClick={sec.ver}
                disabled={!sec.ver}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    {sec.titulo}
                    {!!sec.pendientes && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-cyan-400 text-slate-900 text-[11px] font-black flex items-center justify-center">
                        {sec.pendientes}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 truncate">{sec.lineas.slice(0, 2).join(' · ')}</div>
                </div>
                {sec.ver && (
                  <span className="shrink-0 flex items-center text-xs font-semibold text-cyan-300">
                    Ver <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        <div className="w-full mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={compartir}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 py-3 text-sm font-bold cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> Compartir
          </button>
          <button
            type="button"
            onClick={imprimir}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 py-3 text-sm font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </main>

      <footer className="pt-6 pb-24 sm:pb-8 text-center">
        <a href="https://tecnoros-ar.onrender.com" target="_blank" rel="noopener noreferrer" className="text-sm tracking-wide text-slate-400 hover:text-white">
          una solución de <span className="font-bold text-slate-300">tecnoros<span className="text-cyan-400">.ar</span></span>
        </a>
      </footer>
    </div>
  );
};
