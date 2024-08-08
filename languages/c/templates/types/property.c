/* ${property} */
${title} ${parent.title}_Get_${Property}(${parent.title} handle);
void ${parent.title}_Set_${Property}(${parent.title} handle, ${title} ${property});
${if.optional}bool ${parent.title}_Has_${Property}(${parent.title} handle);
void ${parent.title}_Clear_${Property}(${parent.title} handle, ${title} ${property});
${end.if.optional}