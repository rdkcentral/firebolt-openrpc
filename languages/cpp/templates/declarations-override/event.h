        // signature callback params: ${event.signature.callback.params}
        // method result properties : ${method.result.properties}
        void Subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) override;
        void Unsubscribe( I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err = nullptr ) override;
