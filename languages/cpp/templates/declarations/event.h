    /* ${method.name} - ${method.description} */
    struct I${method.Name}Notification {
        virtual void ${method.rpc.name}( ${event.signature.callback.params}${if.event.callback.params}, ${end.if.event.callback.params}${event.result.type} ) = 0;
    };
    // signature callback params: ${event.signature.callback.params}
    // method result properties : ${method.result.properties}
    virtual void subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
    virtual void unsubscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
${if.globalsubscriber}
    virtual void globalSubscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
    virtual void globalUnsubscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
${end.if.globalsubscriber}