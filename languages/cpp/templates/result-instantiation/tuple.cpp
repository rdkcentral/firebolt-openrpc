            ASSERT((jsonResult.Length() == 0) || (jsonResult.Length() == 2));
            if (jsonResult.Length() == 2) {
                ${property}.first = jsonResult.Get(0);
                ${property}.second = jsonResult.Get(1);
	    }
