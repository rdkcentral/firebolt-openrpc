---
title: ${info.title}
---

# ${info.title} Module
---
Version ${info.version}

## Table of Contents
${toc}

${if.public}
## Usage
To use the ${info.title} module, you can import it into your project from the Firebolt SDK:

```javascript
import { ${info.title} } from '${package.name}'
```
${end.if.public}

## Overview
 ${info.description}

/* ${METHODS} */

/* ${PRIVATE_METHODS} */

/* ${EVENTS} */

/* ${PRIVATE_EVENTS} */

/* ${PROVIDERS} */

/* ${SCHEMAS} */
