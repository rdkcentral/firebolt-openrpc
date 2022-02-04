---
title: ${info.title}
---

# ${info.title} Module
---
Version ${info.version}

## Overview
 ${info.description}

## OpenRPC
Firebolt APIs are maintained in the [${package.repository.name}](${package.repository}) GitHub repository.

You can see this API in the [${module}](https://github.com/rdkcentral/firebolt-core-sdk/blob/main/src/modules/${module}) OpenRPC JSON-Schema document. 

## Table of Contents
 - [Overview](#overview)
 - [OpenRPC](#openrpc)
 - [Usage](#usage)
 - [Methods](#methods)
${toc.methods}
${if.events}
 - [Events](#events)
${toc.events}
${end.if.events}
 - [Schemas](#schemas)
${toc.schemas}

<span></span>

${if.javascript}
## Usage
To use the ${info.title} module, you can import it into your project from the Firebolt SDK:

```javascript
import { ${info.title} } from '${package.name}'
```
${end.if.javascript}


## Methods
${methods}

${if.events}

## Events

${events}

### Additional events
The following events are documented as part of a related set of method APIs.

For more information, follow the links under the "Documentation" column.

| JavaScript | RPC | Payload | Documentation |
|-------|---------|----------|-------------|
${additionalEvents}

${end.if.events}

${if.schemas}

## Schemas

### ${schema.title}

${if.description}

${schema.description}

${end.if.description}
```typescript
${schema.shape}
```

See also: ${schema.seeAlso}

---
${end.schema}
${end.if.schemas}