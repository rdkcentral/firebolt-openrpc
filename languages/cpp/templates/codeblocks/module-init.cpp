${if.modules}        ${info.Title}::I${info.Title}& ${info.Title}Interface() const override
        {
            auto module = _moduleMap.find("${info.Title}");
            ${info.Title}::${info.Title}Impl* ${info.title.lowercase} = nullptr;

            if (module != _moduleMap.end()) {
                ${info.title.lowercase} = dynamic_cast<${info.Title}::${info.Title}Impl*>(module->second);
            } else {
                ${info.title.lowercase} = new ${info.Title}::${info.Title}Impl();
                _moduleMap.emplace("${info.Title}", ${info.title.lowercase});
            }
            return *${info.title.lowercase};
        }

${end.if.modules}${module.init}