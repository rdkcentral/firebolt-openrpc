            WPEFramework::Core::JSON::ArrayType<${json.type}> ${Property};
            for (auto& element: ${property}) {
               ${Property}.Add() = element;
	    }
            jsonParameters.Set(_T("${property}"), ${Property});