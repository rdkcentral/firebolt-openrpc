/*
 * If not stated otherwise in this file or this component's LICENSE file the
 * following copyright and licenses apply:
 *
 * Copyright 2025 Sky UK
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    findRefs,
    resolveRef,
    collectRefs, removeUnusedSchemas
} from '../../src/shared/module/remove-unused-schemas.mjs'

const mockSpec = {
    methods: [
        {
            params: [
                { schema: { $ref: "#/x-schemas/Types/LocalizedString" } }
            ],
            result: {
                schema: { $ref: "#/x-schemas/Types/LocalizedString" }
            }
        }
    ],
    components: {
        schemas: {
            EventObjectPrimitives: { type: "string" },
            EventObject: {
                type: "object",
                properties: {
                    nested: { $ref: "#/components/schemas/EventObjectPrimitives" }
                }
            }
        }
    },
    "x-schemas": {
        Types: {
            uri: "https://example.com/types",
            LocalizedString: { type: "string" },
            UnusedType: { type: "number" }
        }
    }
};

describe("findRefs()", () => {
    test("finds all $ref values recursively", () => {
        const obj = {
            a: { $ref: "#/a" },
            b: [{ $ref: "#/b" }, { nested: { $ref: "#/c" } }]
        };
        const refs = findRefs(obj);
        expect(refs).toEqual(new Set(["#/a", "#/b", "#/c"]));
    });
});

describe("resolveRef()", () => {
    test("resolves deep $ref paths correctly", () => {
        const obj = { components: { schemas: { Foo: { type: "object" } } } };
        const result = resolveRef("#/components/schemas/Foo", obj);
        expect(result).toEqual({ type: "object" });
    });

    test("returns null for invalid refs", () => {
        const obj = {};
        expect(resolveRef("invalidRef", obj)).toBeNull();
    });
});

describe("collectRefs()", () => {
    test("collects transitive refs", () => {
        const root = {
            components: {
                schemas: {
                    A: { $ref: "#/components/schemas/B" },
                    B: { type: "string" }
                }
            }
        };
        const initial = new Set(["#/components/schemas/A"]);
        const result = collectRefs(initial, root);
        expect(result).toEqual(
            new Set(["#/components/schemas/A", "#/components/schemas/B"])
        );
    });
});

describe("removeUnusedSchemas()", () => {
    test("keeps only referenced schemas", () => {
        const cleaned = removeUnusedSchemas(mockSpec);

        // The only referenced schema is LocalizedString
        expect(cleaned["x-schemas"].Types.LocalizedString).toBeDefined();
        expect(cleaned["x-schemas"].Types.UnusedType).toBeUndefined();

        // EventObject and EventObjectPrimitives should be removed (not referenced)
        expect(cleaned.components.schemas.EventObject).toBeUndefined();
        expect(cleaned.components.schemas.EventObjectPrimitives).toBeUndefined();
    });

    test("returns a deep-cloned object", () => {
        const cleaned = removeUnusedSchemas(mockSpec);
        expect(cleaned).not.toBe(mockSpec);
        cleaned.methods[0].params[0].schema.$ref = "changed";
        expect(mockSpec.methods[0].params[0].schema.$ref).toBe(
            "#/x-schemas/Types/LocalizedString"
        );
    });
});
