// Prueba de Apps Script con un Google falso (T0479): node apps-script/probar.js apps-script/Código.js
const fs = require('fs'), vm = require('vm');
const codigo = fs.readFileSync(process.argv[2], 'utf8');
function hoja(nombre, filas) {
  const h = { nombre, filas, validacion: null };
  const celda = (r, c) => { while (h.filas.length < r) h.filas.push([]); const f = h.filas[r - 1]; while (f.length < c) f.push(''); return f; };
  h.getLastRow = () => { let n = h.filas.length; while (n && h.filas[n - 1].every(v => v === '' || v == null)) n--; return n; };
  h.getMaxColumns = () => Math.max(...h.filas.map(f => f.length), 1);
  h.insertColumnsAfter = (c, n) => { h.filas.forEach(f => { while (f.length < c + n) f.push(''); }); };
  h.insertRowAfter = r => h.filas.splice(r, 0, []);
  h.deleteRow = r => h.filas.splice(r - 1, 1);
  h.setFrozenRows = () => {};
  h.getDataRange = () => h.getRange(1, 1, h.getLastRow(), h.getMaxColumns());
  h.getRange = (r, c, nr = 1, nc = 1) => ({
    getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) f.push(((h.filas[r - 1 + i] || [])[c - 1 + j]) ?? ''); o.push(f); } return o; },
    setValues: v => v.forEach((f, i) => f.forEach((x, j) => { celda(r + i, c + j)[c - 1 + j] = x; })),
    setValue: x => { celda(r, c)[c - 1] = x; },
    getValue: () => ((h.filas[r - 1] || [])[c - 1]) ?? '',
    setNumberFormat: () => {}, getDataValidation: () => null,
    copyTo: () => {},
  });
  return h;
}
const HOY = '2026-11-13';
const hojas = {
  PERSONAS: hoja('PERSONAS', [['Id', 'Apodo', 'Jerarquia', 'Familia', 'Cama', 'Menu', 'Alergias', 'Cumple'],
    ['(A) - Abuela', 'Abuela', 'Abuelos', 'Abuelos', '', '🌕 Entero', '', ''],
    ['(T) - Mercedes', 'Mercedes', 'Tios', 'Canela', '', '🌕 Entero', '', '01/02'],
    ['(N) - Jan', 'Jan', 'Nietos', 'Canela', '', '🌕 Entero', '', ''],
    ['(O) - Amiga', 'Amiga', 'Otros', 'Otros', '', '🌕 Entero', '', '']]),
  MESA_APUNTES: hoja('MESA_APUNTES', [['ID_APUNTE', 'FECHA', 'TURNO', 'PERSONA_ID', 'CREADO_EN', 'NOTA', 'ESTADO', 'NOTA_POR', 'NOTA_EN'],
    ['a1', '2026-11-10', 'COMIDA', '(N) - Jan', '', '', '', '', ''],
    ['a2', '2026-11-13', 'CENA', '(N) - Jan', '', '', '', '', ''],
    ['a3', '2026-11-20', 'COMIDA', '(N) - Jan', '', '', '', '', ''],
    ['a4', '2026-11-20', 'COMIDA', '(T) - Mercedes', '', '', '', '', '']]),
  MESA_FIJOS: hoja('MESA_FIJOS', [['ID_FIJO', 'PERSONA_ID', 'DIA_SEMANA', 'TURNO', 'DESDE', 'HASTA', 'NOTA', 'CREADO_POR', 'CREADO_EN'],
    ['f1', '(N) - Jan', 2, 'COMIDA', '2026-10-01', '', '', '', ''],
    ['f2', '(N) - Jan', 4, 'CENA', '2026-11-20', '', '', '', '']]),
  MESA_CONFIG: hoja('MESA_CONFIG', [['CLAVE', 'VALOR'], ['FECHA_INICIO', '2026-10-01'], ['EXCLUIR_IDS', '(A) - Abuela']]),
  MESA_DIAS: hoja('MESA_DIAS', [['FECHA']]), MESA_CAMBIOS: hoja('MESA_CAMBIOS', [['CUANDO', 'QUIEN_ID', 'QUIEN', 'CAMBIO']]), MESA_ALIAS: hoja('MESA_ALIAS', [['ID_ANTIGUO', 'ID_NUEVO', 'NOTA']]),
};
const ss = { getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hoja(n, [])) };
const pad = n => String(n).padStart(2, '0');
const ctx = {
  SpreadsheetApp: { openById: () => ss, DataValidationCriteria: { VALUE_IN_LIST: 'L' } },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  ScriptApp: { getService: () => ({ getUrl: () => '' }) },
  Utilities: { getUuid: () => 'u' + Math.random().toString(36).slice(2, 8),
    formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? HOY : HOY + 'T10:00:00' },
  ContentService: {}, HtmlService: {}, console,
};
vm.createContext(ctx);
vm.runInContext(codigo + '\nthis.__ = { darDeBaja, crearPersona, getDatos };', ctx);
const R = ctx.__;
const ver = (t, ok) => { console.log((ok ? '✔ ' : '✘ ') + t); if (!ok) process.exitCode = 1; };
const V = { desde: '2026-11-09', hasta: '2026-11-22', yo: '(T) - Mercedes' };
let d = R.getDatos(V);
ver('antes: Jan sale en personas', d.personas.some(p => p.id === '(N) - Jan'));
d = R.darDeBaja('(N) - Jan', '(T) - Mercedes', V);
ver('Jan ya no sale en personas', !d.personas.some(p => p.id === '(N) - Jan'));
ver('Jan sale en bajas con fecha de hoy', d.bajas.length === 1 && d.bajas[0].id === '(N) - Jan' && d.bajas[0].baja === HOY);
ver('su comida pasada (10/11) se queda', d.apuntes.some(a => a.persona === '(N) - Jan' && a.fecha === '2026-11-10'));
ver('su cena de hoy y su comida del 20/11 se quitan', !d.apuntes.some(a => a.persona === '(N) - Jan' && a.fecha >= HOY));
ver('la comida de Mercedes del 20/11 sigue', d.apuntes.some(a => a.persona === '(T) - Mercedes' && a.fecha === '2026-11-20'));
const fj = hojas.MESA_FIJOS.filas.slice(1).filter(f => f[0]);
ver('el fijo de los martes termina ayer y el que no había empezado se borra', fj.length === 1 && fj[0][0] === 'f1' && fj[0][5] === '2026-11-12');
ver('no sale como huérfano', !d.huerfanos.includes('(N) - Jan'));
ver('columna I con título Baja', hojas.PERSONAS.filas[0][8] === 'Baja' && hojas.PERSONAS.filas[3][8] === HOY);
ver('queda en el registro de cambios', /Quita de la lista a Jan/.test(hojas.MESA_CAMBIOS.filas.slice(-1)[0][3]));
let err = ''; try { R.darDeBaja('(N) - Jan', '(T) - Mercedes', V); } catch (e) { err = e.message; }
ver('dos veces: «No encontramos…»', /No encontramos/.test(err));
err = ''; try { R.darDeBaja('(T) - Mercedes', '', V); } catch (e) { err = e.message; }
ver('sin decir quién eres: pide elegir', /Elige primero/.test(err));
err = ''; try { R.darDeBaja('(A) - Abuela', '(T) - Mercedes', V); } catch (e) { err = e.message; }
ver('a la abuela no se la puede quitar', /No encontramos/.test(err));
const filas = hojas.PERSONAS.filas.length;
d = R.crearPersona({ apodo: 'Jan', jerarquia: 'Nietos', familia: 'Canela', menu: '🌕 Entero', alergias: 'Nueces', cumple: '05/06' }, '(T) - Mercedes', V);
ver('volver a añadir a Jan recupera su fila', hojas.PERSONAS.filas.length === filas && d.personas.some(p => p.id === '(N) - Jan' && p.alergias === 'Nueces' && p.cumple === '05/06') && !d.bajas.length && d.creado === '(N) - Jan');
ver('su comida pasada sigue siendo suya', d.apuntes.some(a => a.persona === '(N) - Jan' && a.fecha === '2026-11-10'));
