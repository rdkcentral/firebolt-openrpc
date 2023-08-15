/* ${method.name} - ${method.description} */
typedef void* (*${info.Title}${method.Name}Callback)( const void* userData, ${method.pulls.param.type} );
int32_t ${info.Title}_Register_${method.Name}( ${info.Title}${method.Name}Callback userCB, const void* userData );
int32_t ${info.Title}_Unregister_${method.Name}( ${info.Title}${method.Name}Callback userCB);
