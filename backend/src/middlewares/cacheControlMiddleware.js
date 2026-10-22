/**
 * Middleware de Control de Caché HTTP (Zero Cache / Anti-Bfcache)
 * Inyecta cabeceras de no-almacenamiento estricto en rutas protegidas y APIs
 * para evitar que tras hacer logout se pueda usar el botón "Atrás" del navegador
 * y visualizar interfaces o datos clínicos previamente consultados.
 */
function prevenirCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
}

module.exports = {
  prevenirCache
};
