        // signature callback params: ${event.signature.callback.params}
        // method result properties : ${method.result.properties}
        void subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) override;
        void unsubscribe( I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) override;
