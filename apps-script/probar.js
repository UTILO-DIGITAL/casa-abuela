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
    setValues: v => {
      // Como el Google de verdad: el ancho de los datos tiene que ser el del intervalo
      if (v.length !== nr || v.some(f => f.length !== nc)) throw new Error('El número de columnas de los datos no coincide con el del intervalo. Los datos tienen ' + (v[0] || []).length + ' y el intervalo, ' + nc + '.');
      v.forEach((f, i) => f.forEach((x, j) => { celda(r + i, c + j)[c - 1 + j] = x; })); h.formula && h.formula();
    },
    setValue: x => { celda(r, c)[c - 1] = x; h.formula && h.formula(); },
    getValue: () => ((h.filas[r - 1] || [])[c - 1]) ?? '',
    setNumberFormat: () => { if (h.tabla && nc > 1) throw new Error('Haz una selección en una sola columna para realizar acciones a nivel de columna.'); },
    getDataValidation: () => null,
    getSheet: () => h, getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
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
  ContentService: { createTextOutput: x => ({ setMimeType: () => JSON.parse(x) }), MimeType: { JSON: 'json' } }, HtmlService: {}, console,
};
vm.createContext(ctx);
vm.runInContext(codigo + '\nthis.__ = { darDeBaja, crearPersona, getDatos, guardarPersona, guardarEvento, borrarEvento, apuntarEvento, api_ };', ctx);
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

// ---------- v4.21: noviazgo y boda ----------
d = R.guardarPersona(M_, { casados: 'Sí', novios: '1980', boda: '12/06/1985' }, M_, V);
ver('novios y boda, en los dos', quien(M_).novios === '00/00/1980' && quien('(T+1) - Jordi P').novios === '00/00/1980' && quien(M_).boda === '12/06/1985' && quien('(T+1) - Jordi P').boda === '12/06/1985');
ver('con sus títulos en el Excel', hojas.PERSONAS.filas[0][16] === 'Novios desde' && hojas.PERSONAS.filas[0][17] === 'Boda');
d = R.guardarPersona('(T+1) - Jordi P', { novios: '03/1980' }, M_, V);
ver('se cambia desde cualquiera de los dos', quien(M_).novios === '00/03/1980');
err = ''; try { R.guardarPersona(M_, { boda: '31/02/1985' }, M_, V); } catch (e) { err = e.message; }
ver('una boda que no existe no se guarda', /la boda/.test(err));
d = R.guardarPersona(M_, { boda: '20/06/2030' }, M_, V);
ver('una boda que viene, también', quien(M_).boda === '20/06/2030');
d = R.guardarPersona(M_, { boda: '04/10' }, M_, V);
ver('v4.30: una boda sin año, en los dos', quien(M_).boda === '04/10' && quien('(T+1) - Jordi P').boda === '04/10');
err = ''; try { R.guardarPersona(M_, { boda: '2099' }, M_, V); } catch (e) { err = e.message; }
ver('pero no de aquí a más de diez años', /diez años/.test(err));
err = ''; try { R.guardarPersona(M_, { novios: '2030' }, M_, V); } catch (e) { err = e.message; }
ver('el noviazgo, no en el futuro', /después de hoy/.test(err));
err = ''; try { R.guardarPersona('(N) - Laura', { novios: '2001' }, M_, V); } catch (e) { err = e.message; }
ver('sin pareja, no hay fecha de novios', /elige primero su pareja/.test(err) || !!quien('(N) - Laura').pareja);
d = R.guardarPersona(M_, { boda: '' }, M_, V);
ver('la boda se puede borrar', !quien(M_).boda && !quien('(T+1) - Jordi P').boda && quien(M_).novios === '00/03/1980');
d = R.guardarPersona(M_, { pareja: '(N) - Laura' }, M_, V);
ver('al cambiar de pareja, las fechas se borran', !quien(M_).novios && !quien('(T+1) - Jordi P').novios && !quien('(N) - Laura').novios);
d = R.guardarPersona(M_, { pareja: '(T+1) - Jordi P', casados: 'No' }, M_, V);

// ---------- v4.13: el año del cumpleaños ----------
d = R.guardarPersona(M_, { cumple: '00/03/2027' }, M_, V);
ver('v4.24: la fecha prevista de un bebé en camino (el año que viene)', quien(M_).cumple === '00/03/2027');
err = ''; try { R.guardarPersona(M_, { cumple: '2028' }, M_, V); } catch (e) { err = e.message; }
ver('pero no más allá', /cumpleaños/.test(err));
d = R.guardarPersona(M_, { cumple: '07/03/1952' }, M_, V);
ver('cumpleaños con año', quien(M_).cumple === '07/03/1952');
d = R.guardarPersona(M_, { cumple: '7/3' }, M_, V);
ver('y sin año, como antes', quien(M_).cumple === '07/03');
err = ''; try { R.guardarPersona(M_, { cumple: '07/03/1850' }, M_, V); } catch (e) { err = e.message; }
ver('un año imposible no se guarda', /de 1900 a hoy/.test(err));
err = ''; try { R.guardarPersona(M_, { cumple: '07/03/2099' }, M_, V); } catch (e) { err = e.message; }
ver('ni uno del futuro', /de 1900 a hoy/.test(err));

// ---------- v4.15: acompañantes y eventos ----------
vm.runInContext('this.__.guardarDia = guardarDia;', ctx);
const V2 = { desde: '2026-11-16', hasta: '2026-11-29', yo: M_ };
const ap = (f, t, id) => d.apuntes.find(a => a.fecha === f && a.turno === t && a.persona === id);
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'CENA', apuntado: true, acompanantes: 2 }] }, M_, V2);
ver('apuntarse con 2 acompañantes', (ap('2026-11-21', 'CENA', M_) || {}).acompanantes === 2);
ver('título de la columna J de MESA_APUNTES', hojas.MESA_APUNTES.filas[0][9] === 'ACOMPANANTES');
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'CENA', apuntado: true, acompanantes: 0 }] }, M_, V2);
ver('volver a 0 acompañantes', (ap('2026-11-21', 'CENA', M_) || {}).acompanantes === 0);
err = ''; try { R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'CENA', apuntado: true, acompanantes: 50 }] }, M_, V2); } catch (e) { err = e.message; }
ver('acompañantes como mucho 20', /de 0 a 20/.test(err));
d = R.guardarDia('2026-11-21', { evento: 'Castañada', eventoTurno: 'CENA', eventoTexto: 'Traed castañas y boniatos' }, M_, V2);
const ev = d.dias.find(x => x.fecha === '2026-11-21') || {};
ver('evento guardado con su turno y su descripción', ev.evento === 'Castañada' && ev.eventoTurno === 'CENA' && ev.eventoTexto === 'Traed castañas y boniatos');
ver('títulos de los eventos en MESA_DIAS', hojas.MESA_DIAS.filas[0][29] === 'EVENTO');
d = R.guardarDia('2026-11-22', { evento: 'Santo de la abuela' }, M_, V2);
ver('sin turno, el evento es a la comida', (d.dias.find(x => x.fecha === '2026-11-22') || {}).eventoTurno === 'COMIDA');
d = R.guardarDia('2026-11-22', {}, M_, V2);
ver('borrar el día quita el evento', !d.dias.some(x => x.fecha === '2026-11-22'));

// ---------- v4.15.1: «no va» un día de los de siempre (fila con todas las columnas) ----------
d = R.guardarPersona(M_, { fijos: [{ dow: 6, turno: 'COMIDA' }] }, M_, V2);
ver('Mercedes va siempre los sábados a comer', !!ap('2026-11-21', 'COMIDA', M_));
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-21', turno: 'COMIDA', apuntado: false }] }, M_, V2);
ver('un sábado concreto no va (sin error de columnas)', !ap('2026-11-21', 'COMIDA', M_));
ver('la fila «no va» tiene las 10 columnas', hojas.MESA_APUNTES.filas.filter(f => f[6] === 'NO').every(f => f.length >= 10));

// ---------- v4.15.2: con las pestañas en formato de tabla ----------
Object.values(hojas).forEach(h => { h.tabla = true; });
d = R.guardarPersona(M_, { turnos: [{ fecha: '2026-11-25', turno: 'CENA', apuntado: true, nota: 'Con tabla' }] }, M_, V2);
ver('con tablas: apuntarse con nota (MESA_APUNTES y MESA_CAMBIOS)', !!ap('2026-11-25', 'CENA', M_));
d = R.guardarDia('2026-11-26', { nota: 'Con tabla' }, M_, V2);
ver('con tablas: nota del día (MESA_DIAS)', (d.dias.find(x => x.fecha === '2026-11-26') || {}).nota === 'Con tabla');
d = R.guardarPersona('(O) - Amiga M', { apodo: 'Amiga N' }, M_, V2);
ver('con tablas: cambiar el apodo (MESA_ALIAS)', !!d.personas.find(x => x.id === '(O) - Amiga N'));
d = R.guardarPersona(M_, { fijos: [{ dow: 3, turno: 'CENA' }] }, M_, V2);
ver('con tablas: va siempre (MESA_FIJOS)', d.fijos.some(f => f.persona === M_ && f.dow === 3));

// ---------- v4.16: fallecidos y fechas como se sepan ----------
Object.values(hojas).forEach(h => { h.tabla = false; });
d = R.crearPersona({ apodo: 'Nacio', jerarquia: 'Nietos', familia: 'Canela', nombre: 'Ignacio', cumple: '01/2008', fallecio: '06/2008', hijoDe: M_ }, M_, V2);
const nacio = d.personas.find(p => p.id === '(N) - Nacio') || {};
ver('Nacio, nacido en enero de 2008 y fallecido en junio de 2008', nacio.cumple === '00/01/2008' && nacio.fallecio === '00/06/2008' && nacio.hijoDe === M_);
ver('título de la columna P', hojas.PERSONAS.filas[0][15] === 'Falleció');
d = R.guardarPersona('(N) - Nacio', { fallecio: '2008' }, M_, V2);
ver('solo el año', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === '00/00/2008');
d = R.guardarPersona('(N) - Nacio', { fallecio: '10/06/2008' }, M_, V2);
ver('fecha completa', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === '10/06/2008');
err = ''; try { R.guardarPersona('(N) - Nacio', { fallecio: '31/02/2008' }, M_, V2); } catch (e) { err = e.message; }
ver('una fecha que no existe no se guarda', /fallecimiento/.test(err));
err = ''; try { R.guardarPersona('(N) - Nacio', { fallecio: '2099' }, M_, V2); } catch (e) { err = e.message; }
ver('ni una del futuro', /fallecimiento/.test(err));
// v4.20: fallecido sin saber cuándo
d = R.guardarPersona('(N) - Nacio', { fallecio: 'si' }, M_, V2);
ver('«sí» = falleció sin saber cuándo', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === 'Sí');
d = R.guardarPersona('(N) - Nacio', { fallecio: '06/2008' }, M_, V2);
ver('y se le puede volver a poner fecha', (d.personas.find(p => p.id === '(N) - Nacio') || {}).fallecio === '00/06/2008');
d = R.guardarPersona(M_, { cumple: '1952' }, M_, V2);
ver('cumpleaños con solo el año', quien(M_).cumple === '00/00/1952');

// ---------- v4.28: eventos ----------
const JP_ = '(T+1) - Jordi P';
ver('sin MESA_EVENTOS, ningún evento', Array.isArray(d.eventos) && d.eventos.length === 0);
d = R.guardarEvento({ nombre: 'PortAventura', desde: '2026-12-19', hasta: '2026-12-20', cuando: 'DIA', texto: 'Salimos a las 9' }, M_, V2);
const ev1 = (d.eventos || []).find(e => e.nombre === 'PortAventura') || {};
ver('se crea la pestaña y el evento, de dos días', !!hojas.MESA_EVENTOS && ev1.desde === '2026-12-19' && ev1.hasta === '2026-12-20' && ev1.cuando === 'DIA' && ev1.texto === 'Salimos a las 9');
d = R.apuntarEvento(ev1.id, M_, true, M_, V2);
d = R.apuntarEvento(ev1.id, JP_, false, M_, V2);
let evt = d.eventos.find(e => e.id === ev1.id);
ver('quién va y quién no', evt.van.join() === M_ && evt.noVan.join() === JP_);
d = R.apuntarEvento(ev1.id, JP_, true, M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('cambiar de «no voy» a «voy»', evt.van.join() === M_ + ',' + JP_ && !evt.noVan.length);
d = R.apuntarEvento(ev1.id, M_, null, M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('y quitarse', evt.van.join() === JP_);
d = R.guardarEvento({ id: ev1.id, nombre: 'PortAventura y Ferrari Land', desde: '2026-12-19', hasta: '2026-12-21', cuando: 'DIA' }, M_, V2);
evt = d.eventos.find(e => e.id === ev1.id);
ver('cambiar el evento no borra quién va', evt.nombre === 'PortAventura y Ferrari Land' && evt.hasta === '2026-12-21' && evt.van.join() === JP_);
err = ''; try { R.guardarEvento({ nombre: 'X', desde: '2026-12-20', hasta: '2026-12-19' }, M_, V2); } catch (e) { err = e.message; }
ver('el último día no puede ser antes', /antes del primero/.test(err));
err = ''; try { R.guardarEvento({ nombre: '', desde: '2026-12-20' }, M_, V2); } catch (e) { err = e.message; }
ver('sin nombre, no', /nombre del evento/.test(err));
err = ''; try { R.guardarEvento({ nombre: 'Largo', desde: '2026-12-01', hasta: '2027-01-15' }, M_, V2); } catch (e) { err = e.message; }
ver('un mes como mucho', /un mes/.test(err));
err = ''; try { R.apuntarEvento(ev1.id, '(X) - Nadie', true, M_, V2); } catch (e) { err = e.message; }
ver('apuntar a alguien que no está, no', /No encontramos/.test(err));
d = R.borrarEvento(ev1.id, M_, V2);
ver('borrar el evento', !d.eventos.some(e => e.id === ev1.id) && hojas.MESA_EVENTOS.filas.some(f => f[0] === ev1.id && f[9]));
err = ''; try { R.apuntarEvento(ev1.id, M_, true, M_, V2); } catch (e) { err = e.message; }
ver('y ya no se puede apuntar nadie', /ya no está/.test(err));

d = R.guardarEvento({ nombre: 'Cena de Navidad', desde: '2026-12-24', lugar: 'Casa de la abuela', hora: '21:00' }, M_, V2);
const cen = d.eventos.find(e => e.nombre === 'Cena de Navidad') || {};
ver('el evento con dónde y a qué hora', cen.lugar === 'Casa de la abuela' && cen.hora === '21:00' && cen.hasta === '2026-12-24');
d = R.apuntarEvento(cen.id, JP_, true, M_, V2);
ver('se puede apuntar a otro (un padre por su hijo)', d.eventos.find(e => e.id === cen.id).van.join() === JP_);

d = R.guardarEvento({ nombre: 'PortAventura', desde: '2026-12-19', hasta: '2026-12-20', cuando: 'DIA', turnos: { '2026-12-19': ['COMIDA', 'CENA', 'DORMIR'], '2026-12-20': ['COMIDA'], '2027-01-01': ['CENA'] } }, M_, V2);
const pa = d.eventos.find(e => e.nombre === 'PortAventura' && e.desde === '2026-12-19') || {};
ver('v4.33: los turnos de cada día, y nada fuera del evento', JSON.stringify(pa.turnos) === JSON.stringify({ '2026-12-19': ['COMIDA', 'CENA', 'DORMIR'], '2026-12-20': ['COMIDA'] }));
err = ''; try { R.guardarEvento({ nombre: 'Nada', desde: '2026-12-19', hasta: '2026-12-20', turnos: { '2026-12-19': [], '2026-12-20': [] } }, M_, V2); } catch (e) { err = e.message; }
ver('al menos un turno', /al menos una/.test(err));
d = R.guardarEvento({ nombre: 'Un día', desde: '2026-12-22', cuando: 'CENA' }, M_, V2);
ver('un evento de un día, sin turnos', (d.eventos.find(e => e.nombre === 'Un día') || {}).turnos === null);

// ---------- v4.28: otras fechas de cada persona ----------
d = R.guardarPersona(M_, { fechas: [{ que: 'Bautizo', fecha: '12/05/1961' }, { que: 'Carnet de conducir', fecha: '03/1980' }] }, M_, V2);
ver('otras fechas, con lo que se sepa', JSON.stringify(quien(M_).fechas) === JSON.stringify([{ que: 'Bautizo', fecha: '12/05/1961' }, { que: 'Carnet de conducir', fecha: '00/03/1980' }]) && hojas.PERSONAS.filas[0][18] === 'Otras fechas');
d = R.guardarPersona(M_, { fechas: [{ que: 'Comunión; 2ª: parte', fecha: '1968' }] }, M_, V2);
ver('sin «;» ni «:» en el nombre, y se cambia la lista entera', quien(M_).fechas.length === 1 && quien(M_).fechas[0].que === 'Comunión 2ª parte' && quien(M_).fechas[0].fecha === '00/00/1968');
err = ''; try { R.guardarPersona(M_, { fechas: [{ que: '', fecha: '1968' }] }, M_, V2); } catch (e) { err = e.message; }
ver('sin decir qué es, no', /ponle qué es/.test(err));
err = ''; try { R.guardarPersona(M_, { fechas: [{ que: 'Futuro', fecha: '2099' }] }, M_, V2); } catch (e) { err = e.message; }
ver('ni una fecha imposible', /Futuro/.test(err));
d = R.guardarPersona(M_, { fechas: [{ que: 'Santo', fecha: '25/07' }] }, M_, V2);
ver('v4.30: una fecha sin año (un santo)', quien(M_).fechas[0].fecha === '25/07');
err = ''; try { R.guardarPersona(M_, { fechas: [{ que: 'Santo', fecha: '31/02' }] }, M_, V2); } catch (e) { err = e.message; }
ver('pero que exista', /Santo/.test(err));
d = R.guardarPersona(M_, { fechas: [] }, M_, V2);
ver('y se pueden quitar todas', quien(M_).fechas.length === 0);

// ---------- v4.17: la clave de la familia ----------
ver('sin CLAVE en MESA_CONFIG, no se pide', R.api_('getDatos', [V2], undefined).ok === true);
hojas.MESA_CONFIG.filas.push(['CLAVE', 'Paella']);
ver('con CLAVE, sin clave no se puede', /^CLAVE/.test(R.api_('getDatos', [V2], '').error || ''));
ver('con una clave que no es, tampoco', /^CLAVE/.test(R.api_('getDatos', [V2], 'paela').error || ''));
ver('con la clave, sí (da igual mayúsculas y acentos)', R.api_('getDatos', [V2], ' PÁELLA ').ok === true);
ver('y también para guardar', /^CLAVE/.test(R.api_('guardarPersona', [M_, { alergias: 'x' }, M_, V2], 'no').error || ''));
// v4.18: la pista, en el aviso
ver('sin PISTA, el aviso no lleva pista', !/PISTA/.test(R.api_('getDatos', [V2], 'no').error || ''));
hojas.MESA_CONFIG.filas.push(['PISTA', 'Lo que se come en verano…']);
ver('con PISTA, va en el aviso', /PISTA: Lo que se come en verano…$/.test(R.api_('getDatos', [V2], 'no').error || ''));
ver('y con la clave buena, entra igual', R.api_('getDatos', [V2], 'paella').ok === true);
