    /* ${method.name} - ${method.description} */
    struct I${method.Name}Notification {
        virtual void ${method.title}( ${event.signature.callback.params}${if.event.params}, ${end.if.event.params}${event.result.type} ) = 0;
    };
    // signature callback params: ${event.signature.callback.params}
    // method result properties : ${method.result.properties}
    virtual void subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
    virtual void unsubscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
