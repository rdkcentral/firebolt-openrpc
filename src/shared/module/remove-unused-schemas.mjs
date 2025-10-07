/**
 * remove-unused-schemas.js
 * ----------------
 * utilities for cleaning unused schemas
 */

/**
 * Recursively find all $ref values in an object.
 * @param {object} obj
 * @param {Set<string>} refs
 * @returns {Set<string>}
 */
function findRefs(obj, refs = new Set()) {
  if (!obj || typeof obj !== "object") return refs;
  if (Array.isArray(obj)) {
    obj.forEach(item => findRefs(item, refs));
  } else {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "$ref" && typeof value === "string") {
        refs.add(value);
      } else {
        findRefs(value, refs);
      }
    }
  }
  return refs;
}

/**
 * Resolve a $ref path like "#/components/schemas/EventObject"
 * inside a given object.
 * @param {string} ref
 * @param {object} root
 * @returns {object|null}
 */
function resolveRef(ref, root) {
  if (!ref.startsWith("#/")) return null;
  const pathParts = ref.slice(2).split("/");
  let target = root;
  for (const part of pathParts) {
    if (target && typeof target === "object") target = target[part];
    else return null;
  }
  return target;
}

/**
 * Collect all transitive references from an initial set of refs.
 * @param {Set<string>} refSet
 * @param {object} root
 * @param {Set<string>} referenced
 */
function collectRefs(refSet, root, referenced = new Set()) {
  const queue = [...refSet];
  while (queue.length) {
    const ref = queue.pop();
    if (referenced.has(ref)) continue;
    referenced.add(ref);
    const target = resolveRef(ref, root);
    if (target) {
      const newRefs = findRefs(target);
      for (const newRef of newRefs) {
        if (!referenced.has(newRef)) queue.push(newRef);
      }
    }
  }
  return referenced;
}

/**
 * Clean unused schemas from an OpenRPC-like JSON definition.
 * @param {object} spec
 * @returns {object} cleaned deep-cloned JSON object
 */
function removeUnusedSchemas(spec) {
  const clone =
    typeof structuredClone === "function"
      ? structuredClone(spec)
      : JSON.parse(JSON.stringify(spec));

  const referenced = new Set();
  const initialRefs = findRefs(clone.methods);
  collectRefs(initialRefs, clone, referenced);

  // Prune components/schemas
  if (clone.components?.schemas) {
    for (const key of Object.keys(clone.components.schemas)) {
      const refPath = `#/components/schemas/${key}`;
      if (!referenced.has(refPath)) delete clone.components.schemas[key];
    }
  }

  // Prune x-schemas
  if (clone["x-schemas"]) {
    for (const nsKey of Object.keys(clone["x-schemas"])) {
      const ns = clone["x-schemas"][nsKey];
      for (const schemaKey of Object.keys(ns)) {
        if (schemaKey === "uri") continue;
        const refPath = `#/x-schemas/${nsKey}/${schemaKey}`;
        if (!referenced.has(refPath)) delete ns[schemaKey];
      }
    }
  }

  return clone;
}

export {
findRefs,
collectRefs,
resolveRef,    
removeUnusedSchemas
} 