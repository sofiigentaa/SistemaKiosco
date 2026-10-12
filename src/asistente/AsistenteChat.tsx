import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, ArrowRight, Mic, Square } from 'lucide-react';

// Asistente guiado (hecho por tecnoros.ar).
// - Sin IA ni servicios externos: responde con reglas y con los datos que ya
//   están en pantalla. Nada de lo que se escribe sale del navegador.
// - No guarda la conversación: al cerrar o recargar, se borra.
// - Si no entiende, ofrece los temas que sabe y el contacto con soporte.

export interface Respuesta {
  texto: string;
  lineas?: string[];
  // enLugar: la acción no necesita abrir el sistema completo (p. ej. soporte o Cotorra)
  accion?: { etiqueta: string; hacer: () => void; enLugar?: boolean };
}

export interface Tema {
  id: string;
  chip?: string; // si tiene chip, aparece como botón rápido
  palabras: string[]; // alcanza con que aparezca una (se compara sin tildes)
  requiere?: string[]; // además tiene que aparecer alguna de estas (p. ej. "como")
  responder: (pregunta: string) => Respuesta | null; // null = no aplica, probar el siguiente
}

export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function puntaje(t: Tema, q: string): number {
  if (t.requiere && !t.requiere.some((w) => q.includes(w))) return 0;
  // Cada palabra encontrada suma; las más largas pesan más (son más específicas).
  return t.palabras.reduce((acc, w) => (q.includes(w) ? acc + w.length : acc), 0) + (t.requiere ? 2 : 0);
}

export function buscarRespuesta(temas: Tema[], pregunta: string): Respuesta | null {
  const q = normalizar(pregunta);
  const ordenados = temas
    .map((t) => ({ t, p: puntaje(t, q) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p);
  for (const { t } of ordenados) {
    const r = t.responder(q);
    if (r) return r;
  }
  return null;
}

interface Mensaje {
  id: number;
  de: 'persona' | 'asistente';
  r: Respuesta;
}

interface Props {
  temas: Tema[];
  saludo: string;
  soporteWhatsapp: string; // número con código de país, sin +
  soporteMensaje: string;
  colorBoton?: string; // clases de Tailwind para el botón flotante
  posicion?: string; // clases de Tailwind para ubicar el botón
  antesDeAccion?: () => void; // p. ej. pasar de la pantalla de la C al sistema completo
}

let siguienteId = 1;

// Dictado por voz con el reconocimiento del navegador (Chrome, Edge, Safari).
// Si el navegador no lo tiene, el botón del micrófono no aparece.
type Reconocedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
const crearReconocedor = (): Reconocedor | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  return C ? new C() : null;
};

// Lee la respuesta en voz alta (solo cuando la pregunta se hizo hablando).
function leer(texto: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-AR';
    const voz = synth.getVoices().find((v) => v.lang === 'es-AR') || synth.getVoices().find((v) => v.lang.startsWith('es'));
    if (voz) u.voice = voz;
    synth.speak(u);
  } catch {
    // sin voz: queda la respuesta escrita
  }
}

export const AsistenteChat: React.FC<Props> = ({
  temas,
  saludo,
  soporteWhatsapp,
  soporteMensaje,
  colorBoton = 'bg-slate-900 hover:bg-slate-800 text-white',
  posicion = 'bottom-5 right-5',
  antesDeAccion,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const recRef = useRef<Reconocedor | null>(null);
  const [hayVoz] = useState(() => typeof window !== 'undefined' && crearReconocedor() !== null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  const soporte = `https://wa.me/${soporteWhatsapp}?text=${encodeURIComponent(soporteMensaje)}`;

  useEffect(() => {
    if (abierto && mensajes.length === 0) {
      setMensajes([{ id: siguienteId++, de: 'asistente', r: { texto: saludo } }]);
    }
  }, [abierto, mensajes.length, saludo]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes]);

  const preguntar = (pregunta: string, porVoz = false) => {
    const limpia = pregunta.trim();
    if (!limpia) return;
    const r = buscarRespuesta(temas, limpia) || {
      texto: 'No estoy seguro de entender. Probá con alguno de estos temas, o escribile a soporte y te responde una persona.',
    };
    setMensajes((m) => [...m, { id: siguienteId++, de: 'persona', r: { texto: limpia } }, { id: siguienteId++, de: 'asistente', r }]);
    setTexto('');
    if (porVoz) leer([r.texto, ...(r.lineas || [])].join('. '));
  };

  const hablar = () => {
    if (escuchando) {
      recRef.current?.stop();
      return;
    }
    const rec = crearReconocedor();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = 'es-AR';
    rec.interimResults = true;
    rec.continuous = false;
    let final = '';
    rec.onresult = (e) => {
      let parcial = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else parcial += res[0].transcript;
      }
      setTexto((final + parcial).trim());
    };
    rec.onerror = (e) => {
      setAvisoVoz(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Para hablarle, permití el micrófono en el navegador.'
          : e.error === 'no-speech'
            ? 'No te escuché. Tocá el micrófono y probá de nuevo.'
            : 'No se pudo usar el micrófono. Podés escribir la pregunta.'
      );
    };
    rec.onend = () => {
      setEscuchando(false);
      if (final.trim()) preguntar(final, true);
    };
    setAvisoVoz(null);
    setEscuchando(true);
    try {
      rec.start();
    } catch {
      setEscuchando(false);
    }
  };

  useEffect(() => () => recRef.current?.stop(), []);

  const chips = temas.filter((t) => t.chip);

  return (
    <>
      {!abierto && (
        <button
          type="button"
          id="asistente-btn"
          onClick={() => setAbierto(true)}
          className={`fixed ${posicion} z-40 flex items-center gap-2 rounded-full px-4 py-3 shadow-xl text-sm font-bold cursor-pointer transition-colors ${colorBoton}`}
          aria-label="Abrir el asistente"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:inline">Asistente</span>
        </button>
      )}

      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente"
          data-testid="asistente"
          className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[380px] h-[78vh] sm:h-[560px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm leading-tight">Asistente</div>
              <div className="text-[11px] text-slate-300">Te ayudo a usar el sistema y te digo cómo vas</div>
            </div>
            <button type="button" onClick={() => setAbierto(false)} className="p-1.5 rounded hover:bg-slate-800 cursor-pointer" aria-label="Cerrar asistente">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50">
            {mensajes.map((m) =>
              m.de === 'persona' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 text-white text-sm px-3.5 py-2">{m.r.texto}</div>
                </div>
              ) : (
                <div key={m.id} className="flex">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-sm text-slate-800 px-3.5 py-2.5 space-y-1.5">
                    <p className="whitespace-pre-line">{m.r.texto}</p>
                    {m.r.lineas && m.r.lineas.length > 0 && (
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {m.r.lineas.map((l, i) => (
                          <li key={i}>• {l}</li>
                        ))}
                      </ul>
                    )}
                    {m.r.accion && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!m.r.accion!.enLugar) antesDeAccion?.();
                          m.r.accion!.hacer();
                          setAbierto(false);
                        }}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold px-2.5 py-1.5 hover:bg-cyan-100 cursor-pointer"
                      >
                        {m.r.accion.etiqueta} <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={finRef} />
          </div>

          <div className="border-t border-slate-200 bg-white">
            <div className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1.5" style={{ scrollbarWidth: 'thin' }}>
              {chips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => preguntar(t.chip!)}
                  className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 cursor-pointer"
                >
                  {t.chip}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2 px-3 pb-2"
              onSubmit={(e) => {
                e.preventDefault();
                preguntar(texto);
              }}
            >
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={escuchando ? 'Te escucho…' : hayVoz ? 'Escribí o tocá el micrófono…' : 'Escribí tu pregunta…'}
                aria-label="Tu pregunta"
                maxLength={200}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
              {hayVoz && (
                <button
                  type="button"
                  onClick={hablar}
                  data-testid="asistente-mic"
                  className={`rounded-xl p-2.5 cursor-pointer border ${escuchando ? 'bg-rose-600 border-rose-600 text-white animate-pulse' : 'bg-white border-slate-300 text-slate-700 hover:border-cyan-500'}`}
                  aria-label={escuchando ? 'Dejar de escuchar' : 'Hablar con el micrófono'}
                  title={escuchando ? 'Dejar de escuchar' : 'Hablar con el micrófono'}
                >
                  {escuchando ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button type="submit" className="rounded-xl bg-slate-900 text-white p-2.5 hover:bg-slate-800 cursor-pointer" aria-label="Enviar">
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="px-3 pb-2.5 text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>{avisoVoz || (hayVoz ? 'No guarda nada. La voz la pasa a texto tu navegador.' : 'No guarda nada de lo que escribís.')}</span>
              <a href={soporte} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline">
                Hablar con soporte
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
