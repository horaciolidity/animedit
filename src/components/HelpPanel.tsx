import { useState } from 'react';

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  const steps: { title: string; body: string }[] = [
    {
      title: 'Bienvenido',
      body:
        'Esta es tu área de dibujo. Usa el <b>Pincel (B)</b> para dibujar, el <b>Borrador (E)</b> para borrar y <b>Mover (V)</b> para repositionar capas. Dibujar en un fotograma crea un trazo en esa capa y fotograma.',
    },
    {
      title: 'Línea de tiempo y exposición',
      body:
        'Cada fila es una capa y cada columna es un fotograma. Haz clic en una celda para elegir el fotograma actual. Si dibujas en un fotograma que está "dentro" de la exposición de otro, se edita el dibujo fuente. Usa <b>Limpiar</b> para vaciar el fotograma actual.',
    },
    {
      title: 'Animación por fotogramas clave',
      body:
        'Activa la animación de una capa agregando fotogramas clave en Propiedades. Entre dos claves la capa se interpola automáticamente. Puedes cambiar el tipo de interpolación (lineal, acelerar, desacelerar, suave, escalonado).',
    },
    {
      title: 'Gizmo de transformación',
      body:
        'Con la herramienta <b>Mover (V)</b> aparece un recuadro alrededor del dibujo de la capa. Arrastra el centro para mover, las esquinas para escalar y el círculo superior para rotar. Todo se guarda como animación si hay fotogramas clave.',
    },
    {
      title: 'Cámara virtual',
      body:
        'La cámara mueve toda la escena como si fuera un encuadre real. Agrégale fotogramas clave en Propiedades → Cámara para hacer acercamientos, viajadas o rotaciones de cámara.',
    },
    {
      title: 'Paleta de colores',
      body:
        'Los colores se guardan en la paleta del proyecto. Haz clic en un muestrario para usarlo, o usa el botón <b>+</b> para guardar el color actual. Así mantienes la consistencia entre escenas.',
    },
    {
      title: 'Reproducción y exportación',
      body:
        'Presiona <b>Espacio</b> para reproducir. Define <b>Desde</b> y <b>Hasta</b> para repetir solo un rango. Usa <b>Exportar PNG</b> (frame actual) o <b>Exportar WebM</b> (video de la escena).',
    },
    {
      title: 'Atajos rápidos',
      body:
        '<b>B</b> Pincel · <b>E</b> Borrador · <b>L</b> Línea · <b>R</b> Rectángulo · <b>O</b> Elipse · <b>V</b> Mover · <b>Espacio</b> Reproducir · <b>+</b> / <b>-</b> Zoom · <b>0</b> Reset vista · <b>Home/End</b> Primer/Último frame · <b>Ctrl+Z</b> Deshacer · <b>Ctrl+Shift+Z</b> Rehacer',
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <div className="help-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="help-backdrop" onClick={onClose} />
      <div className="help-panel">
        <div className="help-header">
          <h2>{current.title}</h2>
          <button className="help-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="help-body">
          <div dangerouslySetInnerHTML={{ __html: current.body }} />
        </div>
        <div className="help-footer">
          <span className="help-counter">{step + 1} / {steps.length}</span>
          <div className="help-nav">
            <button
              className="help-nav-btn"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Anterior
            </button>
            <button
              className="help-nav-btn"
              onClick={isLast ? onClose : () => setStep((s) => Math.min(steps.length - 1, s + 1))}
            >
              {isLast ? 'Cerrar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
