            ${if.namespace.notsame}FirebotlSDK::${info.Title}::${end.if.namespace.notsame}JsonData_${title} ${Property};
${properties}
            jsonParameters.Set(_T("${property}"), ${Property});