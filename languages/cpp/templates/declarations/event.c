        /* ${method.name} - ${method.description} */
        struct I${method.Name}Notification {
            virtual void ${method.Name} ( ${event.signature.callback.params}${if.event.params}, ${end.if.event.params}${method.result.properties} ) = 0;  
        };
                
        virtual int32_t subscribe ( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${method.Name}Notification& notification ) = 0;
        virtual int32_t unsubscribe ( I${method.Name}Notification& notification ) = 0;

        // signature callback params: ${event.signature.callback.params}
        // method result properties : ${method.result.properties}
