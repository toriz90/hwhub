// Heuristica de extraccion del numero de pedido: formas naturales del cliente sin tomar precios, fechas ni telefonos.
// Ejecutar: node server/orderNumber.test.js
import assert from "node:assert/strict";
import { extractOrderNumber } from "./connectors.js";

const positivos = [
  ["pedido 12345", "12345"],
  ["#12345", "12345"],
  ["pedido #12345", "12345"],
  ["orden 12345", "12345"],
  ["mi pedido es el 12345", "12345"],
  ["mi número de pedido es 12345", "12345"],
  ["mi numero de pedido es 12345", "12345"],
  ["el 12345", "12345"],
  ["es el 12345", "12345"],
  ["12345", "12345"],
  ["Hola, quiero saber de mi pedido. Es el 998877, gracias.", "998877"],
  ["mi pedido es el 2024", "2024"], // con ancla, un numero con forma de anio si es folio
  ["numero de orden: 45231", "45231"]
];

const negativos = [
  "pedido de 2024",
  "compre hace 2 años",
  "hace 400 dias que espero",
  "pague $1500",
  "el total fue $ 1500",
  "el total fue 1,500.00",
  "mi pedido llego el 15/03/2026",
  "la fecha fue 2026-05-12",
  "mi telefono es el 5512345678",
  "mi whatsapp es 5512345678",
  "la guia es el 78945612",
  "no tengo el numero a la mano"
];

for (const [texto, esperado] of positivos) {
  assert.equal(extractOrderNumber(texto), esperado, `deberia extraer ${esperado} de: ${texto}`);
}

for (const texto of negativos) {
  assert.equal(extractOrderNumber(texto), null, `no deberia extraer nada de: ${texto}`);
}

// Desambiguacion: el texto llega como historial + mensaje actual, asi que gana el ultimo numero valido.
assert.equal(
  extractOrderNumber("pedido 111222\nperdon, me equivoque\nel pedido correcto es el 999888"),
  "999888"
);
// Un candidato descartado no pisa al valido anterior.
assert.equal(extractOrderNumber("mi pedido es el 12345\nmi telefono es el 5512345678"), "12345");

console.log(`ok: ${positivos.length} positivos y ${negativos.length} negativos de numero de pedido`);
