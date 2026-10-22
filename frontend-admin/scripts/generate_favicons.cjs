const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const favicons = {
  // 1. CLÍNICA (Landing Web / Portal Principal) - Pie Esmeralda Elite con Medalla de Cruz Médica
  'favicon-clinica.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pClinica" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="fShadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#022c22" flood-opacity="0.3" />
    </filter>
  </defs>

  <g filter="url(#fShadow)">
    <!-- Dedos del pie en arco armónico -->
    <circle cx="16" cy="10" r="5.5" fill="url(#pClinica)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pClinica)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pClinica)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pClinica)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pClinica)" />

    <!-- Planta y talón del pie -->
    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pClinica)" />
  </g>

  <!-- Medalla circular blanca con Cruz Médica (Sello oficial Elite Foot Care) -->
  <g filter="url(#fShadow)">
    <circle cx="44" cy="44" r="13.5" fill="#ffffff" stroke="#059669" stroke-width="2.5" />
    <rect x="40.5" y="36" width="7" height="16" rx="2.5" fill="#ef4444" />
    <rect x="36" y="40.5" width="16" height="7" rx="2.5" fill="#ef4444" />
    <circle cx="44" cy="44" r="1.5" fill="#ffffff" />
  </g>
</svg>`,

  // 2. PODÓLOGO (Consultorio Especialista) - Pie Azul Quirúrgico con Bisturí Podológico
  'favicon-podologo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pPodo" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <linearGradient id="pBlade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="60%" stop-color="#e2e8f0" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
    <filter id="fShadowPodo" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#082f49" flood-opacity="0.3" />
    </filter>
  </defs>

  <g filter="url(#fShadowPodo)">
    <circle cx="16" cy="10" r="5.5" fill="url(#pPodo)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pPodo)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pPodo)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pPodo)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pPodo)" />

    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pPodo)" />
  </g>

  <!-- Bisturí Podológico Quirúrgico de Precisión tratando la zona -->
  <g filter="url(#fShadowPodo)">
    <!-- Mango ergonómico -->
    <path d="M 60 25 L 43 42 L 37 36 L 54 19 Z" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" />
    <line x1="52" y1="23" x2="48" y2="27" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" />
    <line x1="56" y1="27" x2="52" y2="31" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" />
    <!-- Hoja afilada de bisturí -->
    <path d="M 43 42 L 27 52 C 25.5 53, 24.5 51.5, 26 50 L 37 36 Z" fill="url(#pBlade)" stroke="#ffffff" stroke-width="1.2" />
    <circle cx="27" cy="51" r="2.2" fill="#ffffff" />
  </g>
</svg>`,

  // 3. ADMIN (Consola de Dirección & RBAC) - Pie Índigo Real con Escudo & Estrella Dorada
  'favicon-admin.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pAdmin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="pGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="fShadowAdmin" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#1e1b4b" flood-opacity="0.35" />
    </filter>
  </defs>

  <g filter="url(#fShadowAdmin)">
    <circle cx="16" cy="10" r="5.5" fill="url(#pAdmin)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pAdmin)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pAdmin)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pAdmin)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pAdmin)" />

    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pAdmin)" />
  </g>

  <!-- Escudo Blindado RBAC con Estrella Dorada -->
  <g filter="url(#fShadowAdmin)">
    <path d="M 44 30 L 58 35 C 58 48, 51 57, 44 60 C 37 57, 30 48, 30 35 Z" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5" />
    <path d="M 44 33.5 L 55 37.5 C 55 47, 49 54, 44 57 C 39 54, 33 47, 33 37.5 Z" fill="#312e81" />
    <polygon points="44,39 45.8,44 51,44 46.8,47 48.5,52 44,48.8 39.5,52 41.2,47 37,44 42.2,44" fill="url(#pGold)" />
  </g>
</svg>`,

  // 4. RECEPCIÓN (Citas y Turnos) - Pie Naranja Coral con Calendario de Citas & Reloj
  'favicon-recepcion.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pRecep" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="50%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
    <filter id="fShadowRec" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#7c2d12" flood-opacity="0.3" />
    </filter>
  </defs>

  <g filter="url(#fShadowRec)">
    <circle cx="16" cy="10" r="5.5" fill="url(#pRecep)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pRecep)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pRecep)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pRecep)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pRecep)" />

    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pRecep)" />
  </g>

  <!-- Calendario y Reloj de Citas Médicas Agendadas -->
  <g filter="url(#fShadowRec)">
    <rect x="31" y="33" width="26" height="26" rx="5" fill="#ffffff" stroke="#c2410c" stroke-width="2" />
    <path d="M 31 38 C 31 35.2 33.2 33 36 33 H 52 C 54.8 33 57 35.2 57 38 V 40 H 31 Z" fill="#ea580c" />
    <rect x="36" y="30.5" width="3" height="5" rx="1.5" fill="#ffffff" stroke="#c2410c" stroke-width="1" />
    <rect x="49" y="30.5" width="3" height="5" rx="1.5" fill="#ffffff" stroke="#c2410c" stroke-width="1" />
    <circle cx="44" cy="48" r="6.5" fill="#fff7ed" stroke="#ea580c" stroke-width="1.8" />
    <line x1="44" y1="48" x2="44" y2="44.5" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round" />
    <line x1="44" y1="48" x2="47.5" y2="48" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round" />
    <circle cx="44" cy="48" r="1.2" fill="#ea580c" />
  </g>
</svg>`,

  // 5. LOGIN (Portal de Acceso) - Pie Carbón/Titanio con Candado de Seguridad
  'favicon-login.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pLog" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="50%" stop-color="#334155" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <filter id="fShadowLog" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#0f172a" flood-opacity="0.35" />
    </filter>
  </defs>

  <g filter="url(#fShadowLog)">
    <circle cx="16" cy="10" r="5.5" fill="url(#pLog)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pLog)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pLog)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pLog)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pLog)" />

    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pLog)" />
  </g>

  <!-- Candado de Seguridad de Acceso -->
  <g filter="url(#fShadowLog)">
    <!-- Arco del candado -->
    <path d="M 38 37 V 32 C 38 27.5 41 24 45 24 C 49 24 52 27.5 52 32 V 37" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
    <!-- Cuerpo del candado -->
    <rect x="34" y="36" width="22" height="20" rx="4.5" fill="#ffffff" stroke="#0ea5e9" stroke-width="2" />
    <rect x="36" y="38" width="18" height="16" rx="3.5" fill="#0f172a" />
    <!-- Cruz / cerradura médica menta -->
    <rect x="43.5" y="42" width="3" height="8" rx="1" fill="#10b981" />
    <rect x="41" y="44.5" width="8" height="3" rx="1" fill="#10b981" />
  </g>
</svg>`,

  // 6. CAJA (Cobros y Facturación) - Pie Menta con Tarjeta y Moneda de Oro
  'favicon-caja.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pCaja" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="fShadowCaja" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#064e3b" flood-opacity="0.3" />
    </filter>
  </defs>

  <g filter="url(#fShadowCaja)">
    <circle cx="16" cy="10" r="5.5" fill="url(#pCaja)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pCaja)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pCaja)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pCaja)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pCaja)" />

    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pCaja)" />
  </g>

  <!-- Tarjeta y Moneda de Pagos -->
  <g filter="url(#fShadowCaja)">
    <rect x="30" y="34" width="26" height="17" rx="3.5" fill="#ffffff" stroke="#047857" stroke-width="1.8" />
    <rect x="30" y="38" width="26" height="4" fill="#047857" />
    <!-- Moneda de oro -->
    <circle cx="46" cy="50" r="8.5" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />
    <text x="46" y="54" font-size="10" font-family="sans-serif" font-weight="900" fill="#ffffff" text-anchor="middle">$</text>
  </g>
</svg>`,

  // 7. INVENTARIO (Suministros) - Pie Azul Cobalto con Caja Médica
  'favicon-inventario.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="pInv" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <filter id="fShadowInv" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#1e3a8a" flood-opacity="0.3" />
    </filter>
  </defs>

  <g filter="url(#fShadowInv)">
    <circle cx="16" cy="10" r="5.5" fill="url(#pInv)" />
    <circle cx="26" cy="8" r="4.6" fill="url(#pInv)" />
    <circle cx="35" cy="10.5" r="3.9" fill="url(#pInv)" />
    <circle cx="42.5" cy="15" r="3.2" fill="url(#pInv)" />
    <circle cx="48.5" cy="21" r="2.6" fill="url(#pInv)" />

    <path d="M 16 19
             C 14 19, 44 19, 45 25
             C 45 32, 39 37, 38 42
             C 37 47, 39 52, 40 55
             C 40 60, 36 62, 30 62
             C 24 62, 20 59, 20 54
             C 20 48, 23 41, 23 35
             C 23 29, 17 25, 16 19 Z" 
          fill="url(#pInv)" />
  </g>

  <!-- Caja de Suministros Médicos -->
  <g filter="url(#fShadowInv)">
    <rect x="32" y="36" width="24" height="20" rx="4" fill="#ffffff" stroke="#1d4ed8" stroke-width="2" />
    <rect x="34" y="38" width="20" height="16" rx="3" fill="#2563eb" />
    <!-- Cruz blanca en la caja -->
    <rect x="42.5" y="41.5" width="3" height="9" rx="1" fill="#ffffff" />
    <rect x="39.5" y="44.5" width="9" height="3" rx="1" fill="#ffffff" />
  </g>
</svg>`
};

const projectRoot = path.resolve(__dirname, '../../');
const targetDirs = [
  path.join(projectRoot, 'frontend-admin/assets/icons'),
  path.join(projectRoot, 'frontend-landing/src/assets/icons'),
  path.join(projectRoot, 'frontend-landing/public/assets/icons')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const [filename, content] of Object.entries(favicons)) {
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, content.trim());
    console.log('Guardando SVG:', fullPath);

    // Convertir a PNG nítido de 128x128 con qlmanage
    execSync('qlmanage -t -s 128 -o "' + dir + '" "' + fullPath + '"');
    const genPng = path.join(dir, filename + '.png');
    const targetPng = path.join(dir, filename.replace('.svg', '.png'));
    if (fs.existsSync(genPng)) {
      fs.renameSync(genPng, targetPng);
      console.log('Guardando PNG:', targetPng);
    }
  }
}

// Actualizar copias en raíz
const landingDir = path.join(projectRoot, 'frontend-landing/src');
const adminDir = path.join(projectRoot, 'frontend-admin');

fs.writeFileSync(path.join(landingDir, 'favicon.svg'), favicons['favicon-clinica.svg'].trim());
fs.writeFileSync(path.join(adminDir, 'favicon.svg'), favicons['favicon-clinica.svg'].trim());

fs.copyFileSync(path.join(landingDir, 'assets/icons/favicon-clinica.png'), path.join(landingDir, 'favicon.png'));
fs.copyFileSync(path.join(adminDir, 'assets/icons/favicon-clinica.png'), path.join(adminDir, 'favicon.png'));
fs.copyFileSync(path.join(landingDir, 'assets/icons/favicon-clinica.png'), path.join(landingDir, 'favicon.ico'));
fs.copyFileSync(path.join(adminDir, 'assets/icons/favicon-clinica.png'), path.join(adminDir, 'favicon.ico'));

console.log('✅ Todos los favicons de Elite Foot Care han sido actualizados con éxito.');
