/* ${method.name} - ${method.description}
${method.params.annotations}${if.deprecated} * @deprecated ${method.deprecation}${end.if.deprecated} */
int32_t F${info.Title}_${method.Name}( ${method.signature.params}${if.result}${if.params}, ${end.if.params}${method.result.type}* ${method.result.name}${end.if.result}${if.signature.empty}void${end.if.signature.empty} );
