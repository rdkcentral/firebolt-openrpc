/* ${method.name} - ${method.description} */
struct I{method.Name}Notification {
    virtual void ${method.Name} ( ${method.pulls.param.type}& value ) = 0;  
};
        
virtual int32_t subscribe ( I{method.Name}Notification& notification ) = 0;
virtual int32_t unsubscribe ( I{method.Name}Notification& notification ) = 0;

