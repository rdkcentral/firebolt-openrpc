/* ${method.name} - ${method.description} */
typedef void* (*${info.Title}${method.Name}Callback)( const void* userData, ${method.pulls.param.type} );
uint32_t ${info.Title}_Register_${method.Name}( ${info.Title}${method.Name}Callback userCB, const void* userData );
uint32_t ${info.Title}_Unregister_${method.Name}( ${info.Title}${method.Name}Callback userCB);

