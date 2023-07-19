/* ${method.name} - ${method.description} */
typedef void (*${info.Title}${method.Name}Callback)( const void* userData, ${event.signature.callback.params}${if.event.params}, ${end.if.event.params}${method.result.properties} );
int ${info.title}_Register_${method.Name}( ${event.signature.params}${if.event.params}, ${end.if.event.params}${info.Title}${method.Name}Callback userCB, const void* userData );
int ${info.title}_Unregister_${method.Name}( ${info.Title}${method.Name}Callback userCB);
