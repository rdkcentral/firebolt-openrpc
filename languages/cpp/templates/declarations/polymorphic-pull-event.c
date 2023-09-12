    /* ${method.name} - ${method.description} */
    struct I${method.Name}Notification {
        virtual void ${method.Name}( ${method.pulls.param.type}& value ) = 0;
    };

    virtual void Subscribe( I${method.Name}Notification& notification, Firebolt_Error *err = nullptr ) = 0;
    virtual void Unsubscribe( I${method.Name}Notification& notification, Firebolt_Error *err = nullptr ) = 0;

