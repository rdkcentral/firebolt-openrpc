${if.modules}        const ${info.Title}::I${info.Title}& ${info.Title}Interface() const override
        {
            return ${info.Title}::I${info.Title}::Instance();
        }

${end.if.modules}${module.init}