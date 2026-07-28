// Regresion: un conv-<timestamp> de sesion no debe llegar nunca a una query contra conversations.id (uuid).
// Ejecutar: node server/conversationId.test.js
import assert from "node:assert/strict";
import { createPostgresStore } from "./database.js";

const queries = [];
const fakePool = {
  async query(text, params) {
    queries.push({ text, params });
    return { rows: [] };
  }
};
const store = createPostgresStore(fakePool, { conversations: [] });

assert.equal(await store.conversationById("conv-1784588761497"), null);
assert.equal(await store.conversationById("conv-1001"), null);
assert.equal(await store.conversationById(""), null);
assert.equal(queries.length, 0, "un id que no es uuid no debe generar SQL");

assert.equal(await store.conversationById("6fa5ce3e-9142-41ed-9cae-52b1a44ad8b1"), null);
assert.equal(queries.length, 1, "un uuid valido si debe consultar la tabla");

console.log("ok: conversationById filtra ids de sesion no-uuid");
