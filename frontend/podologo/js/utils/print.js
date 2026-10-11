/**
 * Impresión / exportación a PDF mediante un iframe aislado (sandbox sin scripts).
 * El navegador permite "Guardar como PDF" desde el diálogo de impresión.
 */
export function printHtml(htmlDocument) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-modals allow-same-origin'); // sin allow-scripts: el contenido no puede ejecutar JS
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = htmlDocument;
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } finally {
        setTimeout(() => {
          frame.remove();
          resolve(true);
        }, 1500);
      }
    });
    document.body.appendChild(frame);
  });
}
