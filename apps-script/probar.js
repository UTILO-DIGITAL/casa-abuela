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
    setValues: v => { v.forEach((f, i) => f.forEach((x, j) => { celda(r + i, c + j)[c - 1 + j] = x; })); h.formula && h.formula(); },
    setValue: x => { celda(r, c)[c - 1] = x; h.formula && h.formula(); },
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
// La columna A de PERSONAS es una fórmula: «(» + inicial de la jerarquía + «+1» si la lleva + «) - » + apodo
hojas.PERSONAS.formula = () => hojas.PERSONAS.filas.slice(1).forEach(f => { if (f[1]) f[0] = '(' + String(f[2]).charAt(0) + (String(f[2]).indexOf('+1') !== -1 ? '+1' : '') + ') - ' + f[1]; });
hojas.PERSONAS.filas.push(['(T+1) - Jordi', 'Jordi', 'Tios +1', 'Canela', '', '🌕 Entero', '', '']);
const ss = { getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hoja(n, [])) };
const pad = n => String(n).padStart(2, '0');
const ctx = {
  SpreadsheetApp: { openById: () => ss, flush: () => {}, DataValidationCriteria: { VALUE_IN_LIST: 'L' } },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  ScriptApp: { getService: () => ({ getUrl: () => '' }) },
  Utilities: { getUuid: () => 'u' + Math.random().toString(36).slice(2, 8),
    formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? HOY : HOY + 'T10:00:00' },
  ContentService: {}, HtmlService: {}, console,
};
vm.createContext(ctx);
vm.runInContext(codigo + '\nthis.__ = { darDeBaja, crearPersona, getDatos, guardarPersona };', ctx);
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

// ---------- v4.10: núcleos familiares ----------
const M_ = '(T) - Mercedes', J_ = '(T+1) - Jordi', N_ = '(N) - Jan';
const quien = id => d.personas.concat(d.editores).find(p => p.id === id) || {};
const col = (id, c) => (hojas.PERSONAS.filas.find(f => f[0] === id) || [])[c - 1];
d = R.guardarPersona(M_, { apellido: 'Canela', sexo: 'Mujer', pareja: J_ }, M_, V);
ver('apellido y mujer de Mercedes', quien(M_).apellido === 'Canela' && quien(M_).sexo === 'Mujer');
ver('pareja en los dos sentidos', quien(M_).pareja === J_ && quien(J_).pareja === M_);
ver('títulos J-M', ['Apellido', 'Sexo', 'Pareja', 'Hijo de'].every((t, i) => hojas.PERSONAS.filas[0][9 + i] === t));
d = R.guardarPersona(N_, { hijoDe: M_ }, M_, V);
ver('Jan es hijo de Mercedes', quien(N_).hijoDe === M_);
err = ''; try { R.guardarPersona(M_, { hijoDe: N_ }, M_, V); } catch (e) { err = e.message; }
ver('Mercedes no puede ser hija de Jan (círculo)', /ya desciende/.test(err));
err = ''; try { R.guardarPersona(M_, { pareja: M_ }, M_, V); } catch (e) { err = e.message; }
ver('nadie es su propia pareja', /propia pareja/.test(err));
err = ''; try { R.guardarPersona(M_, { sexo: 'Otro' }, M_, V); } catch (e) { err = e.message; }
ver('sexo solo Hombre o Mujer', /hombre o mujer/.test(err));
d = R.guardarPersona('(O) - Amiga', { pareja: J_ }, M_, V);
ver('si Jordi pasa a tener otra pareja, Mercedes se queda sin', quien(J_).pareja === '(O) - Amiga' && !quien(M_).pareja && quien('(O) - Amiga').pareja === J_);
d = R.guardarPersona(J_, { pareja: M_ }, M_, V);
ver('y al volver, la Amiga se queda sin pareja', quien(J_).pareja === M_ && quien(M_).pareja === J_ && !quien('(O) - Amiga').pareja);
d = R.guardarPersona('(A) - Abuela', { apellido: 'Canela' }, M_, V);
ver('la abuela también puede tener apellido', quien('(A) - Abuela').apellido === 'Canela');
d = R.guardarPersona(M_, { hijoDe: '(A) - Abuela' }, M_, V);
ver('Mercedes, hija de la abuela', quien(M_).hijoDe === '(A) - Abuela');
d = R.crearPersona({ apodo: 'Laura', jerarquia: 'Nietos', familia: 'Canela', apellido: 'López', sexo: 'Mujer', pareja: N_ }, M_, V);
ver('persona nueva con apellido y pareja', quien('(N) - Laura').apellido === 'López' && quien('(N) - Laura').pareja === N_ && quien(N_).pareja === '(N) - Laura');
d = R.guardarPersona(J_, { apodo: 'Jordi P' }, M_, V);
ver('si Jordi cambia de nombre, su pareja y sus referencias le siguen', quien(M_).pareja === '(T+1) - Jordi P' && quien('(T+1) - Jordi P').pareja === M_);
ver('queda en el registro', hojas.MESA_CAMBIOS.filas.some(f => /son pareja/.test(f[3])) && hojas.MESA_CAMBIOS.filas.some(f => /es hijo o hija de/.test(f[3])));

// ---------- v4.11: nombre y apodo único ----------
d = R.guardarPersona(M_, { nombre: 'Mercedes', apellido: 'Ribas' }, M_, V);
ver('nombre de verdad y título N', quien(M_).nombre === 'Mercedes' && hojas.PERSONAS.filas[0][13] === 'Nombre');
err = ''; try { R.crearPersona({ apodo: 'mercedes', jerarquia: 'Nietos', familia: 'Canela' }, M_, V); } catch (e) { err = e.message; }
ver('no se puede añadir otro apodo «mercedes» (aunque sea otra jerarquía y en minúsculas)', /no se puede repetir/.test(err));
err = ''; try { R.crearPersona({ apodo: 'Jordí P', jerarquia: 'Nietos', familia: 'Canela' }, M_, V); } catch (e) { err = e.message; }
ver('ni «Jordí P» con acento si ya está «Jordi P»', /no se puede repetir/.test(err));
err = ''; try { R.guardarPersona('(O) - Amiga', { apodo: 'Jan' }, M_, V); } catch (e) { err = e.message; }
ver('ni cambiar un apodo a uno que ya existe', /no se puede repetir/.test(err));
d = R.guardarPersona('(O) - Amiga', { apodo: 'Amiga M' }, M_, V);
ver('cambiar a un apodo libre, sí', !!d.personas.find(p => p.id === '(O) - Amiga M'));
d = R.darDeBaja('(O) - Amiga M', M_, V);
err = ''; try { R.crearPersona({ apodo: 'Amiga M', jerarquia: 'Nietos', familia: 'Canela' }, M_, V); } catch (e) { err = e.message; }
ver('el apodo de alguien de baja tampoco se reutiliza con otro parentesco', /no se puede repetir/.test(err));
d = R.crearPersona({ apodo: 'Amiga M', jerarquia: 'Otros', familia: 'Otros', nombre: 'Ana' }, M_, V);
ver('pero se recupera con el mismo parentesco, con su nombre', !!d.personas.find(p => p.id === '(O) - Amiga M' && p.nombre === 'Ana'));

// ---------- v4.12: casados ----------
d = R.guardarPersona(M_, { casados: 'Sí' }, M_, V);
ver('Mercedes y Jordi P, casados (en los dos)', quien(M_).casados === 'Sí' && quien('(T+1) - Jordi P').casados === 'Sí' && hojas.PERSONAS.filas[0][14] === 'Casados');
err = ''; try { R.guardarPersona('(N) - Laura', { pareja: '', casados: 'Sí' }, M_, V); } catch (e) { err = e.message; }
ver('sin pareja no se puede estar casado', /elige primero su pareja/.test(err));
err = ''; try { R.guardarPersona(M_, { casados: 'Quizá' }, M_, V); } catch (e) { err = e.message; }
ver('casados solo Sí o No', /sí o no/.test(err));
d = R.guardarPersona(M_, { pareja: '(N) - Lucía'.replace('Lucía', 'Laura') }, M_, V);
ver('al cambiar de pareja, «casados» se borra en los tres', !quien(M_).casados && !quien('(T+1) - Jordi P').casados && !quien('(N) - Laura').casados && quien(M_).pareja === '(N) - Laura');
d = R.guardarPersona(M_, { pareja: '(T+1) - Jordi P', casados: 'No' }, M_, V);
ver('pareja y «no casados» en el mismo guardado', quien(M_).pareja === '(T+1) - Jordi P' && quien(M_).casados === 'No' && quien('(T+1) - Jordi P').casados === 'No');
