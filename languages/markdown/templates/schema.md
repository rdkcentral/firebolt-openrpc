---
title: ${info.title}
---
# ${info.title} Schema
---
Version ${info.version}


## JSON-Schema
This document was generated from a JSON-Schema, and is intended to provide a human readable overview and examples of the methods contained in the module.

For the full schema, see the link below.

| Schema |
|--------|
| [${module}](https://github.com/rdkcentral/firebolt-openrpc/blob/feature/badger-parity/src/schemas/${module}) |

## Table of Contents
 
 - Schemas
${toc.schemas}

${if.schemas}

## Schemas

### ${schema.title}

```typescript
${schema.shape}
```

See also: ${schema.seeAlso}


<details>
  <summary><b>Examples</b></summary>

```json
${schema.example}
```

</details>

${end.example}

${if.description}
#### Details

${schema.description}

${end.if.description}

---
${end.schema}
${end.if.schemas}