import "./utils/bootstrap.mjs";

import { test, expect, describe } from "@jest/globals";
import { PropertyExtension } from "../../../build/sdk/javascript/src/sdk.mjs";


describe("PropertyExtension API test", () => {

  test("basicProperty returns expected structure", async () => {
    const result = await PropertyExtension.basicProperty();
    expect(result).toMatchObject({
      foo: "here's foo"
    });
  });

  test("basicProperty set", async () => {
    const result = await PropertyExtension.basicProperty({ foo: "a new foo!" });
    expect(result).toBeNull();
  });

  test("readOnlyProperty returns boolean", async () => {
    const result = await PropertyExtension.readOnlyProperty();
    expect(result).toBe(true);
  });

  test("propertyWithContext returns boolean", async () => {
    const result = await PropertyExtension.propertyWithContext("appContext1");
    expect(result).toBe(false);
  });

  test("propertyWithContext set", async () => {
    const result = await PropertyExtension.propertyWithContext("context1", true);
    expect(result).toBeNull();
  });

  test("propertyWithSetterParamsFlattened set", async () => {
    //TODO Flattened parameters - there seems to be a problem here. needs to be investigated!
    // the send json is not 
    // {"jsonrpc":"2.0","method":"PropertyExtension.setPropertyWithSetterParamsFlattened","params":{"foo":"foo param", "bar": 42},"id":1}
    // but 
    //{"jsonrpc":"2.0","method":"PropertyExtension.setPropertyWithSetterParamsFlattened","params":{"value":"foo param"},"id":1}

    const result = await PropertyExtension.propertyWithSetterParamsFlattened("foo param", 42);
    expect(result).toBeNull();
  });
  
});
