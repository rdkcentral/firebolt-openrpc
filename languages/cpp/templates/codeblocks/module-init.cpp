${if.modules}        ${info.Title}::I${info.Title}& ${info.Title}Interface() const override
        {
            auto module = _moduleMap.find("${info.Title}");
            ${info.Title}::I${info.Title}* ${info.title.lowercase} = nullptr;

            if (module != _moduleMap.end()) {
                ${info.title.lowercase} = reinterpret_cast<${info.Title}::I${info.Title}*>(module->second);
            } else {
                ${info.title.lowercase} = reinterpret_cast<${info.Title}::I${info.Title}*>(new ${info.Title}::${info.Title}Impl());
                _moduleMap.emplace("${info.Title}", reinterpret_cast<IModule*>(${info.title.lowercase}));
            }
            return *${info.title.lowercase};
        }

${end.if.modules}${module.init:cpp}