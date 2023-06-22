/* ${method.name} - ${method.description} */
typedef void (*${info.Title}${method.Name}Callback)( const void* userData, ${event.signature.callback.params}${if.event.params}, ${end.if.event.params}${event.result.type} );
uint32_t ${info.Title}_Register_${method.Name}( ${event.signature.params}${if.event.params}, ${end.if.event.params}${info.Title}${method.Name}Callback userCB, const void* userData );
uint32_t ${info.Title}_Unregister_${method.Name}( ${info.Title}${method.Name}Callback userCB);
