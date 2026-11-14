/**
 * Casa Abuela · Utilo (antes «La mesa de la abuela»)
 * Web para apuntarse a comer, cenar y dormir con la abuela, toda la semana.
 * Almacén: Sheet «Cuadrante Caldetas 2026».
 *   PERSONAS      lista de la familia (tabla). La web escribe Apodo, Jerarquia, Familia (B-D), Menu, Alergias y Cumple (F-H);
 *                 el Id (A) es una fórmula. Al cambiar apodo o jerarquía, la web añade el alias en MESA_ALIAS.
 *                 Baja (I, v4.9): fecha en que se quitó de la lista (por error o porque ha fallecido). Su fila se queda;
 *                 deja de salir para apuntarse y sus comidas pasadas siguen saliendo con su nombre.
 *                 Núcleos (J-M, v4.10): Apellido, Sexo (Hombre o Mujer), Pareja (Id, en los dos sentidos) e Hijo de (Id).
 *                 Los Ids siguen a MESA_ALIAS. La web arma con ellos el árbol de núcleos de cada familia.
 *                 Nombre (N, v4.11): el nombre de verdad; el Apodo (B) es como le llaman en casa y no se repite.
 *                 Casados (O, v4.12): Sí o No, en los dos de la pareja; se borra si cambia la pareja.
 *                 Falleció (P, v4.16): dd/mm/aaaa, 00/mm/aaaa o 00/00/aaaa (como se sepa); «Sí» si no se sabe cuándo (v4.20). El cumpleaños admite lo mismo.
 *                 Novios desde (Q) y Boda (R), v4.21: como se sepan, iguales en los dos de la pareja; se borran si la pareja se deshace.
 *   MESA_APUNTES  ID_APUNTE | FECHA | TURNO | PERSONA_ID | CREADO_EN | NOTA | ESTADO ('' va · 'NO' no va ese día aunque sea fijo) | NOTA_POR | NOTA_EN
 *   MESA_FIJOS    ID_FIJO | PERSONA_ID | DIA_SEMANA (0 domingo … 6 sábado) | TURNO | DESDE | HASTA | NOTA | CREADO_POR | CREADO_EN
 *   MESA_DIAS     FECHA | NOTA | SIN_TURNO | CAMBIADO_POR | CAMBIADO_EN | SIN_COMIDA | MOTIVO_COMIDA | SIN_CENA | MOTIVO_CENA | NOTA_SERVICIO | SIN_DORMIR | MOTIVO_DORMIR
 *                 | NOTA_POR | NOTA_EN | SERVICIO_POR | SERVICIO_EN | COMIDA_POR | COMIDA_EN | CENA_POR | CENA_EN | DORMIR_POR | DORMIR_EN
 *                 | FUERA | MOTIVO_FUERA | FUERA_POR | FUERA_EN | FUERA_COMIDA | FUERA_CENA | FUERA_DORMIR
 *                 (la abuela no está en esa comida, cena o noche; FUERA = las tres, de versiones anteriores)
 *   MESA_CAMBIOS  CUANDO | QUIEN_ID | QUIEN | CAMBIO   (registro de quién cambia qué)
 *   MESA_ALIAS    ID_ANTIGUO | ID_NUEVO | NOTA   (si a alguien se le cambia el apodo o la jerarquía en PERSONAS)
 *   MESA_CONFIG   CLAVE (v4.17: la clave de la familia; vacía, no se pide), PISTA (v4.18: se enseña al pedir la clave), FECHA_INICIO, EXCLUIR_IDS, HORA_COMIDA, HORA_CENA, HORA_DORMIR, AVISO_HORAS, URL_COMPARTIR
 *                 (EXCLUIR_IDS: no salen para apuntarse, pero pueden hacer cambios, como la abuela)
 * Turnos: COMIDA, CENA y DORMIR (quién pasa la noche en casa).
 * El servicio son las personas de PERSONAS con Familia = «Servicio»: cuentan para cocinar y no como compañía en comida y cena; para dormir, sí.
 * Las escrituras tocan solo las filas que cambian (nunca se borra y reescribe una pestaña entera).
 * Velocidad: cada pestaña se lee una sola vez por petición, y getDatos guarda 60 s una copia (CacheService)
 * que se invalida en cuanto alguien guarda algo.
 * La web se sirve desde GitHub Pages y habla con este script como API (doPost, JSON, sin cookies):
 * así funciona aunque el móvil tenga varias cuentas de Google. doGet sigue sirviendo la web antigua.
 * Despliegue: Ejecutar como «Yo», acceso «Cualquier usuario» (excepción acordada en T0471).
 * Versión 4.23.0
 */

const SPREADSHEET_ID = '1O5S1h0nlggV8ZBf7PifW2RcCg7tUP0n8WmSpvcmdSIY';
const TZ = 'Europe/Madrid';
const HOJA_PERSONAS = 'PERSONAS';
const HOJA_APUNTES = 'MESA_APUNTES';
const HOJA_FIJOS = 'MESA_FIJOS';
const HOJA_CONFIG = 'MESA_CONFIG';
const HOJA_DIAS = 'MESA_DIAS';
const HOJA_CAMBIOS = 'MESA_CAMBIOS';
const HOJA_ALIAS = 'MESA_ALIAS';
const TURNOS = ['COMIDA', 'CENA', 'DORMIR'];
const MENUS_BASE = ['\uD83C\uDF15 Entero', '\uD83C\uDF17 Medio', '\uD83C\uDF7C Nada'];  // luna llena, media luna y biberón, escritos así para que no se estropeen al copiar
const COL_MENU = 6;      // F en PERSONAS
const COL_ALERGIAS = 7;  // G en PERSONAS
const COL_CUMPLE = 8;    // H en PERSONAS, texto dd/mm o dd/mm/aaaa (con el año, v4.13)
const COL_BAJA = 9;      // I en PERSONAS, texto aaaa-mm-dd (v4.7)
const COL_APELLIDO = 10; // J (v4.10)
const COL_SEXO = 11;     // K: Hombre o Mujer
const COL_PAREJA = 12;   // L: Id de su pareja
const COL_HIJO_DE = 13;  // M: Id de su padre o su madre
const COL_NOMBRE = 14;   // N: nombre de verdad (v4.11)
const COL_CASADOS = 15;  // O: Sí o No (v4.12)
const COL_FALLECIO = 16; // P: fecha de fallecimiento, como se sepa (v4.16)
const COL_NOVIOS = 17;   // Q: cuándo empezaron a salir, como se sepa, en los dos de la pareja (v4.21)
const COL_BODA = 18;     // R: cuándo se casaron, como se sepa, en los dos de la pareja (v4.21)
const TITULOS_EXTRA = { 9: 'Baja', 10: 'Apellido', 11: 'Sexo', 12: 'Pareja', 13: 'Hijo de', 14: 'Nombre', 15: 'Casados', 16: 'Falleció', 17: 'Novios desde', 18: 'Boda' };
const CAMPOS_NUCLEO = ['nombre', 'apellido', 'sexo', 'pareja', 'hijoDe', 'casados', 'fallecio', 'novios', 'boda'];
const CASADOS = ['Sí', 'No'];
const SEXOS = ['Hombre', 'Mujer'];
const COLS_APUNTES = 10;  // v4.15: J ACOMPANANTES (cuántos vienen con esa persona sin estar en la lista)
const COLS_FIJOS = 9;
const COLS_DIAS = 32;     // v4.15: AD EVENTO, AE EVENTO_TURNO, AF EVENTO_TEXTO
const TITULOS_DIAS_V415 = ['EVENTO', 'EVENTO_TURNO', 'EVENTO_TEXTO'];
const MAX_ACOMPANANTES = 20;
const MAX_EVENTO = 60, MAX_EVENTO_TEXTO = 500;
const MAX_ALERGIAS = 100;
const MAX_NOTA = 140;
const MAX_DIAS_RANGO = 400;

function doGet(e) {
  if (e && e.parameter && e.parameter.fn) return api_(e.parameter.fn, JSON.parse(e.parameter.args || '[]'), e.parameter.clave);
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Casa Abuela')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- API para la web de GitHub ---------- */

/** La web de GitHub manda { fn, args } en el cuerpo (texto plano, sin cookies) y recibe { ok, r } o { ok: false, error }. */
function doPost(e) {
  let peticion = {};
  try { peticion = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { peticion = {}; }
  return api_(peticion.fn, peticion.args || [], peticion.clave);
}

const API_ = {
  getDatos: function (a) { return getDatos(a[0]); },
  guardarPersona: function (a) { return guardarPersona(a[0], a[1], a[2], a[3]); },
  guardarDia: function (a) { return guardarDia(a[0], a[1], a[2], a[3]); },
  guardarAusencia: function (a) { return guardarAusencia(a[0], a[1], a[2], a[3], a[4], a[5]); },
  crearPersona: function (a) { return crearPersona(a[0], a[1], a[2]); },
  darDeBaja: function (a) { return darDeBaja(a[0], a[1], a[2]); },
};

function api_(fn, args, clave) {
  let salida;
  try {
    comprobarClave_(clave);
    if (!Object.prototype.hasOwnProperty.call(API_, fn)) throw new Error('Acción no válida.');
    salida = { ok: true, r: API_[fn](Array.isArray(args) ? args : []) };
  } catch (err) {
    salida = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * v4.17: la clave de la familia (MESA_CONFIG, CLAVE). Vacía, no se pide. Da igual mayúsculas y acentos.
 * Se guarda 5 minutos en la caché para no abrir el Excel en cada petición (si se cambia, tarda eso en valer).
 */
function comprobarClave_(clave) {
  const cache = CacheService.getScriptCache();
  let guardada = null;
  try { guardada = JSON.parse(cache.get('clave_familia_v2') || 'null'); } catch (e) { guardada = null; }
  if (!guardada) {
    const config = leerConfigSin_(SpreadsheetApp.openById(SPREADSHEET_ID));
    guardada = { clave: config.clave, pista: config.pista };
    try { cache.put('clave_familia_v2', JSON.stringify(guardada), 300); } catch (e) { /* sin caché, se lee cada vez */ }
  }
  const n = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  // v4.18: la pista (MESA_CONFIG, PISTA) va en el aviso, para quien aún no ha entrado
  if (guardada.clave && n(clave) !== n(guardada.clave)) throw new Error('CLAVE: hace falta la clave de la familia.' + (guardada.pista ? ' PISTA: ' + guardada.pista : ''));
}

/* ---------- Lectura ---------- */

/**
 * Lo que necesita la web para pintar.
 * p = { desde: 'aaaa-mm-dd', hasta: 'aaaa-mm-dd', yo: id de PERSONAS }
 */
function getDatos(p) {
  reiniciar_();
  p = p || {};
  const cache = CacheService.getScriptCache();
  const clave = 'd|' + versionCache_(cache) + '|' + (p.desde || '') + '|' + (p.hasta || '') + '|' + (p.yo || '');
  const guardado = cache.get(clave);
  if (guardado) return JSON.parse(guardado);
  const d = datos_(SpreadsheetApp.openById(SPREADSHEET_ID), p);
  try { cache.put(clave, JSON.stringify(d), 60); } catch (e) { /* demasiado grande para la caché: se sirve sin guardar */ }
  return d;
}

/* ---------- Memoria de la petición y caché ---------- */

let M = {};
function reiniciar_() { M = {}; }
function memo_(clave, fn) { if (!(clave in M)) M[clave] = fn(); return M[clave]; }
function olvidar_() { for (let i = 0; i < arguments.length; i++) delete M[arguments[i]]; }

function versionCache_(cache) {
  let v = cache.get('version');
  if (!v) { v = String(Date.now()); cache.put('version', v, 21600); }
  return v;
}
function invalidarCache_() {
  try { CacheService.getScriptCache().put('version', String(Date.now()), 21600); } catch (e) { /* sin caché, no pasa nada */ }
}

function datos_(ss, p) {
  const config = leerConfig_(ss);
  const personas = leerPersonas_(ss, config.excluir);
  const hoy = hoy_();
  let desde = esFecha_(p.desde) ? p.desde : lunesDe_(hoy);
  let hasta = esFecha_(p.hasta) ? p.hasta : sumarDias_(desde, 11);
  if (hasta < desde || diasEntre_(desde, hasta) > MAX_DIAS_RANGO) hasta = sumarDias_(desde, 11);
  const crudos = leerApuntes_(ss);
  const fijos = leerFijos_(ss);
  let url = config.urlCompartir;
  if (!url) { try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; } }
  return {
    hoy: hoy,
    url: url,
    config: { inicio: config.inicio, horaComida: config.horaComida, horaCena: config.horaCena, horaDormir: config.horaDormir, avisoHoras: config.avisoHoras },
    personas: personas,
    editores: leerEditores_(ss, config.excluir),
    menus: opcionesMenu_(personas),
    listas: listas_(ss, personas),
    apuntes: efectivos_(crudos, fijos, desde, hasta),
    fijos: fijos.filter(function (f) { return !f.hasta || f.hasta >= hoy; }),
    dias: leerDias_(ss).filter(function (d) { return d.fecha >= desde && d.fecha <= hasta; }),
    misProximas: p.yo ? efectivos_(crudos, fijos, hoy, sumarDias_(hoy, 60)).filter(function (a) { return a.persona === p.yo; }).slice(0, 12) : [],
    bajas: leerBajas_(ss).map(function (b) { return { id: b.id, apodo: b.apodo, jerarquia: b.jerarquia, familia: b.familia, menu: b.menu, baja: b.baja }; }),
    huerfanos: huerfanos_(crudos, fijos, personas.concat(leerEditores_(ss, config.excluir), leerBajas_(ss)), hoy),
  };
}

function leerConfig_(ss) { return memo_('config', function () { return leerConfigSin_(ss); }); }
function leerConfigSin_(ss) {
  const filas = ss.getSheetByName(HOJA_CONFIG).getDataRange().getValues().slice(1);
  const mapa = {};
  filas.forEach(function (f) { if (f[0]) mapa[String(f[0]).trim()] = f[1]; });
  return {
    inicio: aFecha_(mapa.FECHA_INICIO) || hoy_(),
    excluir: String(mapa.EXCLUIR_IDS || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean),
    horaComida: aHora_(mapa.HORA_COMIDA, '14:00'),
    horaCena: aHora_(mapa.HORA_CENA, '21:00'),
    horaDormir: aHora_(mapa.HORA_DORMIR, '22:30'),
    avisoHoras: Number(mapa.AVISO_HORAS) || 4,
    urlCompartir: String(mapa.URL_COMPARTIR || '').trim(),
    clave: String(mapa.CLAVE || '').trim(),
    pista: String(mapa.PISTA || '').trim(),
  };
}

function filasPersonas_(ss) { return memo_('personas', function () { return filasPersonasSin_(ss); }); }
function filasPersonasSin_(ss) {
  return ss.getSheetByName(HOJA_PERSONAS).getDataRange().getValues().slice(1)
    .filter(function (f) { return f[0] && String(f[1]).trim(); });
}

function aPersona_(f) {
  return {
    id: String(f[0]).trim(),
    apodo: String(f[1]).trim(),
    jerarquia: String(f[2] || '').trim(),
    familia: String(f[3] || '').trim(),
    menu: String(f[COL_MENU - 1] || '').trim(),
    alergias: String(f[COL_ALERGIAS - 1] || '').trim(),
    cumple: aCumple_(f[COL_CUMPLE - 1]),
    baja: aFecha_(f[COL_BAJA - 1]),
    apellido: String(f[COL_APELLIDO - 1] || '').trim(),
    sexo: SEXOS.indexOf(String(f[COL_SEXO - 1] || '').trim()) !== -1 ? String(f[COL_SEXO - 1]).trim() : '',
    pareja: String(f[COL_PAREJA - 1] || '').trim(),
    hijoDe: String(f[COL_HIJO_DE - 1] || '').trim(),
    nombre: String(f[COL_NOMBRE - 1] || '').trim(),
    casados: CASADOS.indexOf(String(f[COL_CASADOS - 1] || '').trim()) !== -1 ? String(f[COL_CASADOS - 1]).trim() : '',
    fallecio: aFallecio_(f[COL_FALLECIO - 1]),
    novios: aFechaParcial_(f[COL_NOVIOS - 1], 1850),
    boda: aFechaParcial_(f[COL_BODA - 1], 1850, 10),
  };
}

/** v4.10: Pareja e Hijo de, con el Id de ahora si a alguien se le cambió el nombre (MESA_ALIAS). */
function conAlias_(ss) {
  const alias = resolverAlias_(ss);
  return function (p) {
    if (p.pareja) p.pareja = alias(p.pareja);
    if (p.hijoDe) p.hijoDe = alias(p.hijoDe);
    return p;
  };
}

function leerPersonas_(ss, excluir) {
  return filasPersonas_(ss).filter(function (f) { return excluir.indexOf(String(f[0]).trim()) === -1; }).map(aPersona_)
    .filter(function (p) { return !p.baja; }).map(conAlias_(ss));
}

/** v4.7: quienes se han quitado de la lista (columna Baja). Solo para que sus comidas pasadas salgan con su nombre. */
function leerBajas_(ss) {
  return filasPersonas_(ss).map(aPersona_).filter(function (p) { return p.baja; });
}

/** Personas de EXCLUIR_IDS: no se apuntan, pero pueden identificarse para hacer cambios. */
function leerEditores_(ss, excluir) {
  if (!excluir.length) return [];
  return filasPersonas_(ss).filter(function (f) { return excluir.indexOf(String(f[0]).trim()) !== -1; }).map(aPersona_)
    .filter(function (p) { return !p.baja; }).map(conAlias_(ss));
}

function opcionesMenu_(personas) {
  const vistos = MENUS_BASE.slice();
  personas.forEach(function (p) { if (p.menu && vistos.indexOf(p.menu) === -1) vistos.push(p.menu); });
  return vistos;
}

function aFilaApunte_(f) {
  return [String(f[0]), aFecha_(f[1]), String(f[2]), String(f[3]),
    f[4] instanceof Date ? Utilities.formatDate(f[4], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[4] || ''),
    String(f[5] || ''), String(f[6] || '').toUpperCase(), String(f[7] || ''),
    f[8] instanceof Date ? Utilities.formatDate(f[8], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[8] || ''),
    String(Number(f[9]) > 0 ? Math.floor(Number(f[9])) : '')];
}

function leerApuntes_(ss) { return memo_('apuntes', function () { return leerApuntesSin_(ss); }); }
function leerApuntesSin_(ss) {
  const alias = resolverAlias_(ss);
  return abrirTabla_(ss.getSheetByName(HOJA_APUNTES), COLS_APUNTES, aFilaApunte_).vivas().map(function (x) {
    const f = x.v;
    return { id: f[0], fecha: f[1], turno: f[2], persona: alias(f[3]), nota: f[5], no: f[6] === 'NO', notaPor: f[7], notaEn: f[8], acompanantes: Number(f[9]) || 0 };
  });
}

function hojaFijos_(ss) {
  return ss.getSheetByName(HOJA_FIJOS) ||
    crearHoja_(ss, HOJA_FIJOS, ['ID_FIJO', 'PERSONA_ID', 'DIA_SEMANA', 'TURNO', 'DESDE', 'HASTA', 'NOTA', 'CREADO_POR', 'CREADO_EN']);
}

function aFilaFijo_(f) {
  return [String(f[0]), String(f[1]), Number(f[2]), String(f[3]), aFecha_(f[4]), aFecha_(f[5]), String(f[6] || ''), String(f[7] || ''),
    f[8] instanceof Date ? Utilities.formatDate(f[8], TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(f[8] || '')];
}

function leerFijos_(ss) { return memo_('fijos', function () { return leerFijosSin_(ss); }); }
function leerFijosSin_(ss) {
  const alias = resolverAlias_(ss);
  return abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_).vivas().map(function (x) {
    const f = x.v;
    return { id: f[0], persona: alias(f[1]), dow: f[2], turno: f[3], desde: f[4], hasta: f[5], nota: f[6] };
  });
}

/**
 * Lee una pestaña como lista de filas con su número de fila, y al guardar solo toca lo que ha cambiado:
 * primero actualiza filas, luego añade las nuevas al final y por último borra (de abajo arriba).
 * Así, si Apps Script se corta a medias, como mucho se pierde ese cambio, nunca la pestaña entera.
 */
function abrirTabla_(hoja, cols, aFila) {
  const filas = [];
  const ultima = hoja.getLastRow();
  if (ultima >= 2) {
    const ancho = Math.min(cols, hoja.getMaxColumns());
    hoja.getRange(2, 1, ultima - 1, ancho).getValues().forEach(function (f, i) {
      while (f.length < cols) f.push('');
      if (f[0]) filas.push({ n: i + 2, v: aFila(f), cambiada: false, borrada: false });
    });
  }
  return {
    vivas: function () { return filas.filter(function (x) { return !x.borrada; }); },
    nueva: function (v) { filas.push({ n: null, v: v, cambiada: true, borrada: false }); },
    guardar: function () {
      if (hoja.getMaxColumns() < cols) hoja.insertColumnsAfter(hoja.getMaxColumns(), cols - hoja.getMaxColumns());
      // v4.15.1: cada fila, con todas las columnas de la pestaña (aunque venga más corta)
      const texto = function (v) {
        const r = v.map(function (c) { return c === null || c === undefined ? '' : String(c); });
        while (r.length < cols) r.push('');
        return r.slice(0, cols);
      };
      filas.forEach(function (x) {
        if (x.n && x.cambiada && !x.borrada) {
          const r = hoja.getRange(x.n, 1, 1, cols);
          comoTexto_(r);
          r.setValues([texto(x.v)]);
        }
      });
      const nuevas = filas.filter(function (x) { return !x.n && !x.borrada; }).map(function (x) { return texto(x.v); });
      if (nuevas.length) {
        const r = hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, cols);
        comoTexto_(r);
        r.setValues(nuevas);
      }
      filas.filter(function (x) { return x.n && x.borrada; }).map(function (x) { return x.n; })
        .sort(function (a, b) { return b - a; })
        .forEach(function (n) { hoja.deleteRow(n); });
    },
  };
}

/**
 * MESA_ALIAS: si a alguien se le cambia el apodo o la jerarquía en PERSONAS, su Id cambia (es una fórmula).
 * Poniendo ahí el Id antiguo y el nuevo, sus apuntes y fijos antiguos siguen siendo suyos.
 */
function resolverAlias_(ss) { return memo_('alias', function () { return resolverAliasSin_(ss); }); }
function resolverAliasSin_(ss) {
  const hoja = ss.getSheetByName(HOJA_ALIAS);
  const mapa = {};
  if (hoja && hoja.getLastRow() >= 2) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues().forEach(function (f) {
      const a = String(f[0] || '').trim(), b = String(f[1] || '').trim();
      if (a && b && a !== b) mapa[a] = b;
    });
  }
  return function (id) {
    let actual = id;
    for (let i = 0; i < 10 && mapa[actual]; i++) actual = mapa[actual];
    return actual;
  };
}

/** Ids con apuntes o fijos desde hace un mes que ya no están en PERSONAS (seguramente por un cambio de apodo). */
function huerfanos_(crudos, fijos, todos, hoy) {
  const existe = {};
  todos.forEach(function (p) { existe[p.id] = true; });
  const desde = sumarDias_(hoy, -30);
  const vistos = {};
  crudos.forEach(function (a) { if (!existe[a.persona] && a.fecha >= desde) vistos[a.persona] = true; });
  fijos.forEach(function (f) { if (!existe[f.persona] && (!f.hasta || f.hasta >= hoy)) vistos[f.persona] = true; });
  return Object.keys(vistos);
}

/**
 * Quién va de verdad cada día: los fijos de ese día de la semana, más los apuntes sueltos,
 * menos los «no voy» (ESTADO = NO). Devuelve { fecha, turno, persona, nota, fijo }.
 */
function efectivos_(crudos, fijos, desde, hasta) {
  const out = [];
  const porDia = {};
  crudos.forEach(function (a) {
    if (a.fecha < desde || a.fecha > hasta) return;
    (porDia[a.fecha + '|' + a.turno] = porDia[a.fecha + '|' + a.turno] || []).push(a);
  });
  for (let d = desde; d <= hasta; d = sumarDias_(d, 1)) {
    const dow = diaSemana_(d);
    TURNOS.forEach(function (t) {
      const mapa = {};
      const orden = [];
      fijos.forEach(function (f) {
        if (f.dow === dow && f.turno === t && f.desde <= d && (!f.hasta || d <= f.hasta) && !mapa[f.persona]) {
          mapa[f.persona] = { fecha: d, turno: t, persona: f.persona, nota: '', fijo: true };
          orden.push(f.persona);
        }
      });
      (porDia[d + '|' + t] || []).forEach(function (a) {
        if (a.no) { delete mapa[a.persona]; return; }
        if (!mapa[a.persona]) orden.push(a.persona);
        mapa[a.persona] = { fecha: d, turno: t, persona: a.persona, nota: a.nota, notaPor: a.nota ? a.notaPor : '', notaEn: a.nota ? a.notaEn : '', fijo: !!(mapa[a.persona] && mapa[a.persona].fijo), acompanantes: a.acompanantes || 0 };
      });
      orden.forEach(function (id) { if (mapa[id]) { out.push(mapa[id]); delete mapa[id]; } });
    });
  }
  return out;
}

function leerDias_(ss) { return memo_('dias', function () { return leerDiasSin_(ss); }); }
function leerDiasSin_(ss) {
  const hoja = hojaDias_(ss);
  if (hoja.getLastRow() < 2) return [];
  const ancho = Math.min(COLS_DIAS, hoja.getMaxColumns());
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      const todo = esSi_(f[2]);
      return {
        fecha: aFecha_(f[0]), nota: String(f[1] || ''), por: String(f[3] || ''),
        sinComida: todo || esSi_(f[5]), motivoComida: String(f[6] || ''),
        sinCena: todo || esSi_(f[7]), motivoCena: String(f[8] || ''),
        notaServicio: String(f[9] || ''),
        sinDormir: esSi_(f[10]), motivoDormir: String(f[11] || ''),
        notaPor: String(f[12] || f[3] || ''), notaEn: texto_(f[13] || f[4]),
        servicioPor: String(f[14] || f[3] || ''), servicioEn: texto_(f[15] || f[4]),
        comidaPor: String(f[16] || f[3] || ''), comidaEn: texto_(f[17] || f[4]),
        cenaPor: String(f[18] || f[3] || ''), cenaEn: texto_(f[19] || f[4]),
        dormirPor: String(f[20] || f[3] || ''), dormirEn: texto_(f[21] || f[4]),
        fueraComida: esSi_(f[22]) || esSi_(f[26]), fueraCena: esSi_(f[22]) || esSi_(f[27]), fueraDormir: esSi_(f[22]) || esSi_(f[28]),
        motivoFuera: String(f[23] || ''), fueraPor: String(f[24] || ''), fueraEn: texto_(f[25]),
        evento: String(f[29] || ''), eventoTurno: String(f[30] || ''), eventoTexto: String(f[31] || ''),
      };
    });
}

/* ---------- Escritura (todas guardan quién lo hace en MESA_CAMBIOS) ---------- */

/**
 * Editar a una persona (también a otros y días pasados).
 * cambios = { menu?, alergias?, cumple?, turnos?: [{ fecha, turno, apuntado, nota?, desdeAqui? }], fijos?: [{ dow, turno }] }
 * desdeAqui (al quitar un día que va siempre): deja de ir ese día y todos los siguientes de ese día de la semana.
 * fijos es la lista completa de sus comidas o cenas de siempre (sustituye a la anterior desde hoy).
 * La abuela (EXCLUIR_IDS) solo puede cambiar su menú y sus alergias.
 */
function guardarPersona(personaId, cambios, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const editores = leerEditores_(ss, config.excluir);
    const autor = autor_(personas.concat(editores), quien);
    let p = personas.filter(function (x) { return x.id === personaId; })[0];
    const esEditor = !p;
    if (esEditor) p = editores.filter(function (x) { return x.id === personaId; })[0];
    if (!p) throw new Error('No encontramos ese nombre en la lista.');
    cambios = cambios || {};
    if (esEditor && ((cambios.turnos && cambios.turnos.length) || cambios.fijos)) throw new Error(p.apodo + ' no se apunta a las comidas.');
    const registro = [];

    if (cambios.cumple !== undefined) {
      const cumple = aCumple_(cambios.cumple);
      if (String(cambios.cumple || '').trim() && !cumple) throw new Error('El cumpleaños tiene que ser un día y un mes que existan (y, si se pone, un año de 1900 a hoy), o el mes y el año, o solo el año.');
      escribirEnPersonas_(ss, personaId, COL_CUMPLE, cumple, true);
      if (cumple !== p.cumple) registro.push('Cumpleaños de ' + p.apodo + ': ' + (cumple || 'borrado'));
    }
    if (cambios.menu !== undefined && cambios.menu !== p.menu) {
      if (opcionesMenu_(personas).indexOf(cambios.menu) === -1) throw new Error('Ese menú no está en la lista.');
      escribirEnPersonas_(ss, personaId, COL_MENU, cambios.menu, false);
      registro.push('Menú de ' + p.apodo + ': ' + cambios.menu);
    }
    if (cambios.alergias !== undefined) {
      const texto = limpiar_(cambios.alergias, MAX_ALERGIAS, 'Las alergias');
      if (texto.replace(/^'/, '') !== p.alergias) {
        escribirEnPersonas_(ss, personaId, COL_ALERGIAS, texto, false);
        registro.push((esEditor ? 'Comida de ' : 'Alergias de ') + p.apodo + ': ' + (texto.replace(/^'/, '') || 'nada'));
      }
    }

    if (CAMPOS_NUCLEO.some(function (k) { return cambios[k] !== undefined; })) {
      ponerNucleo_(ss, p, cambios, registro, personas.concat(editores));
    }

    const cierres = [];
    if (cambios.turnos && cambios.turnos.length) {
      const fijos = leerFijos_(ss);
      const alias = resolverAlias_(ss);
      const tabla = abrirTabla_(ss.getSheetByName(HOJA_APUNTES), COLS_APUNTES, aFilaApunte_);
      cambios.turnos.forEach(function (t) {
        validarTurno_(config, t.fecha, t.turno);
        const cuando = nombreTurno_(t.turno) + ' del ' + ddmm_(t.fecha);
        const dow = diaSemana_(t.fecha);
        const esFijo = fijos.some(function (f) {
          return f.persona === personaId && f.dow === dow && f.turno === t.turno && f.desde <= t.fecha && (!f.hasta || t.fecha <= f.hasta);
        });
        const x = tabla.vivas().filter(function (r) { return r.v[1] === t.fecha && r.v[2] === t.turno && alias(r.v[3]) === personaId; })[0];
        const fila = x ? x.v : null;
        if (x && fila[3] !== personaId) { fila[3] = personaId; x.cambiada = true; }
        const iba = fila ? fila[6] !== 'NO' : esFijo;
        const notaAntes = fila ? fila[5] : '';
        const nota = t.nota !== undefined ? limpiar_(t.nota, MAX_NOTA, 'La nota', true) : null;
        // v4.15: acompañantes (gente que viene con esta persona y no está en la lista)
        let acomp = null;
        if (t.acompanantes !== undefined) {
          acomp = Math.floor(Number(t.acompanantes) || 0);
          if (acomp < 0 || acomp > MAX_ACOMPANANTES) throw new Error('Los acompañantes van de 0 a ' + MAX_ACOMPANANTES + '.');
        }
        const acompAntes = fila ? Number(fila[9]) || 0 : 0;
        if (t.apuntado) {
          if (!fila) {
            if (!esFijo || nota || acomp) tabla.nueva([Utilities.getUuid(), t.fecha, t.turno, personaId, ahora_(), nota || '', '', nota ? autor.apodo : '', nota ? ahora_() : '', acomp ? String(acomp) : '']);
          } else {
            if (fila[6] !== '') { fila[6] = ''; x.cambiada = true; }
            if (nota !== null && nota !== fila[5]) { fila[5] = nota; fila[7] = nota ? autor.apodo : ''; fila[8] = nota ? ahora_() : ''; x.cambiada = true; }
            if (acomp !== null && acomp !== acompAntes) { fila[9] = acomp ? String(acomp) : ''; x.cambiada = true; }
            if (esFijo && !fila[5] && !(Number(fila[9]) > 0)) x.borrada = true;
          }
          if (!iba) registro.push('Apunta a ' + p.apodo + ' a la ' + cuando + (acomp ? ' (con ' + acomp + ' más)' : '') + (nota ? ' (nota: ' + nota + ')' : ''));
          else {
            if (nota !== null && nota !== notaAntes) registro.push('Nota de ' + p.apodo + ' en la ' + cuando + ': ' + (nota || 'borrada'));
            if (acomp !== null && acomp !== acompAntes) registro.push(p.apodo + ' va a la ' + cuando + (acomp ? ' con ' + acomp + ' más' : ' sin acompañantes'));
          }
        } else {
          if (esFijo && t.desdeAqui) {
            if (x) x.borrada = true;
            cierres.push({ fecha: t.fecha, dow: dow, turno: t.turno });
          } else if (esFijo) {
            if (x) { fila[6] = 'NO'; x.cambiada = true; } else { tabla.nueva([Utilities.getUuid(), t.fecha, t.turno, personaId, ahora_(), '', 'NO', '', '', '']); }
          } else if (x) {
            x.borrada = true;
          }
          if (iba) registro.push('Quita a ' + p.apodo + ' de la ' + cuando + (esFijo ? (t.desdeAqui ? ' y de las siguientes' : ' (solo ese día)') : ''));
        }
      });
      tabla.guardar();
      const hojaA = ss.getSheetByName(HOJA_APUNTES);
      if (!String(hojaA.getRange(1, 10).getValue()).trim()) hojaA.getRange(1, 10).setValue('ACOMPANANTES');
      olvidar_('apuntes');
    }

    if (cierres.length) cerrarFijos_(ss, p, cierres);
    if (cambios.fijos) guardarFijos_(ss, p, cambios.fijos, autor, registro);
    if (cierres.length || cambios.fijos) olvidar_('fijos');

    let renombrado = null;
    if (!esEditor && (cambios.apodo !== undefined || cambios.jerarquia !== undefined || cambios.familia !== undefined)) {
      renombrado = renombrarPersona_(ss, p, cambios, registro);
    }

    registrar_(ss, autor, registro);
    const d = datos_(ss, vista || {});
    if (renombrado) d.renombrado = renombrado;
    return d;
  });
}

/** Deja de ir siempre a partir de una fecha: el fijo termina el día anterior (o se borra si aún no había empezado). */
function cerrarFijos_(ss, p, cierres) {
  const alias = resolverAlias_(ss);
  const tabla = abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_);
  cierres.forEach(function (c) {
    tabla.vivas().forEach(function (x) {
      const f = x.v;
      if (alias(f[1]) === p.id && f[2] === c.dow && f[3] === c.turno && f[4] <= c.fecha && (!f[5] || f[5] >= c.fecha)) {
        f[5] = sumarDias_(c.fecha, -1);
        if (f[5] < f[4]) x.borrada = true; else x.cambiada = true;
      }
    });
  });
  tabla.guardar();
}

/** Sustituye sus comidas o cenas de siempre: cierra las que ya no están (ayer) y abre las nuevas (hoy). */
function guardarFijos_(ss, p, lista, autor, registro) {
  const hoy = hoy_();
  const ayer = sumarDias_(hoy, -1);
  const nombres = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  const quiere = {};
  lista.forEach(function (x) {
    const dow = Number(x.dow);
    if (!(dow >= 0 && dow <= 6) || TURNOS.indexOf(x.turno) === -1) throw new Error('Día fijo no válido.');
    quiere[dow + '|' + x.turno] = true;
  });
  const alias = resolverAlias_(ss);
  const tabla = abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_);
  const activos = {};
  tabla.vivas().forEach(function (x) {
    const f = x.v;
    if (alias(f[1]) !== p.id || (f[5] && f[5] < hoy)) return;
    const k = f[2] + '|' + f[3];
    if (quiere[k]) { activos[k] = true; return; }
    f[5] = f[4] >= hoy ? sumarDias_(f[4], -1) : ayer;
    if (f[5] < f[4]) x.borrada = true; else x.cambiada = true;
    registro.push(p.apodo + ' deja de ir siempre los ' + nombres[f[2]] + ' (' + nombreTurno_(f[3]) + ')');
  });
  Object.keys(quiere).forEach(function (k) {
    if (activos[k]) return;
    const partes = k.split('|');
    tabla.nueva([Utilities.getUuid(), p.id, Number(partes[0]), partes[1], hoy, '', '', autor.apodo, ahora_()]);
    registro.push(p.apodo + ' va siempre los ' + nombres[Number(partes[0])] + ' (' + nombreTurno_(partes[1]) + ')');
  });
  tabla.guardar();
}

/**
 * Lo de un día: nota familiar, nota para el servicio y si no hace falta nadie a la comida o a la cena (con motivo).
 * dia = { nota, notaServicio, sinComida, motivoComida, sinCena, motivoCena, sinDormir, motivoDormir, fueraComida, fueraCena, fueraDormir, motivoFuera }
 */
function guardarDia(fecha, dia, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const autor = autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien);
    validarDia_(config, fecha);
    dia = dia || {};
    const nota = limpiar_(dia.nota, MAX_NOTA, 'La nota', true);
    const notaServicio = limpiar_(dia.notaServicio, MAX_NOTA, 'La nota para el servicio', true);
    const sinComida = !!dia.sinComida, sinCena = !!dia.sinCena;
    const motivoComida = sinComida ? limpiar_(dia.motivoComida, MAX_NOTA, 'El motivo', true) : '';
    const motivoCena = sinCena ? limpiar_(dia.motivoCena, MAX_NOTA, 'El motivo', true) : '';
    const sinDormir = !!dia.sinDormir;
    const motivoDormir = sinDormir ? limpiar_(dia.motivoDormir, MAX_NOTA, 'El motivo', true) : '';
    const fueraC = !!dia.fueraComida, fueraX = !!dia.fueraCena, fueraD = !!dia.fueraDormir;
    const fuera = fueraC || fueraX || fueraD;
    const motivoFuera = fuera ? limpiar_(dia.motivoFuera, MAX_NOTA, 'El motivo', true) : '';
    // v4.15: un evento puntual (la castañada…) con su turno y su descripción
    const evento = limpiar_(dia.evento, MAX_EVENTO, 'El nombre del evento', true);
    const eventoTurno = evento ? (TURNOS.indexOf(dia.eventoTurno) !== -1 ? dia.eventoTurno : 'COMIDA') : '';
    const eventoTexto = evento ? limpiar_(dia.eventoTexto, MAX_EVENTO_TEXTO, 'La descripción del evento', true) : '';
    const hoja = hojaDias_(ss);
    if (hoja.getMaxColumns() < COLS_DIAS) hoja.insertColumnsAfter(hoja.getMaxColumns(), COLS_DIAS - hoja.getMaxColumns());
    const n = Math.max(0, hoja.getLastRow() - 1);
    const fechas = n ? hoja.getRange(2, 1, n, 1).getValues().map(function (f) { return aFecha_(f[0]); }) : [];
    const i = fechas.indexOf(fecha);
    const antes = i !== -1 ? leerDias_(ss).filter(function (d) { return d.fecha === fecha; })[0] : null;
    const ahora = ahora_();
    /* Quién y cuándo de cada cosa: solo cambia si cambia esa cosa */
    const autoria = function (vacio, igual, porAntes, enAntes) {
      if (vacio) return ['', ''];
      if (antes && igual) return [porAntes, enAntes];
      return [autor.apodo, ahora];
    };
    const aNota = autoria(!nota, antes && antes.nota === nota, antes && antes.notaPor, antes && antes.notaEn);
    const aServ = autoria(!notaServicio, antes && antes.notaServicio === notaServicio, antes && antes.servicioPor, antes && antes.servicioEn);
    const aComida = autoria(!sinComida, antes && antes.sinComida && antes.motivoComida === motivoComida, antes && antes.comidaPor, antes && antes.comidaEn);
    const aCena = autoria(!sinCena, antes && antes.sinCena && antes.motivoCena === motivoCena, antes && antes.cenaPor, antes && antes.cenaEn);
    const aDormir = autoria(!sinDormir, antes && antes.sinDormir && antes.motivoDormir === motivoDormir, antes && antes.dormirPor, antes && antes.dormirEn);
    const aFuera = autoria(!fuera, antes && antes.fueraComida === fueraC && antes.fueraCena === fueraX && antes.fueraDormir === fueraD && antes.motivoFuera === motivoFuera, antes && antes.fueraPor, antes && antes.fueraEn);
    if (!String(hoja.getRange(1, 30).getValue()).trim()) hoja.getRange(1, 30, 1, 3).setValues([TITULOS_DIAS_V415]);
    if (!nota && !notaServicio && !sinComida && !sinCena && !sinDormir && !fuera && !evento) {
      if (i !== -1) hoja.deleteRow(i + 2);
      registrar_(ss, autor, ['Borra lo anotado el ' + ddmm_(fecha)]);
    } else {
      const fila = i !== -1 ? i + 2 : hoja.getLastRow() + 1;
      const rango = hoja.getRange(fila, 1, 1, COLS_DIAS);
      comoTexto_(rango);
      rango.setValues([[fecha, nota, sinComida && sinCena ? 'TRUE' : 'FALSE', autor.apodo, ahora,
        sinComida ? 'TRUE' : 'FALSE', motivoComida, sinCena ? 'TRUE' : 'FALSE', motivoCena, notaServicio,
        sinDormir ? 'TRUE' : 'FALSE', motivoDormir].concat(aNota, aServ, aComida, aCena, aDormir, ['FALSE', motivoFuera], aFuera,
        [fueraC ? 'TRUE' : 'FALSE', fueraX ? 'TRUE' : 'FALSE', fueraD ? 'TRUE' : 'FALSE'], [evento, eventoTurno, eventoTexto])]);
      const partes = [];
      if (evento) partes.push('evento: ' + evento + ' (' + nombreTurno_(eventoTurno) + ')');
      if (nota) partes.push(nota);
      if (notaServicio) partes.push('para el servicio: ' + notaServicio);
      if (sinComida) partes.push('comida sin nadie' + (motivoComida ? ' (' + motivoComida + ')' : ''));
      if (sinCena) partes.push('cena sin nadie' + (motivoCena ? ' (' + motivoCena + ')' : ''));
      if (sinDormir) partes.push('noche sin nadie' + (motivoDormir ? ' (' + motivoDormir + ')' : ''));
      if (fuera) partes.push('la abuela no está: ' + [fueraC ? 'comida' : '', fueraX ? 'cena' : '', fueraD ? 'noche' : ''].filter(Boolean).join(', ') + (motivoFuera ? ' (' + motivoFuera + ')' : ''));
      registrar_(ss, autor, ['Día ' + ddmm_(fecha) + ': ' + partes.join(' · ')]);
    }
    olvidar_('dias');
    return datos_(ss, vista || {});
  });
}

/**
 * La abuela no está varios días: marca en qué comidas, cenas y noches no está, de desde a hasta.
 * marcados = ['aaaa-mm-dd|COMIDA', 'aaaa-mm-dd|CENA', …]; lo que no está en la lista, en ese rango, se desmarca.
 * Máximo 60 días de una vez.
 */
function guardarAusencia(desde, hasta, marcados, motivo, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const autor = autor_(leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir)), quien);
    validarDia_(config, desde);
    validarDia_(config, hasta);
    if (hasta < desde) throw new Error('El último día tiene que ser igual o posterior al primero.');
    if (diasEntre_(desde, hasta) > 60) throw new Error('Como mucho 60 días de una vez.');
    const marca = {};
    (marcados || []).forEach(function (k) { marca[k] = true; });
    const texto = Object.keys(marca).length ? limpiar_(motivo, MAX_NOTA, 'El motivo', true) : '';
    const hoja = hojaDias_(ss);
    if (hoja.getMaxColumns() < COLS_DIAS) hoja.insertColumnsAfter(hoja.getMaxColumns(), COLS_DIAS - hoja.getMaxColumns());
    const n = Math.max(0, hoja.getLastRow() - 1);
    const fechas = n ? hoja.getRange(2, 1, n, 1).getValues().map(function (f) { return aFecha_(f[0]); }) : [];
    const ahora = ahora_();
    const resumen = [];
    for (let d = desde; d <= hasta; d = sumarDias_(d, 1)) {
      const c = !!marca[d + '|COMIDA'], x = !!marca[d + '|CENA'], z = !!marca[d + '|DORMIR'];
      const algo = c || x || z;
      if (algo) resumen.push(ddmm_(d) + ' ' + [c ? 'comida' : '', x ? 'cena' : '', z ? 'noche' : ''].filter(Boolean).join(', '));
      const i = fechas.indexOf(d);
      const fuera = ['FALSE', algo ? texto : '', algo ? autor.apodo : '', algo ? ahora : ''];
      const turnos = [c ? 'TRUE' : 'FALSE', x ? 'TRUE' : 'FALSE', z ? 'TRUE' : 'FALSE'];
      if (i !== -1) {
        const r1 = hoja.getRange(i + 2, 23, 1, 4);
        comoTexto_(r1);
        r1.setValues([fuera]);
        const r2 = hoja.getRange(i + 2, 27, 1, 3);
        comoTexto_(r2);
        r2.setValues([turnos]);
      } else if (algo) {
        const fila = new Array(COLS_DIAS).fill('');
        fila[0] = d; fila[2] = 'FALSE'; fila[3] = autor.apodo; fila[4] = ahora; fila[5] = 'FALSE'; fila[7] = 'FALSE'; fila[10] = 'FALSE';
        fila[22] = fuera[0]; fila[23] = fuera[1]; fila[24] = fuera[2]; fila[25] = fuera[3];
        fila[26] = turnos[0]; fila[27] = turnos[1]; fila[28] = turnos[2];
        const r = hoja.getRange(hoja.getLastRow() + 1, 1, 1, COLS_DIAS);
        comoTexto_(r);
        r.setValues([fila]);
        fechas.push(d);
      }
    }
    registrar_(ss, autor, [resumen.length
      ? 'La abuela no está (' + resumen.join('; ') + ')' + (texto ? ': ' + texto : '')
      : 'Quita la ausencia de la abuela del ' + ddmm_(desde) + ' al ' + ddmm_(hasta)]);
    olvidar_('dias');
    return datos_(ss, vista || {});
  });
}

/* ---------- Personas: añadir y cambiar nombre o familia ---------- */

/** Opciones de Jerarquia y Familia: las de los desplegables de la tabla PERSONAS (o, si no, las que se usan). */
function listas_(ss, personas) {
  return memo_('listas', function () {
    const hoja = ss.getSheetByName(HOJA_PERSONAS);
    const desplegable = function (col) {
      try {
        const regla = hoja.getRange(2, col).getDataValidation();
        if (regla && regla.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return regla.getCriteriaValues()[0].map(String);
      } catch (e) { /* sin desplegable */ }
      return [];
    };
    const usados = function (campo) {
      const v = [];
      // v4.7: también quien está de baja, para poder recuperarlo
      personas.concat(leerBajas_(ss)).forEach(function (p) { if (p[campo] && v.indexOf(p[campo]) === -1) v.push(p[campo]); });
      return v;
    };
    let jerarquias = desplegable(3); if (!jerarquias.length) jerarquias = usados('jerarquia');
    let familias = desplegable(4); if (!familias.length) familias = usados('familia');
    return {
      jerarquias: jerarquias.filter(function (j) { return j !== 'Abuelos'; }),
      familias: familias.filter(function (f) { return f !== 'Abuelos'; }),
    };
  });
}

/** v4.11: el apodo es como le llaman en casa y no se puede repetir (da igual mayúsculas y acentos). salvo: Ids que no cuentan. */
function apodoLibre_(ss, apodo, salvo) {
  const n = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  const otro = filasPersonas_(ss).filter(function (f) { return salvo.indexOf(String(f[0]).trim()) === -1 && n(f[1]) === n(apodo); })[0];
  if (otro) throw new Error('Ya hay alguien que se llama «' + String(otro[1]).trim() + '» en la lista. El apodo no se puede repetir: añade una inicial o como le llamáis en casa (por ejemplo, «' + apodo + ' M»).');
}

/** El Id de PERSONAS lo calcula una fórmula: «(» + inicial de la jerarquía + «+1» si la lleva + «) - » + apodo. */
function idDe_(apodo, jerarquia) {
  return '(' + String(jerarquia || '').charAt(0) + (String(jerarquia || '').indexOf('+1') !== -1 ? '+1' : '') + ') - ' + apodo;
}

function validarFicha_(ss, personas, apodo, jerarquia, familia) {
  const listas = listas_(ss, personas);
  if (!apodo) throw new Error('Pon el nombre.');
  if (apodo.length > 40) throw new Error('El nombre cabe en 40 letras como mucho.');
  if (listas.jerarquias.length && listas.jerarquias.indexOf(jerarquia) === -1) throw new Error('Elige de quién es en la familia.');
  if (listas.familias.length && listas.familias.indexOf(familia) === -1) throw new Error('Elige la familia de la lista.');
}

/**
 * Añadir a alguien a PERSONAS: usa la primera fila vacía de la tabla (ya trae la fórmula del Id);
 * si no hay, inserta una fila al final de la tabla y copia la fórmula.
 * nueva = { apodo, jerarquia, familia, menu?, alergias?, cumple? }
 */
function crearPersona(nueva, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const autor = autor_(personas.concat(leerEditores_(ss, config.excluir)), quien);
    nueva = nueva || {};
    const apodo = limpiar_(nueva.apodo, 40, 'El nombre', true);
    const jerarquia = String(nueva.jerarquia || '').trim();
    const familia = String(nueva.familia || '').trim();
    validarFicha_(ss, personas, apodo, jerarquia, familia);
    const id = idDe_(apodo, jerarquia);
    const deBaja = leerBajas_(ss).filter(function (b) { return b.id === id; })[0];
    if (deBaja) return recuperarPersona_(ss, deBaja, familia, nueva, personas, autor, vista);
    apodoLibre_(ss, apodo, []);
    if (filasPersonas_(ss).some(function (f) { return String(f[0]).trim() === id; })) throw new Error('Ya hay alguien llamado ' + apodo + ' con ese parentesco. Ponle un apodo distinto (por ejemplo, con la inicial del apellido).');
    const menu = nueva.menu && opcionesMenu_(personas).indexOf(nueva.menu) !== -1 ? nueva.menu : MENUS_BASE[0];
    const alergias = limpiar_(nueva.alergias, MAX_ALERGIAS, 'Las alergias');
    const cumple = aCumple_(nueva.cumple);

    const hoja = ss.getSheetByName(HOJA_PERSONAS);
    const n = Math.max(0, hoja.getLastRow() - 1);
    const ab = n ? hoja.getRange(2, 1, n, 2).getValues() : [];
    let fila = -1, ultimaConDatos = 1;
    ab.forEach(function (f, i) { if (String(f[1]).trim()) ultimaConDatos = i + 2; });
    for (let i = 0; i < ab.length; i++) { if (i + 2 > ultimaConDatos && !String(ab[i][1]).trim()) { fila = i + 2; break; } }
    if (fila === -1) {
      hoja.insertRowAfter(ultimaConDatos);
      fila = ultimaConDatos + 1;
      hoja.getRange(ultimaConDatos, 1).copyTo(hoja.getRange(fila, 1));
    }
    hoja.getRange(fila, 2, 1, 3).setValues([[apodo, jerarquia, familia]]);
    hoja.getRange(fila, COL_MENU, 1, 2).setValues([[menu, alergias]]);
    const celdaCumple = hoja.getRange(fila, COL_CUMPLE);
    celdaCumple.setNumberFormat('@');
    celdaCumple.setValue(cumple);
    olvidar_('personas', 'listas');
    const registro = ['Añade a ' + apodo + ' (' + jerarquia + ' · ' + familia + ')'];
    nucleoDeNueva_(ss, id, nueva, registro);
    registrar_(ss, autor, registro);
    const d = datos_(ss, vista || {});
    d.creado = id;
    return d;
  });
}

/** v4.7: volver a añadir a alguien que estaba de baja (mismo nombre y parentesco): se recupera su fila y se pone al día. */
function recuperarPersona_(ss, b, familia, nueva, personas, autor, vista) {
  const menu = nueva.menu && opcionesMenu_(personas).indexOf(nueva.menu) !== -1 ? nueva.menu : (b.menu || MENUS_BASE[0]);
  const alergias = limpiar_(nueva.alergias, MAX_ALERGIAS, 'Las alergias');
  const cumple = aCumple_(nueva.cumple);
  const fila = filaDePersona_(ss, b.id);
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  hoja.getRange(fila, 4).setValue(familia);
  hoja.getRange(fila, COL_MENU, 1, 2).setValues([[menu, alergias]]);
  if (cumple) { const c = hoja.getRange(fila, COL_CUMPLE); c.setNumberFormat('@'); c.setValue(cumple); }
  hoja.getRange(fila, COL_BAJA).setValue('');
  olvidar_('personas', 'listas');
  const registro = ['Vuelve a la lista ' + b.apodo + ' (' + b.jerarquia + ' · ' + familia + ')'];
  nucleoDeNueva_(ss, b.id, nueva, registro);
  registrar_(ss, autor, registro);
  const d = datos_(ss, vista || {});
  d.creado = b.id;
  return d;
}

/**
 * v4.7: quitar a alguien de la lista (añadido por error o porque ha fallecido). No se borra nada del Excel:
 * su fila de PERSONAS se queda con la fecha en Baja (I), se le quitan las comidas de hoy en adelante,
 * deja de ir siempre (sus fijos terminan ayer) y sus comidas pasadas se quedan como estaban.
 */
function darDeBaja(personaId, quien, vista) {
  return conBloqueo_(function (ss) {
    const config = leerConfig_(ss);
    const personas = leerPersonas_(ss, config.excluir);
    const autor = autor_(personas.concat(leerEditores_(ss, config.excluir)), quien);
    const p = personas.filter(function (x) { return x.id === personaId; })[0];
    if (!p) throw new Error('No encontramos ese nombre en la lista.');
    const hoy = hoy_();
    asegurarColumnaBaja_(ss);
    escribirEnPersonas_(ss, personaId, COL_BAJA, hoy, true);

    const alias = resolverAlias_(ss);
    const apuntes = abrirTabla_(ss.getSheetByName(HOJA_APUNTES), COLS_APUNTES, aFilaApunte_);
    let quitadas = 0;
    apuntes.vivas().forEach(function (x) {
      if (alias(x.v[3]) === personaId && x.v[1] >= hoy) { x.borrada = true; if (x.v[6] !== 'NO') quitadas++; }
    });
    apuntes.guardar();

    const fijos = abrirTabla_(hojaFijos_(ss), COLS_FIJOS, aFilaFijo_);
    let fijosCerrados = 0;
    fijos.vivas().forEach(function (x) {
      const f = x.v;
      if (alias(f[1]) !== personaId || (f[5] && f[5] < hoy)) return;
      f[5] = sumarDias_(hoy, -1);
      if (f[5] < f[4]) x.borrada = true; else x.cambiada = true;
      fijosCerrados++;
    });
    fijos.guardar();
    olvidar_('personas', 'listas', 'apuntes', 'fijos');

    registrar_(ss, autor, ['Quita de la lista a ' + p.apodo + ' (' + p.jerarquia + ' · ' + p.familia + ')' +
      (quitadas || fijosCerrados ? ': se le quitan ' + [quitadas ? quitadas + ' comidas apuntadas' : '', fijosCerrados ? 'las de siempre' : ''].filter(String).join(' y ') : '')]);
    return datos_(ss, vista || {});
  });
}

/** Las columnas nuevas de PERSONAS (I Baja; J-M, núcleos), con su título, hasta la que hace falta. */
function asegurarColumnas_(ss, hasta) {
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  if (hoja.getMaxColumns() < hasta) hoja.insertColumnsAfter(hoja.getMaxColumns(), hasta - hoja.getMaxColumns());
  for (let c = COL_BAJA; c <= hasta; c++) {
    const titulo = hoja.getRange(1, c);
    if (!String(titulo.getValue()).trim() || /^Column \d+$/.test(String(titulo.getValue()).trim())) titulo.setValue(TITULOS_EXTRA[c]);  // v4.21: las tablas ponen «Column 16»
  }
}
function sinFechasPareja_(ss, id) {  // v4.21: al deshacerse una pareja, fuera «Casados» y sus fechas
  [COL_CASADOS, COL_NOVIOS, COL_BODA].forEach(function (c) { escribirEnPersonas_(ss, id, c, '', true); });
}
function asegurarColumnaBaja_(ss) { asegurarColumnas_(ss, COL_BAJA); }

/**
 * v4.10: apellido, Hombre o Mujer, pareja e hijo de. La pareja va en los dos sentidos: si alguien tenía otra, se le quita.
 * Hijo de no puede ser uno mismo ni alguien que desciende de él (sería un círculo).
 */
function ponerNucleo_(ss, p, cambios, registro, todos) {
  const nombre = function (id) { const x = todos.filter(function (t) { return t.id === id; })[0]; return x ? x.apodo : id; };
  const existe = function (id) { return todos.some(function (t) { return t.id === id; }); };
  asegurarColumnas_(ss, COL_BODA);
  if (cambios.fallecio !== undefined) {
    const texto = String(cambios.fallecio || '').trim();
    const fallecio = aFallecio_(texto);
    if (texto && !fallecio) throw new Error('La fecha de fallecimiento tiene que ser un día, mes y año que existan (o mes y año, o solo el año), y no de después de hoy.');
    if (fallecio !== (p.fallecio || '')) { escribirEnPersonas_(ss, p.id, COL_FALLECIO, fallecio, true); registro.push(p.apodo + (fallecio === 'Sí' ? ': falleció (sin saber cuándo)' : (fallecio ? ': falleció (' + fallecio + ')' : ': ya no consta que haya fallecido'))); }
  }
  if (cambios.nombre !== undefined) {
    const nombreReal = limpiar_(cambios.nombre, 40, 'El nombre', true);
    if (nombreReal !== p.nombre) { escribirEnPersonas_(ss, p.id, COL_NOMBRE, nombreReal, true); registro.push('Nombre de ' + p.apodo + ': ' + (nombreReal || 'borrado')); }
  }
  if (cambios.apellido !== undefined) {
    const apellido = limpiar_(cambios.apellido, 40, 'El apellido', true);
    if (apellido !== p.apellido) { escribirEnPersonas_(ss, p.id, COL_APELLIDO, apellido, true); registro.push('Apellido de ' + p.apodo + ': ' + (apellido || 'borrado')); }
  }
  if (cambios.sexo !== undefined) {
    const sexo = String(cambios.sexo || '').trim();
    if (sexo && SEXOS.indexOf(sexo) === -1) throw new Error('Elige hombre o mujer.');
    if (sexo !== p.sexo) { escribirEnPersonas_(ss, p.id, COL_SEXO, sexo, true); registro.push(p.apodo + ': ' + (sexo ? sexo.toLowerCase() : 'sin decir si es hombre o mujer')); }
  }
  if (cambios.hijoDe !== undefined) {
    const padre = String(cambios.hijoDe || '').trim();
    if (padre) {
      if (padre === p.id) throw new Error(p.apodo + ' no puede ser hijo de sí mismo.');
      if (!existe(padre)) throw new Error('No encontramos a su padre o su madre en la lista.');
      const padreDe = {};
      todos.forEach(function (t) { padreDe[t.id] = t.hijoDe; });
      for (let x = padre, i = 0; x && i < 50; x = padreDe[x], i++) {
        if (x === p.id) throw new Error(nombre(padre) + ' no puede ser padre o madre de ' + p.apodo + ': ya desciende de él o de ella.');
      }
    }
    if (padre !== p.hijoDe) { escribirEnPersonas_(ss, p.id, COL_HIJO_DE, padre, true); registro.push(p.apodo + (padre ? ' es hijo o hija de ' + nombre(padre) : ' ya no tiene padre o madre apuntado')); }
  }
  if (cambios.pareja !== undefined) {
    const nueva = String(cambios.pareja || '').trim();
    if (nueva === p.id) throw new Error(p.apodo + ' no puede ser su propia pareja.');
    if (nueva && !existe(nueva)) throw new Error('No encontramos a su pareja en la lista.');
    if (nueva !== p.pareja) {
      const parejaDe = {};
      todos.forEach(function (t) { parejaDe[t.id] = t.pareja; });
      // Al cambiar de pareja, «Casados» se borra en las dos parejas que se deshacen y en la nueva (v4.12)
      if (p.pareja && parejaDe[p.pareja] === p.id) { escribirEnPersonas_(ss, p.pareja, COL_PAREJA, '', true); sinFechasPareja_(ss, p.pareja); }
      if (nueva) {
        const anterior = parejaDe[nueva];
        if (anterior && anterior !== p.id && parejaDe[anterior] === nueva) { escribirEnPersonas_(ss, anterior, COL_PAREJA, '', true); sinFechasPareja_(ss, anterior); }
        escribirEnPersonas_(ss, nueva, COL_PAREJA, p.id, true);
        sinFechasPareja_(ss, nueva);
      }
      escribirEnPersonas_(ss, p.id, COL_PAREJA, nueva, true);
      sinFechasPareja_(ss, p.id);
      p.casados = ''; p.novios = ''; p.boda = '';
      registro.push(nueva ? p.apodo + ' y ' + nombre(nueva) + ' son pareja' : p.apodo + ' ya no tiene pareja');
    }
  }
  if (cambios.casados !== undefined) {
    const casados = String(cambios.casados || '').trim();
    if (casados && CASADOS.indexOf(casados) === -1) throw new Error('Elige si están casados: sí o no.');
    const pareja = cambios.pareja !== undefined ? String(cambios.pareja || '').trim() : p.pareja;
    if (casados && !pareja) throw new Error('Para decir si están casados, elige primero su pareja.');
    if (casados !== p.casados) {
      escribirEnPersonas_(ss, p.id, COL_CASADOS, casados, true);
      if (pareja) escribirEnPersonas_(ss, pareja, COL_CASADOS, casados, true);
      if (pareja) registro.push(p.apodo + ' y ' + nombre(pareja) + (casados === 'Sí' ? ': casados' : casados === 'No' ? ': no casados' : ': sin decir si están casados'));
    }
  }
  // v4.21: cuándo empezaron a salir y cuándo se casaron, en los dos de la pareja
  [['novios', COL_NOVIOS, 'empezaron a salir', 'cuándo empezaron a salir'], ['boda', COL_BODA, 'se casaron', 'la boda']].forEach(function (x) {
    if (cambios[x[0]] === undefined) return;
    const texto = String(cambios[x[0]] || '').trim();
    const fecha = aFechaParcial_(texto, 1850, x[0] === 'boda' ? 10 : 0);  // v4.23: la boda, también la que viene
    if (texto && !fecha) throw new Error('La fecha de ' + x[3] + ' tiene que ser un día, mes y año que existan (o mes y año, o solo el año)' + (x[0] === 'boda' ? ', de aquí a diez años como mucho.' : ', y no de después de hoy.'));
    const pareja = cambios.pareja !== undefined ? String(cambios.pareja || '').trim() : p.pareja;
    if (fecha && !pareja) throw new Error('Para poner la fecha de ' + x[3] + ', elige primero su pareja.');
    if (fecha !== (p[x[0]] || '')) {
      escribirEnPersonas_(ss, p.id, x[1], fecha, true);
      if (pareja) escribirEnPersonas_(ss, pareja, x[1], fecha, true);
      registro.push(p.apodo + (pareja ? ' y ' + nombre(pareja) : '') + (fecha ? ' ' + x[2] + ': ' + fecha : ': sin fecha de ' + x[3]));
    }
  });
  olvidar_('personas');
}

/** El núcleo de alguien que se acaba de añadir (o recuperar). */
function nucleoDeNueva_(ss, id, nueva, registro) {
  if (!CAMPOS_NUCLEO.some(function (k) { return nueva[k]; })) return;
  SpreadsheetApp.flush();
  olvidar_('personas');
  const config = leerConfig_(ss);
  const todos = leerPersonas_(ss, config.excluir).concat(leerEditores_(ss, config.excluir));
  const p = todos.filter(function (t) { return t.id === id; })[0];
  if (p) ponerNucleo_(ss, p, { nombre: nueva.nombre || '', apellido: nueva.apellido || '', sexo: nueva.sexo || '', pareja: nueva.pareja || '', hijoDe: nueva.hijoDe || '', casados: nueva.casados || '', fallecio: nueva.fallecio || '', novios: nueva.novios || '', boda: nueva.boda || '' }, registro, todos);
}

function filaDePersona_(ss, personaId) {
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  const ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]).trim() === personaId) return i + 2; }
  throw new Error('No encontramos ese nombre en la lista.');
}

/** Cambiar apodo, jerarquía o familia. Si cambia el Id, guarda el alias para que no pierda sus apuntes. */
function renombrarPersona_(ss, p, cambios, registro) {
  const config = leerConfig_(ss);
  const personas = leerPersonas_(ss, config.excluir);
  const apodo = cambios.apodo !== undefined ? limpiar_(cambios.apodo, 40, 'El nombre', true) : p.apodo;
  const jerarquia = cambios.jerarquia !== undefined ? String(cambios.jerarquia).trim() : p.jerarquia;
  const familia = cambios.familia !== undefined ? String(cambios.familia).trim() : p.familia;
  if (apodo === p.apodo && jerarquia === p.jerarquia && familia === p.familia) return null;
  validarFicha_(ss, personas, apodo, jerarquia, familia);
  if (apodo !== p.apodo) apodoLibre_(ss, apodo, [p.id]);
  const nuevoId = idDe_(apodo, jerarquia);
  if (nuevoId !== p.id && filasPersonas_(ss).some(function (f) { return String(f[0]).trim() === nuevoId; })) {
    throw new Error('Ya hay alguien llamado ' + apodo + ' con ese parentesco.');
  }
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  const ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  let fila = -1;
  for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]).trim() === p.id) { fila = i + 2; break; } }
  if (fila === -1) throw new Error('No encontramos ese nombre en la lista.');
  hoja.getRange(fila, 2, 1, 3).setValues([[apodo, jerarquia, familia]]);
  if (nuevoId !== p.id) {
    const alias = ss.getSheetByName(HOJA_ALIAS) || crearHoja_(ss, HOJA_ALIAS, ['ID_ANTIGUO', 'ID_NUEVO', 'NOTA']);
    const r = alias.getRange(alias.getLastRow() + 1, 1, 1, 3);
    comoTexto_(r);
    r.setValues([[p.id, nuevoId, 'Cambiado desde la web el ' + ahora_().slice(0, 10)]]);
  }
  olvidar_('personas', 'alias', 'apuntes', 'fijos', 'listas');
  const partes = [];
  if (apodo !== p.apodo) partes.push('se llama ' + apodo);
  if (jerarquia !== p.jerarquia) partes.push(jerarquia);
  if (familia !== p.familia) partes.push('familia ' + familia);
  registro.push(p.apodo + ': ' + partes.join(', '));
  return { antes: p.id, despues: nuevoId };
}

/** Escribe una celda de la fila de esa persona en PERSONAS (F, G, H o I). La columna A está protegida y no se toca. */
function escribirEnPersonas_(ss, personaId, columna, valor, esTexto) {
  const hoja = ss.getSheetByName(HOJA_PERSONAS);
  if (hoja.getMaxColumns() < columna) {
    try {
      hoja.insertColumnsAfter(hoja.getMaxColumns(), columna - hoja.getMaxColumns());
      if (columna === COL_CUMPLE) hoja.getRange(1, COL_CUMPLE).setValue('Cumple');
    } catch (e) {
      throw new Error('Falta la columna Cumple (H) en PERSONAS. Hay que añadirla en el Excel.');
    }
  }
  const ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  let fila = -1;
  for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]).trim() === personaId) { fila = i + 2; break; } }
  if (fila === -1) throw new Error('No encontramos ese nombre en la lista.');
  const celda = hoja.getRange(fila, columna);
  if (esTexto) celda.setNumberFormat('@');
  celda.setValue(valor);
  olvidar_('personas');
}

function registrar_(ss, autor, lineas) {
  if (!lineas.length) return;
  const hoja = ss.getSheetByName(HOJA_CAMBIOS) || crearHoja_(ss, HOJA_CAMBIOS, ['CUANDO', 'QUIEN_ID', 'QUIEN', 'CAMBIO']);
  const cuando = ahora_();
  const filas = lineas.map(function (l) { return [cuando, autor.id, autor.apodo, l]; });
  const rango = hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 4);
  comoTexto_(rango);
  rango.setValues(filas);
}

function autor_(todos, quien) {
  const a = todos.filter(function (p) { return p.id === quien; })[0];
  if (!a) throw new Error('Elige primero quién eres, para guardar quién hace cada cambio.');
  return a;
}

/* ---------- Validaciones ---------- */

function validarDia_(config, fecha) {
  if (!esFecha_(fecha)) throw new Error('Fecha no válida.');
  if (fecha < config.inicio) throw new Error('Ese día es anterior al inicio del calendario.');
}

function validarTurno_(config, fecha, turno) {
  if (TURNOS.indexOf(turno) === -1) throw new Error('Turno no válido.');
  validarDia_(config, fecha);
}

function conBloqueo_(fn) {
  reiniciar_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Ahora mismo hay otra persona guardando. Vuelve a probar en unos segundos.');
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const r = fn(ss);
    invalidarCache_();
    return r;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Utilidades ---------- */

/**
 * v4.15.2: formato de texto (para que las fechas y los Ids no se conviertan), columna a columna:
 * en una pestaña con formato de tabla, Google no deja hacerlo de golpe en varias columnas
 * («Haz una selección en una sola columna para realizar acciones a nivel de columna»).
 */
function comoTexto_(rango) {
  const hoja = rango.getSheet(), fila = rango.getRow(), col = rango.getColumn(), filas = rango.getNumRows();
  for (let i = 0; i < rango.getNumColumns(); i++) hoja.getRange(fila, col + i, filas, 1).setNumberFormat('@');
}

function hojaDias_(ss) {
  return ss.getSheetByName(HOJA_DIAS) || crearHoja_(ss, HOJA_DIAS,
    ['FECHA', 'NOTA', 'SIN_TURNO', 'CAMBIADO_POR', 'CAMBIADO_EN', 'SIN_COMIDA', 'MOTIVO_COMIDA', 'SIN_CENA', 'MOTIVO_CENA', 'NOTA_SERVICIO', 'SIN_DORMIR', 'MOTIVO_DORMIR',
      'NOTA_POR', 'NOTA_EN', 'SERVICIO_POR', 'SERVICIO_EN', 'COMIDA_POR', 'COMIDA_EN', 'CENA_POR', 'CENA_EN', 'DORMIR_POR', 'DORMIR_EN']);
}

function crearHoja_(ss, nombre, cabecera) {
  const hoja = ss.insertSheet(nombre);
  hoja.getRange(1, 1, 1, cabecera.length).setValues([cabecera]);
  hoja.setFrozenRows(1);
  return hoja;
}

/** Texto corto y seguro para el Excel. En celdas de texto no hace falta el apóstrofo. */
function limpiar_(v, max, que, esCeldaTexto) {
  let texto = String(v || '').replace(/\s+/g, ' ').trim();
  if (texto.length > max) throw new Error(que + ' caben en ' + max + ' letras como mucho.');
  if (!esCeldaTexto && /^[=+\-@]/.test(texto)) texto = "'" + texto;
  return texto;
}

/** Cumpleaños como texto dd/mm (acepta fechas del Excel y «5/3»). Vacío si no es válido. */
/** Cumpleaños: dd/mm o, con el año (v4.13), dd/mm/aaaa. Una fecha escrita a mano en el Excel se queda sin año (el Excel le pone el de hoy). */
function aCumple_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM');
  const t = String(v || '').trim();
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return aFechaParcial_(t, 1900);  // con el año (v4.13), o solo mes y año, o solo el año (v4.16)
  const d = Number(m[1]), mes = Number(m[2]);
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (!max || d < 1 || d > max) return '';
  return ('0' + d).slice(-2) + '/' + ('0' + mes).slice(-2);
}

/**
 * v4.16: una fecha como se sepa: dd/mm/aaaa, mm/aaaa o aaaa. Se guarda siempre dd/mm/aaaa, con 00 en lo que no se sabe
 * («00/01/2008» es enero de 2008; «00/00/1928», 1928). Entre el año «desde» y hoy. Una celda de fecha del Excel, entera.
 */
/* v4.20: el fallecimiento, con su fecha (como se sepa) o «Sí» si no se sabe cuándo */
function aFallecio_(v) {
  return /^s[ií]$/i.test(String(v || '').trim()) ? 'Sí' : aFechaParcial_(v, 1850);
}

function aFechaParcial_(v, desde, futuro) {  // v4.23: futuro = años que puede ir por delante de hoy (la boda)
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
  const t = String(v || '').trim();
  let m, d = 0, mes = 0, ano = 0;
  if ((m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) { d = Number(m[1]); mes = Number(m[2]); ano = Number(m[3]); }
  else if ((m = t.match(/^(\d{1,2})[\/\-.](\d{4})$/))) { mes = Number(m[1]); ano = Number(m[2]); }
  else if ((m = t.match(/^(\d{4})$/))) { ano = Number(m[1]); }
  else return '';
  if (ano < (desde || 1850) || ano > Number(hoy_().slice(0, 4)) + (futuro || 0) || mes > 12 || (!mes && d)) return '';
  if (d && d > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]) return '';
  return ('0' + d).slice(-2) + '/' + ('0' + mes).slice(-2) + '/' + ano;
}

function aFecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function aHora_(v, porDefecto) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : porDefecto;
}

function nombreTurno_(t) { return t === 'CENA' ? 'cena' : (t === 'DORMIR' ? 'noche' : 'comida'); }
function texto_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") : String(v || ''); }
function esSi_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function esFecha_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function ahora_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

function aUTC_(iso) { const p = iso.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function sumarDias_(iso, n) { return new Date(aUTC_(iso) + n * 86400000).toISOString().slice(0, 10); }
function diasEntre_(a, b) { return Math.round((aUTC_(b) - aUTC_(a)) / 86400000); }
function diaSemana_(iso) { return new Date(aUTC_(iso)).getUTCDay(); }
function lunesDe_(iso) { const dow = diaSemana_(iso) || 7; return sumarDias_(iso, 1 - dow); }
function ddmm_(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

