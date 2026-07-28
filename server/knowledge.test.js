// Seleccion acotada de la base de conocimiento, contra los documentos reales de db/knowledge.
// Ejecutar: node server/knowledge.test.js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildKnowledgeContext, normalizeCodeKey } from "./knowledge.js";

const dir = fileURLToPath(new URL("../db/knowledge/", import.meta.url));
const contents = {
  fault_codes: await readFile(`${dir}kb-fault-codes.json`, "utf8"),
  brand_kb: await readFile(`${dir}kb-conocimiento.md`, "utf8"),
  site_pages: await readFile(`${dir}kb-paginas-sitio.json`, "utf8")
};

contents.system_prompt = await readFile(`${dir}kb-prompt-sistema.md`, "utf8");

function storeWith(keys, { active = true } = {}) {
  const types = { fault_codes: "json", brand_kb: "text", site_pages: "json", system_prompt: "text" };
  return {
    async knowledgeVersions() {
      return keys.map((key) => ({ key, docType: types[key], isActive: active, updatedAt: `v-${key}` }));
    },
    async knowledgeDocument(key) {
      return { key, docType: types[key], content: contents[key] };
    }
  };
}

const faults = storeWith(["fault_codes"]);
const faultBlock = async (text) => (await buildKnowledgeContext(faults, text)).blocks.find((b) => b.fuente === "codigos de falla");

// E4, E04 y E004 son el mismo codigo; el numero pelado queda como #4.
assert.equal(normalizeCodeKey("E004"), "E4");
assert.equal(normalizeCodeKey("E04"), "E4");
assert.equal(normalizeCodeKey("E4"), "E4");
assert.equal(normalizeCodeKey("4"), "#4");
assert.equal(normalizeCodeKey("ERROR1"), "ERROR1");

// Modelo + codigo: solo ese modelo.
const exacto = await faultBlock("mi M2MAX marca E04, que hago");
assert.equal(exacto.coincidencia, "modelo y codigo");
assert.ok(exacto.codigos.every((item) => item.modelo === "M2MAX"), "solo entradas del modelo mencionado");
assert.ok(exacto.codigos[0].pasos.length, "incluye pasos de reparacion");

// El prefijo varia por modelo: "E04" tambien debe encontrar el codigo numerico 4 de M2MAX.
assert.equal((await faultBlock("mi M2MAX da el codigo 4")).coincidencia, "modelo y codigo");

// Solo codigo: tope de entradas y aviso de que falta el modelo.
const soloCodigo = await faultBlock("mi scooter marca E4");
assert.equal(soloCodigo.coincidencia, "solo codigo");
assert.ok(soloCodigo.codigos.length <= 6, "tope de 6 entradas sin modelo");
assert.match(soloCodigo.nota, /pregunta cual tiene/);

// Modelo identificado sin ese codigo: nunca sirve pasos de otro modelo.
const sinCodigo = await faultBlock("mi F6PRO marca E04");
assert.equal(sinCodigo.coincidencia, "modelo sin ese codigo");
assert.ok(sinCodigo.codigos.every((item) => item.modelo === "F6PRO"), "solo codigos del propio modelo");

// Solo modelo, sin codigo: no se inyecta nada.
assert.equal(await faultBlock("tengo una F6PRO"), undefined);
// "una" es palabra comun: el modelo UNA no debe dispararse en minusculas.
assert.equal(await faultBlock("quiero comprar una scooter"), undefined);
// Un modelo mencionado solo (P1 tiene forma de codigo) tampoco inyecta.
assert.equal(await faultBlock("me interesa la P1"), undefined);
// Sin codigos ni modelos, nada.
assert.equal(await faultBlock("cuanto cuesta el envio"), undefined);

// Tope duro de caracteres.
const grande = await faultBlock("mi T1 marca error 4");
assert.ok(JSON.stringify(grande.codigos).length <= 6000, "respeta el tope de caracteres");

// La base de marca es contexto base: entra siempre.
const ligeros = storeWith(["brand_kb", "site_pages", "fault_codes", "system_prompt"]);
const saludo = await buildKnowledgeContext(ligeros, "hola");
const marca = saludo.blocks.find((b) => b.fuente === "base de marca");
assert.ok(marca.contenido.includes("Honey Whale"), "la base de marca entra completa");

// Las paginas del sitio son bajo demanda: no en un saludo ni en una consulta de pedido.
const paginasDe = async (text) => (await buildKnowledgeContext(ligeros, text)).blocks.find((b) => b.fuente === "paginas del sitio");
assert.equal(await paginasDe("hola"), undefined);
assert.equal(await paginasDe("donde va mi pedido"), undefined);
assert.equal(await paginasDe("cuanto cuesta la scooter"), undefined);
for (const pide of [
  "donde veo la garantia",
  "necesito mi factura",
  "tienen manuales del scooter",
  "pasame el enlace de soporte",
  "donde estan sus sucursales",
  "quiero el aviso de privacidad"
]) {
  const paginas = await paginasDe(pide);
  assert.ok(paginas, `deberia inyectar paginas para: ${pide}`);
  assert.ok(paginas.paginas.length >= 40 && paginas.paginas[0].url.startsWith("http"), "paginas con titulo y url");
  assert.ok(!JSON.stringify(paginas).includes("resumen"), "las paginas van sin resumen para no inflar el prompt");
}

// El prompt alterno nunca es contexto, ni siquiera si alguien lo activa.
const conPrompt = await buildKnowledgeContext(storeWith(["system_prompt"]), "donde veo la garantia");
assert.deepEqual(conPrompt.blocks, [], "system_prompt no se inyecta aunque este activo");

// Fallback: inactivo o vacio => sin bloques, el prompt queda igual que antes del modulo.
assert.deepEqual((await buildKnowledgeContext(storeWith(["brand_kb", "fault_codes"], { active: false }), "mi M2MAX marca E04")).blocks, []);
assert.deepEqual((await buildKnowledgeContext({ async knowledgeVersions() { return []; } }, "hola")).blocks, []);
assert.deepEqual((await buildKnowledgeContext({}, "hola")).blocks, []);

console.log("ok: seleccion de base de conocimiento (codigos, modelos, topes y fallback)");
