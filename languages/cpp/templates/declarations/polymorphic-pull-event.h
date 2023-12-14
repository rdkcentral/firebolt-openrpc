    /* ${method.name} - ${method.description} */
    struct I${method.Name}Notification {
        virtual ${method.pulls.type} ${method.title}( ${method.pulls.param.type} ) = 0;
    };
    virtual void subscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
    virtual void unsubscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) = 0;
