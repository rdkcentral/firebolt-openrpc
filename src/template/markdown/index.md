---
title: ${info.title}
---

# ${info.title} Module
---
Version ${info.version}

## OpenRPC
This document was generated from an OpenRPC JSON-Schema, and is intended to provide a human readable overview and examples of the methods contained in the module.

For the full schema, see the link below.

| Schema |
|--------|
| [${module}](https://github.com/rdkcentral/firebolt-core-sdk/blob/main/src/modules/${module}) |


## Table of Contents
 - [Usage](#usage)
 - [Overview](#overview)
 - [Events](#events)
${toc.events}
 - [Methods](#methods)
${toc.methods}
 - [Schemas](#schemas)
${toc.schemas}

<span></span>

${if.javascript}
## Usage
To use the ${info.title} module, you can import it into your project from the Firebolt SDK:

```javascript
import { ${info.title} } from '${pkg.name}'
```
${end.if.javascript}


## Overview
${info.description}

## Events
${events}

## Methods
${methods}

${if.schemas}

## Schemas

### ${schema.title}

```typescript
${schema.shape}
```

See also: ${schema.seeAlso}

${if.description}
#### Details

${schema.description}

${end.if.description}

---
${end.schema}
${end.if.schemas}