import assert from "assert";
import {
  compress,
  decompress,
  mutateDateStrings,
  removeEmpties,
  isPureObject,
  mutateQueryProjects,
  mutateQueryFilters,
  getDataWithPaging,
  getAccessToken,
  testValue,
  mutateQueryFiltersEx,
  queryData,
  generateSchema,
  getSocketRecipient,
  queryPages,
  MongoSchemaType,
  isValidObjectId,
  getDotNotation,
} from "../src/app";
import zlib from "zlib";
import { Test, TestModel, TestRefModel } from "./models/test.model";
import mongoose from "mongoose";
const { expect } = require("chai");
import nock from "nock";

mongoose.set("strictQuery", true);

describe("gzip utilities", () => {
  describe("compression", () => {
    it("should work properly", () => {
      let compressed = compress("Hello world");

      const unzipped = zlib
        .unzipSync(Buffer.from(compressed, "base64"))
        .toString();

      assert.deepStrictEqual(unzipped, "Hello world");
    });
  });

  describe("decompression", () => {
    it("should work properly", () => {
      let decompressed = decompress(
        "H4sIAAAAAAAAE/NIzcnJVyjPL8pJAQBSntaLCwAAAA=="
      );
      assert.strictEqual(decompressed, "Hello world");
    });

    it("should throw error if entered invalid input", () => {
      assert.throws(() => decompress("Hello world"), Error);
    });
  });
});

describe("Date string mutations", () => {
  it("should mutateDateStrings nested objects", () => {
    const testData = [
      {
        expiredate: "2021-06-30T17:00:00+0000",
        notDate: "Test",
        date: "2021-06-30T17:00:00+0000",
        nested: {
          date: "2021-06-30T17:00:00+0000",
        },
        array: [
          {
            date: "2021-06-30T17:00:00+0000",
          },
          {
            nested: {
              date: "2021-06-30T17:00:00+0000",
            },
          },
        ],
      },
    ];

    let result = mutateDateStrings(testData, ["date"]);

    const expectedData = [
      {
        expiredate: new Date("2021-06-30T17:00:00+0000"),
        notDate: "Test",
        date: new Date("2021-06-30T17:00:00+0000"),
        nested: {
          date: new Date("2021-06-30T17:00:00+0000"),
        },
        array: [
          {
            date: new Date("2021-06-30T17:00:00+0000"),
          },
          {
            nested: {
              date: new Date("2021-06-30T17:00:00+0000"),
            },
          },
        ],
      },
    ];

    assert.deepStrictEqual(result, expectedData);
  });

  it("should exclude keys depending on input", () => {
    const testData = [
      {
        expiredate: "2021-06-30T17:00:00+0000",
        notDate: "Test",
        date: "2021-06-30T17:00:00+0000",
      },
    ];

    let result = mutateDateStrings(testData, ["date"], ["expiredate"]);

    const expectedData = [
      {
        expiredate: "2021-06-30T17:00:00+0000",
        notDate: "Test",
        date: new Date("2021-06-30T17:00:00+0000"),
      },
    ];

    assert.deepStrictEqual(result, expectedData);
  });
});

describe("Detecting pure objects", () => {
  it("should detect pure objects", () => {
    assert.strictEqual(isPureObject({}), true);

    assert.strictEqual(
      isPureObject({
        test: 123,
      }),
      true
    );
  });

  it("should return false when input is not pure objects", () => {
    // * String
    assert.strictEqual(isPureObject("string"), false);

    // * Number
    assert.strictEqual(isPureObject(0), false);

    // * Boolean
    assert.strictEqual(isPureObject(true), false);

    // * Array
    assert.strictEqual(isPureObject([{}, {}]), false);
  });
});

describe("Remove empties", () => {
  it("default should work properly", () => {
    const dateNow = new Date();
    const objectId = new mongoose.Types.ObjectId();
    const input = {
      test: "",
      test2: null,
      test3: "Hello",
      test4: undefined,
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
      test9: dateNow,
      test10: objectId,
      test11: [],
      test13: {},
    };

    let result = removeEmpties(input);

    assert.deepStrictEqual(result, {
      test: "",
      test3: "Hello",
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
      test9: dateNow,
      test10: objectId,
    });
  });

  it("should remove empty strings", () => {
    const input = {
      test: "",
      test2: null,
      test3: "Hello",
      test4: undefined,
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
    };

    let result = removeEmpties(input, {
      removeEmptyString: true,
    });

    assert.deepStrictEqual(result, {
      test3: "Hello",
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
    });
  });

  it("should remove zeros", () => {
    const input = {
      test: "",
      test2: null,
      test3: "Hello",
      test4: undefined,
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
    };

    let result = removeEmpties(input, {
      removeZeros: true,
    });

    assert.deepStrictEqual(result, {
      test: "",
      test3: "Hello",
      test5: "2021-06-30T17:00:00+0000",
      test7: false,
      test8: true,
    });
  });

  it("should remove both empty strings and zeros", () => {
    const input = {
      test: "",
      test2: null,
      test3: "Hello",
      test4: undefined,
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
    };

    let result = removeEmpties(input, {
      removeEmptyString: true,
      removeZeros: true,
    });

    assert.deepStrictEqual(result, {
      test3: "Hello",
      test5: "2021-06-30T17:00:00+0000",
      test7: false,
      test8: true,
    });
  });

  it("should work with nested objects", () => {
    const input = {
      a: "Hello",
      b: {
        a: "Hello",
        b: null,
        c: "2021-06-30T17:00:00+0000",
        d: 0,
      },
      c: null,
      d: 0,
    };

    let result = removeEmpties(input);

    assert.deepStrictEqual(result, {
      a: "Hello",
      b: {
        a: "Hello",
        c: "2021-06-30T17:00:00+0000",
        d: 0,
      },
      d: 0,
    });
  });

  it("should remove empty strings within nested objects", () => {
    const input = {
      a: "Hello",
      b: {
        a: "Hello",
        b: null,
        c: "2021-06-30T17:00:00+0000",
        d: 0,
        e: "",
      },
      c: null,
      d: 0,
    };

    let result = removeEmpties(input, {
      removeEmptyString: true,
    });

    assert.deepStrictEqual(result, {
      a: "Hello",
      b: {
        a: "Hello",
        c: "2021-06-30T17:00:00+0000",
        d: 0,
      },
      d: 0,
    });
  });

  it("should remove empty objects or arrays", () => {
    const input = {
      a: "Test",
      b: {
        a: null,
      },
      c: [
        {
          a: undefined,
        },
        {
          a: undefined,
        },
      ],
      d: {
        a: "Test",
      },
      e: [
        {
          a: "Test",
        },
      ],
    };

    let result = removeEmpties(input);

    assert.deepStrictEqual(result, {
      a: "Test",
      d: {
        a: "Test",
      },
      e: [
        {
          a: "Test",
        },
      ],
    });
  });

  it("should also remove empty strings objects or arrays", () => {
    const input = {
      a: "Test",
      b: {
        a: null,
      },
      c: [
        {
          a: undefined,
        },
        {
          a: undefined,
        },
      ],
      d: {
        a: "Test",
      },
      e: [
        {
          a: "Test",
          b: "",
        },
      ],
    };

    let result = removeEmpties(input, { removeEmptyString: true });

    assert.deepStrictEqual(result, {
      a: "Test",
      d: {
        a: "Test",
      },
      e: [
        {
          a: "Test",
        },
      ],
    });
  });

  it("should not remove 1 from input when removeZeros is true", () => {
    let tmpDate = new Date();

    let given = {
      printedOn: tmpDate,
      duplication: {
        lastOn: tmpDate,
        count: 1,
      },
    };

    let result = removeEmpties(given, {
      removeZeros: true,
    });

    assert.deepStrictEqual(result, {
      printedOn: tmpDate,
      duplication: {
        lastOn: tmpDate,
        count: 1,
      },
    });
  });

  it("should not remove objectId that contain in an array", () => {
    let given = {
      test: [
        new mongoose.Types.ObjectId("63d90769c02d36a3930ab7b0"),
        "test",
        {},
      ],
    };

    let result = removeEmpties(given);

    assert.deepStrictEqual(
      result,
      {
        test: [new mongoose.Types.ObjectId("63d90769c02d36a3930ab7b0"), "test"],
      },
      "should match with expect"
    );
  });
});

describe("Mutate query projects", async () => {
  it("should be able to create query", async () => {
    const givens = [1, 0, true, false];

    for (const given of givens) {
      const filters = {
        project: {
          testC: given,
        },
      };
      const project = filters.project;
      const result = mutateQueryProjects(TestModel, project);

      expect(result.testC).to.eql(filters.project.testC);
    }
  });

  it("should fail when fied does not exist in schema", async () => {
    const filters = {
      project: {
        testZ: 0,
      },
    };

    const project = filters.project;

    expect(() => mutateQueryProjects(TestModel, project)).to.throw(
      "Field [testZ] does not exist in schema"
    );
  });

  it("should fail when fied does not exist in schema", async () => {
    const givens = [10, "", {}, [], undefined];

    for (const given of givens) {
      const filters = {
        project: {
          testC: given,
        },
      };

      const project = filters.project;

      expect(() => mutateQueryProjects(TestModel, project)).to.throw(
        "Project use value 1 or 0 and true or false"
      );
    }
  });
});

describe("Mutate query filters", () => {
  context("Roles $gt", () => {
    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testB: { $gt: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testB).to.eql(filters.filter.testB);
    });

    it("should able to create query type date", async () => {
      let filters = {
        filter: {
          testH: { $gt: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      filters = {
        filter: {
          testH: { $gt: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testH).to.eql(filters.filter.testH);
    });

    it("should able to create query type number in object", async () => {
      const filters = {
        filter: {
          testCb: { $gt: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCb).to.eql(filters.filter.testCb);
    });

    it("should able to create query type date in objct", async () => {
      let filters = {
        filter: {
          testCc: { $gt: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");

      filters = {
        filter: {
          testCc: { $gt: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testCc).to.eql(filters.filter.testCc);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testA: { $gt: "test-ca" },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testA type cannot be used with operator $gt"
      );
    });
  });

  context("Roles $gte", () => {
    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testB: { $gte: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testB).to.eql(filters.filter.testB);
    });

    it("should able to create query type date", async () => {
      let filters = {
        filter: {
          testH: { $gte: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      filters = {
        filter: {
          testH: { $gte: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testH).to.eql(filters.filter.testH);
    });

    it("should able to create query type number in object", async () => {
      const filters = {
        filter: {
          testCb: { $gte: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCb).to.eql(filters.filter.testCb);
    });

    it("should able to create query type date in objct", async () => {
      let filters = {
        filter: {
          testCc: { $gte: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");

      filters = {
        filter: {
          testCc: { $gte: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testCc).to.eql(filters.filter.testCc);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testA: { $gte: "test-ca" },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testA type cannot be used with operator $gte"
      );
    });
  });

  context("Roles $lt", () => {
    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testB: { $lt: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testB).to.eql(filters.filter.testB);
    });

    it("should able to create query type date", async () => {
      let filters = {
        filter: {
          testH: { $lt: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      filters = {
        filter: {
          testH: { $lt: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testH).to.eql(filters.filter.testH);
    });

    it("should able to create query type number in object", async () => {
      const filters = {
        filter: {
          testCb: { $lt: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCb).to.eql(filters.filter.testCb);
    });

    it("should able to create query type date in objct", async () => {
      let filters = {
        filter: {
          testCc: { $lt: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");

      filters = {
        filter: {
          testCc: { $lt: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testCc).to.eql(filters.filter.testCc);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testA: { $lt: "test-ca" },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testA type cannot be used with operator $lt"
      );
    });
  });

  context("Roles $lte", () => {
    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testB: { $lte: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testB).to.eql(filters.filter.testB);
    });

    it("should able to create query type date", async () => {
      let filters = {
        filter: {
          testH: { $lte: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      filters = {
        filter: {
          testH: { $lte: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testH).to.eql(filters.filter.testH);
    });

    it("should able to create query type number in object", async () => {
      const filters = {
        filter: {
          testCb: { $lte: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCb).to.eql(filters.filter.testCb);
    });

    it("should able to create query type date in objct", async () => {
      let filters = {
        filter: {
          testCc: { $lte: "2021-05-11T03:10:10.013+00:00" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");

      filters = {
        filter: {
          testCc: { $lte: new Date("2021-05-11T03:10:10.013+00:00") },
        },
      };

      expect(result.testCc).to.eql(filters.filter.testCc);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testA: { $lte: "test-ca" },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testA type cannot be used with operator $lte"
      );
    });
  });

  context("Roles $eq", () => {
    it("should able to create query type string", async () => {
      const filters = {
        filter: {
          testA: { $eq: "test" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testA).to.eql(filters.filter.testA);
    });

    it("should able to create query type objectID", async () => {
      const filters = {
        filter: {
          testI: { $eq: new mongoose.Types.ObjectId() },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testI).to.eql(filters.filter.testI);
    });

    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testB: { $eq: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testB).to.eql(filters.filter.testB);
    });

    it("should able to create query type boolean", async () => {
      const filters = {
        filter: {
          testJ: { $eq: true },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testJ).to.eql(filters.filter.testJ);
    });

    it("should able to create query type string in object", async () => {
      const filters = {
        filter: {
          testCe: { $eq: "test" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCe).to.eql(filters.filter.testCe);
    });

    it("should able to create query type objectId in object", async () => {
      const filters = {
        filter: {
          testCd: { $eq: new mongoose.Types.ObjectId() },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCd).to.eql(filters.filter.testCd);
    });

    it("should able to create query type number in object", async () => {
      const filters = {
        filter: {
          testCf: { $eq: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCf).to.eql(filters.filter.testCf);
    });

    it("should able to create query type boolean in object", async () => {
      const filters = {
        filter: {
          testCg: { $eq: true },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCg).to.eql(filters.filter.testCg);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testE: { $eq: ["test"] },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testE type cannot be used with operator $eq"
      );
    });
  });

  context("Roles $ne", () => {
    it("should able to create query type string", async () => {
      const filters = {
        filter: {
          testA: { $ne: "test" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testA).to.eql(filters.filter.testA);
    });

    it("should able to create query type objectID", async () => {
      const filters = {
        filter: {
          testI: { $ne: new mongoose.Types.ObjectId() },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testI).to.eql(filters.filter.testI);
    });

    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testB: { $ne: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testB).to.eql(filters.filter.testB);
    });

    it("should able to create query type boolean", async () => {
      const filters = {
        filter: {
          testJ: { $ne: true },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testJ).to.eql(filters.filter.testJ);
    });

    it("should able to create query type string in object", async () => {
      const filters = {
        filter: {
          testCe: { $ne: "test" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCe).to.eql(filters.filter.testCe);
    });

    it("should able to create query type objectId in object", async () => {
      const filters = {
        filter: {
          testCd: { $ne: new mongoose.Types.ObjectId() },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCd).to.eql(filters.filter.testCd);
    });

    it("should able to create query type number in object", async () => {
      const filters = {
        filter: {
          testCf: { $ne: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCf).to.eql(filters.filter.testCf);
    });

    it("should able to create query type boolean in object", async () => {
      const filters = {
        filter: {
          testCg: { $ne: true },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCg).to.eql(filters.filter.testCg);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testE: { $ne: ["test"] },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testE type cannot be used with operator $ne"
      );
    });
  });

  context("Roles $in", () => {
    it("should able to create query type string", async () => {
      const filters = {
        filter: {
          testE: { $in: ["test1", "test2", "test3"] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testE).to.eql(filters.filter.testE);
    });

    it("should able to create query type objectId", async () => {
      const filters = {
        filter: {
          testE: {
            $in: [
              "61b9ed74a799cb154057f6b7",
              "61b9ed74a799cb154057f6b8",
              "61b9ed74a799cb154057f6b9",
            ],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testE).to.eql(filters.filter.testE);
    });

    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testF: {
            $in: [1, 2, 3],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testF).to.eql(filters.filter.testF);
    });

    it("should able to create query type string in obejct", async () => {
      const filters = {
        filter: {
          testCh: { $in: ["test1", "test2", "test3"] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCh).to.eql(filters.filter.testCh);
    });

    it("should able to create query type objectId in obejct", async () => {
      const filters = {
        filter: {
          testCi: {
            $in: [
              new mongoose.Types.ObjectId(),
              new mongoose.Types.ObjectId(),
              new mongoose.Types.ObjectId(),
            ],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCi).to.eql(filters.filter.testCi);
    });

    it("should able to create query type number in obejct", async () => {
      const filters = {
        filter: {
          testCj: {
            $in: [1, 2, 3],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCj).to.eql(filters.filter.testCj);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testK: { $in: [true] },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testK type cannot be used with operator $in"
      );
    });
  });

  context("Roles $nin", () => {
    it("should able to create query type string", async () => {
      const filters = {
        filter: {
          testE: { $nin: ["test1", "test2", "test3"] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testE).to.eql(filters.filter.testE);
    });

    it("should able to create query type objectId", async () => {
      const filters = {
        filter: {
          testE: {
            $nin: [
              "61b9ed74a799cb154057f6b7",
              "61b9ed74a799cb154057f6b8",
              "61b9ed74a799cb154057f6b9",
            ],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testE).to.eql(filters.filter.testE);
    });

    it("should able to create query type number", async () => {
      const filters = {
        filter: {
          testF: {
            $nin: [1, 2, 3],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);
      expect(result.testF).to.eql(filters.filter.testF);
    });

    it("should able to create query type string in obejct", async () => {
      const filters = {
        filter: {
          testCh: { $nin: ["test1", "test2", "test3"] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCh).to.eql(filters.filter.testCh);
    });

    it("should able to create query type objectId in obejct", async () => {
      const filters = {
        filter: {
          testCi: {
            $nin: [
              new mongoose.Types.ObjectId(),
              new mongoose.Types.ObjectId(),
              new mongoose.Types.ObjectId(),
            ],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCi).to.eql(filters.filter.testCi);
    });

    it("should able to create query type number in obejct", async () => {
      const filters = {
        filter: {
          testCj: {
            $nin: [1, 2, 3],
          },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");
      expect(result.testCj).to.eql(filters.filter.testCj);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testK: { $nin: [true] },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testK type cannot be used with operator $nin"
      );
    });
  });

  context("Roles $regex", () => {
    it("should able to create query type string", async () => {
      let filters = {
        filter: {
          testA: { $regex: "[a-z]" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      filters = {
        filter: {
          testA: { $regex: /[a-z]/ },
        },
      };

      expect(result.testA).to.eql(filters.filter.testA);
    });

    it("should able to create query type string in object", async () => {
      let filters = {
        filter: {
          testCe: { $regex: "[a-z]" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");

      filters = {
        filter: {
          testCe: { $regex: /[a-z]/ },
        },
      };

      expect(result.testCe).to.eql(filters.filter.testCe);
    });

    it("should fail invalid type", async () => {
      const filters = {
        filter: {
          testB: { $regex: 1 },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "testB type cannot be used with operator $regex"
      );
    });
  });

  it("should fail when field is missing in object", async () => {
    const filters = {
      filter: {
        testZa: { $eq: "test-ca" },
      },
    };
    const filter = filters.filter;

    expect(() => mutateQueryFilters(TestModel, filter, "testC")).to.throw(
      "Field [testC.testZa] does not exist in schema"
    );
  });

  it("should fail when invalid type", async () => {
    const givens = [10, 0, true, {}, undefined];

    for (const given of givens) {
      const filters = {
        filter: {
          testA: { $eq: given },
        },
      };
      const filter = filters.filter;

      expect(() => mutateQueryFilters(TestModel, filter)).to.throw(
        "Value of property to filter does not match schema type"
      );
    }
  });

  context("Experiment", () => {
    it.skip("test", () => {
      mutateQueryFiltersEx(Test, {});

      assert.equal(true, true);
    });
  });
});

describe("Get data with paging", () => {
  const refId1 = new mongoose.Types.ObjectId();
  const refId2 = new mongoose.Types.ObjectId();

  const mockData1 = {
    _id: new mongoose.Types.ObjectId(),
    no: 1,
    testA: "testA",
    testB: 1,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 1,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: [new mongoose.Types.ObjectId()],
    testE: ["test"],
    testF: [1, 2, 3],
    testG: [
      {
        testGa: "testGa1",
        testGb: 1,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa2",
        testGb: 2,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa3",
        testGb: 3,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa4",
        testGb: 4,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
    ],
    testR: refId1,
  };

  const mockData2 = {
    _id: new mongoose.Types.ObjectId(),
    no: 2,
    testA: "testB",
    testB: 2,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 1,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: [new mongoose.Types.ObjectId()],
    testE: ["test"],
    testF: [1, 2, 3],
    testG: [
      {
        testGa: "testGa1",
        testGb: 5,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa2",
        testGb: 6,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa3",
        testGb: 7,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
    ],
    testR: refId2,
  };

  const mockRefData1 = {
    _id: refId1,
    code: 1,
  };

  const mockRefData2 = {
    _id: refId2,
    code: 2,
  };

  beforeEach(async () => {
    await TestRefModel.deleteMany({});
    await TestModel.deleteMany({});

    await TestRefModel.insertMany([mockRefData1, mockRefData2]);

    await TestModel.insertMany([mockData1, mockData2]);
  });

  afterEach(async () => {
    //await TestModel.deleteMany({});
  });

  it("should able to get data with paging", async () => {
    const filters = {
      filter: {
        testA: { $eq: "testA" },
      },
    };
    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "" //* resource
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testA).to.eql(mockData1.testA);
    expect(data[0].testB).to.eql(mockData1.testB);

    const { testCa, testCb, testCc, testCd } = data[0].testC;
    expect(testCa.testCSub1).to.eql(mockData1.testC.testCa.testCSub1);
    expect(testCa.testCSub2).to.eql(mockData1.testC.testCa.testCSub2);
    expect(testCb).to.eql(mockData1.testC.testCb);
    expect(testCc).to.eql(mockData1.testC.testCc);
    expect(testCd).to.eql(mockData1.testC.testCd);

    expect(data[0].testD[0]).to.eql(mockData1.testD[0]);
    expect(data[0].testE[0]).to.eql(mockData1.testE[0]);
    expect(data[0].testF[0]).to.eql(mockData1.testF[0]);
    expect(data[0].testG[0]).to.eql(mockData1.testG[0]);
  });

  it("should able to get data with paging when value in object array", async () => {
    const filters = {
      filter: {
        testGb: { $eq: 4 },
      },
    };
    const sort = { $sort: { no: 1 } };

    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "testG" //* resource
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testGa).to.eql(mockData1.testG[3].testGa);
    expect(data[0].testGb).to.eql(mockData1.testG[3].testGb);
    expect(data[0].testGd).to.eql(mockData1.testG[3].testGd);
    expect(data[0].testGe).to.eql(mockData1.testG[3].testGe);
  });

  it("should able to get data with paging when match equal null", async () => {
    const filters = {
      filter: {},
    };
    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "" //* resource
    );

    // * data 1
    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testA).to.eql(mockData1.testA);
    expect(data[0].testB).to.eql(mockData1.testB);

    expect(data[0].testC.testCa.testCSub1).to.eql(
      mockData1.testC.testCa.testCSub1
    );
    expect(data[0].testC.testCa.testCSub2).to.eql(
      mockData1.testC.testCa.testCSub2
    );
    expect(data[0].testC.testCb).to.eql(mockData1.testC.testCb);
    expect(data[0].testC.testCc).to.eql(mockData1.testC.testCc);
    expect(data[0].testC.testCd).to.eql(mockData1.testC.testCd);

    expect(data[0].testD[0]).to.eql(mockData1.testD[0]);
    expect(data[0].testE[0]).to.eql(mockData1.testE[0]);
    expect(data[0].testF[0]).to.eql(mockData1.testF[0]);
    expect(data[0].testG[0]).to.eql(mockData1.testG[0]);

    // * data 2
    expect(data[1].testA).to.eql(mockData2.testA);
    expect(data[1].testB).to.eql(mockData2.testB);

    expect(data[1].testC.testCa.testCSub1).to.eql(
      mockData2.testC.testCa.testCSub1
    );
    expect(data[1].testC.testCa.testCSub2).to.eql(
      mockData2.testC.testCa.testCSub2
    );
    expect(data[1].testC.testCb).to.eql(mockData2.testC.testCb);
    expect(data[1].testC.testCc).to.eql(mockData2.testC.testCc);
    expect(data[1].testC.testCd).to.eql(mockData2.testC.testCd);

    expect(data[1].testD[0]).to.eql(mockData2.testD[0]);
    expect(data[1].testE[0]).to.eql(mockData2.testE[0]);
    expect(data[1].testF[0]).to.eql(mockData2.testF[0]);
    expect(data[1].testG[0]).to.eql(mockData2.testG[0]);
  });

  it("should able to get data with paging when match equal null and resource have data", async () => {
    const filters = {
      filter: {},
    };
    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "testG" //* resource
    );

    // * data 1
    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0]).to.eql(mockData1.testG[0]);
    expect(data[1]).to.eql(mockData1.testG[1]);
    expect(data[2]).to.eql(mockData1.testG[2]);
    expect(data[3]).to.eql(mockData1.testG[3]);

    expect(data[4]).to.eql(mockData2.testG[0]);
    expect(data[5]).to.eql(mockData2.testG[1]);
    expect(data[6]).to.eql(mockData2.testG[2]);
  });

  it("should able to get data with paging when operation is or", async () => {
    const filters = {
      $or: [
        {
          testGb: { $eq: 4 },
        },
        {
          testGb: { $eq: 7 },
        },
      ],
    };

    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      filters, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "testG" //* resource
    );

    // * data 1
    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0]).to.eql(mockData1.testG[3]);

    expect(data[1]).to.eql(mockData2.testG[2]);
  });

  it("should able to get data with paging when operation is and", async () => {
    const filters = {
      $and: [
        {
          testGb: { $eq: 1 },
        },
      ],
    };

    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      filters, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "testG" //* resource
    );

    // * data 1
    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0]).to.eql(mockData1.testG[0]);
  });

  it("should able to get data with paging when filter is null", async () => {
    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      null, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "" //* resource
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testA).to.eql(mockData1.testA);
    expect(data[0].testB).to.eql(mockData1.testB);

    expect(data[0].testC.testCa.testCSub1).to.eql(
      mockData1.testC.testCa.testCSub1
    );
    expect(data[0].testC.testCa.testCSub2).to.eql(
      mockData1.testC.testCa.testCSub2
    );
    expect(data[0].testC.testCb).to.eql(mockData1.testC.testCb);
    expect(data[0].testC.testCc).to.eql(mockData1.testC.testCc);
    expect(data[0].testC.testCd).to.eql(mockData1.testC.testCd);

    expect(data[0].testD[0]).to.eql(mockData1.testD[0]);
    expect(data[0].testE[0]).to.eql(mockData1.testE[0]);
    expect(data[0].testF[0]).to.eql(mockData1.testF[0]);
    expect(data[0].testG[0]).to.eql(mockData1.testG[0]);

    // * Data 2
    expect(data[1].testA).to.eql(mockData2.testA);
    expect(data[1].testB).to.eql(mockData2.testB);

    expect(data[1].testC.testCa.testCSub1).to.eql(
      mockData2.testC.testCa.testCSub1
    );
    expect(data[1].testC.testCa.testCSub2).to.eql(
      mockData2.testC.testCa.testCSub2
    );
    expect(data[1].testC.testCb).to.eql(mockData2.testC.testCb);
    expect(data[1].testC.testCc).to.eql(mockData2.testC.testCc);
    expect(data[1].testC.testCd).to.eql(mockData2.testC.testCd);

    expect(data[1].testD[0]).to.eql(mockData2.testD[0]);
    expect(data[1].testE[0]).to.eql(mockData2.testE[0]);
    expect(data[1].testF[0]).to.eql(mockData2.testF[0]);
    expect(data[1].testG[0]).to.eql(mockData2.testG[0]);
  });

  it("should able to get data with paging when project have value", async () => {
    const sort = { $sort: { no: 1 } };
    const project = { $project: { testG: 0 } };
    const results = await getDataWithPaging(
      null, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      project, // * projects
      null, //* unwind
      null, //* matchs
      "" //* resource
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testA).to.eql(mockData1.testA);
    expect(data[0].testB).to.eql(mockData1.testB);

    expect(data[0].testC.testCa.testCSub1).to.eql(
      mockData1.testC.testCa.testCSub1
    );
    expect(data[0].testC.testCa.testCSub2).to.eql(
      mockData1.testC.testCa.testCSub2
    );
    expect(data[0].testC.testCb).to.eql(mockData1.testC.testCb);
    expect(data[0].testC.testCc).to.eql(mockData1.testC.testCc);
    expect(data[0].testC.testCd).to.eql(mockData1.testC.testCd);

    expect(data[0].testD[0]).to.eql(mockData1.testD[0]);
    expect(data[0].testE[0]).to.eql(mockData1.testE[0]);
    expect(data[0].testF[0]).to.eql(mockData1.testF[0]);
    expect(data[0]).to.not.haveOwnProperty("testG");

    // * Data 2
    expect(data[1].testA).to.eql(mockData2.testA);
    expect(data[1].testB).to.eql(mockData2.testB);

    expect(data[1].testC.testCa.testCSub1).to.eql(
      mockData2.testC.testCa.testCSub1
    );
    expect(data[1].testC.testCa.testCSub2).to.eql(
      mockData2.testC.testCa.testCSub2
    );
    expect(data[1].testC.testCb).to.eql(mockData2.testC.testCb);
    expect(data[1].testC.testCc).to.eql(mockData2.testC.testCc);
    expect(data[1].testC.testCd).to.eql(mockData2.testC.testCd);

    expect(data[1].testD[0]).to.eql(mockData2.testD[0]);
    expect(data[1].testE[0]).to.eql(mockData2.testE[0]);
    expect(data[1].testF[0]).to.eql(mockData2.testF[0]);
    expect(data[1]).to.not.haveOwnProperty("testG");
  });

  it("should able to get data with paging when get value in object by _id", async () => {
    const filters = {
      filter: {
        _id: { $eq: mockData1._id },
      },
    };
    const sort = { $sort: { no: 1 } };
    const project = { $project: { _id: 0, testG: 1 } };
    const unwind = { $unwind: { path: "$testG" } };
    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      project, // * projects
      unwind, //* unwind
      null, //* matchs
      "" //* resource
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    const { testG } = mockData1;
    expect(data[0].testGa).to.eql(testG[0].testGa);
    expect(data[0].testGb).to.eql(testG[0].testGb);
    expect(data[0].testGd).to.eql(testG[0].testGd);
    expect(data[0].testGe).to.eql(testG[0].testGe);

    expect(data[1].testGa).to.eql(testG[1].testGa);
    expect(data[1].testGb).to.eql(testG[1].testGb);
    expect(data[1].testGd).to.eql(testG[1].testGd);
    expect(data[1].testGe).to.eql(testG[1].testGe);

    expect(data[2].testGa).to.eql(testG[2].testGa);
    expect(data[2].testGb).to.eql(testG[2].testGb);
    expect(data[2].testGd).to.eql(testG[2].testGd);
    expect(data[2].testGe).to.eql(testG[2].testGe);

    expect(data[3].testGa).to.eql(testG[3].testGa);
    expect(data[3].testGb).to.eql(testG[3].testGb);
    expect(data[3].testGd).to.eql(testG[3].testGd);
    expect(data[3].testGe).to.eql(testG[3].testGe);
  });

  it("should fail when invalid type", async () => {
    const filters = {
      filter: {
        testA: { $eq: 1 },
      },
    };

    await assert.rejects(
      async () => {
        await getDataWithPaging(
          filters.filter,
          "1",
          "10",
          null,
          TestModel,
          null,
          null,
          null,
          ""
        );
      },
      { message: "Value of property to filter does not match schema type" }
    );
  });

  it("should fail when missing field on model", async () => {
    const filters = {
      filter: {
        testZ: { $eq: 1 },
      },
    };

    await assert.rejects(
      async () => {
        await getDataWithPaging(
          filters.filter,
          "1",
          "10",
          null,
          TestModel,
          null,
          null,
          null,
          ""
        );
      },
      { message: "Field [testZ] does not exist in schema" }
    );
  });

  it("should able to limit and project", async () => {
    const filters = {
      filter: {},
    };

    const limit = 1;
    const project = { $project: { no: 1 } };

    const sort = { $sort: { no: 1 } };
    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      limit, //* limitInput
      sort, //* sort
      TestModel, //* Model
      project, // * projects
      null, //* unwind
      null, //* matchs
      "" //* resource
    );

    const { _metadata, data } = results;

    assert.strictEqual(data.length, limit, "should limit 1");
  });

  // * For lookup
  it("should able lookup data", async () => {
    const filters = {
      filter: {
        "testR.code": { $eq: 1 },
      },
    };

    const sort = { $sort: { createdOn: -1 } };

    const lookups = {
      $lookup: {
        from: "cltTestRef",
        localField: "testR",
        foreignField: "_id",
        as: "testR",
      },
    };

    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "", //* resource
      lookups
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testA).to.eql(mockData1.testA);
    expect(data[0].testB).to.eql(mockData1.testB);

    const { testCa, testCb, testCc, testCd } = data[0].testC;
    expect(testCa.testCSub1).to.eql(mockData1.testC.testCa.testCSub1);
    expect(testCa.testCSub2).to.eql(mockData1.testC.testCa.testCSub2);
    expect(testCb).to.eql(mockData1.testC.testCb);
    expect(testCc).to.eql(mockData1.testC.testCc);
    expect(testCd).to.eql(mockData1.testC.testCd);

    expect(data[0].testD[0]).to.eql(mockData1.testD[0]);
    expect(data[0].testE[0]).to.eql(mockData1.testE[0]);
    expect(data[0].testF[0]).to.eql(mockData1.testF[0]);
    expect(data[0].testG[0]).to.eql(mockData1.testG[0]);

    expect(data[0].testR._id.toString()).to.eql(mockRefData1._id.toString());
    expect(data[0].testR.code).to.eql(mockRefData1.code);
  });

  it("should able sort lookup data", async () => {
    const filters = {};

    const sort = { $sort: { "testR.code": -1 } };

    const lookups = {
      $lookup: {
        from: "cltTestRef",
        localField: "testR",
        foreignField: "_id",
        as: "testR",
      },
    };

    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      null, // * projects
      null, //* unwind
      null, //* matchs
      "", //* resource
      lookups
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testA).to.eql(mockData2.testA);
    expect(data[0].testB).to.eql(mockData2.testB);

    const { testCa, testCb, testCc, testCd } = data[0].testC;
    expect(testCa.testCSub1).to.eql(mockData2.testC.testCa.testCSub1);
    expect(testCa.testCSub2).to.eql(mockData2.testC.testCa.testCSub2);
    expect(testCb).to.eql(mockData2.testC.testCb);
    expect(testCc).to.eql(mockData2.testC.testCc);
    expect(testCd).to.eql(mockData2.testC.testCd);

    expect(data[0].testD[0]).to.eql(mockData2.testD[0]);
    expect(data[0].testE[0]).to.eql(mockData2.testE[0]);
    expect(data[0].testF[0]).to.eql(mockData2.testF[0]);
    expect(data[0].testG[0]).to.eql(mockData2.testG[0]);

    expect(data[0].testR._id.toString()).to.eql(mockRefData2._id.toString());
    expect(data[0].testR.code).to.eql(mockRefData2.code);

    expect(data[1].testR._id.toString()).to.eql(mockRefData1._id.toString());
    expect(data[1].testR.code).to.eql(mockRefData1.code);
  });

  it("should able lookup and projects data", async () => {
    const filters = {
      filter: {
        "testR.code": { $eq: 1 },
      },
    };

    const sort = { $sort: { createdOn: -1 } };

    const lookups = {
      $lookup: {
        from: "cltTestRef",
        localField: "testR",
        foreignField: "_id",
        as: "testR",
      },
    };

    const projects = { $project: { "testR.code": 1 } };

    const results = await getDataWithPaging(
      filters.filter, //* match
      "1", //* pageInput
      "10", //* limitInput
      sort, //* sort
      TestModel, //* Model
      projects, // * projects
      null, //* unwind
      null, //* matchs
      "", //* resource
      lookups
    );

    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0].testR.code).to.eql(mockRefData1.code);
  });

  it("should fail when missing field for lookup", async () => {
    const filters = {
      filter: {
        "testC.code": { $eq: 1 },
      },
    };

    const lookups = {
      $lookup: {
        localField: "testR",
        foreignField: "_id",
        as: "testR",
      },
    };

    await assert.rejects(
      async () => {
        await getDataWithPaging(
          filters.filter,
          "1",
          "10",
          null,
          TestModel,
          null,
          null,
          null,
          "",
          lookups
        );
      },
      { message: 'Missing field : ["from"]' }
    );
  });
});

describe("Get access token", async () => {
  const clientId = "61d3d8e3f4bbee8f42cfab9a";
  const clientSecret = "25fbc5ec-cbf1-4e7a-81b1-f17f398b0d89";
  const projectKey = "test";
  const authUrl = "http://localhost:8080/api/v1/auth/accessToken";
  const domain = "http://localhost:8080";
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2MWQzZDhlM2Y0YmJlZThmNDJjZmFiOWEiLCJuYW1lIjoiY29tbW9uLXV0aWxpdGllcyIsInVzZXJuYW1lIjoiNjFkM2Q4ZTNmNGJiZWU4ZjQyY2ZhYjlhIiwicmVmcmVzaFRva2VuSWQiOiJmN2QwNThiMi00MmEzLTQ5NGYtODIzNS05NDdiODBmNmE2ODIiLCJpYXQiOjE2NDYyOTIzNzQsImV4cCI6MTY0NjI5NTk3NCwic3ViIjoiNTJhOWZhYjQtZmMyMi00OGM1LTgyYzUtYjhlYzhlNGU1MWM2In0.nblg-WW8Er26y4SvNAcr1zzoV2pJmK_J9x6H4Jt_hEE";

  afterEach(async () => {
    nock.cleanAll();
  });

  it("should able to get access token", async () => {
    nock(domain).post("/api/v1/auth/accessToken").reply(200, {
      code: "ADPIS-01-0100",
      msg: "ok",
      data: token,
    });

    const accessToken = {
      clientId,
      clientSecret,
      projectKey,
      authUrl,
    };

    const result = await getAccessToken(accessToken);

    expect(result).to.eql(token);
  });

  it("should fail when clientId is missing or invalid", async () => {
    const givens = ["1234", "", {}, [], null, undefined, 0, 10];

    for (const given of givens) {
      await assert.rejects(
        async () => {
          const accessToken = {
            clientId: given,
            clientSecret,
            projectKey,
            authUrl,
          };
          await getAccessToken(accessToken);
        },
        { message: "ClientId is missing or invalid clientId" }
      );
    }
  });

  it("should fail when secret is missing or invalid", async () => {
    const givens = ["", {}, [], null, undefined, 0, 10];

    for (const given of givens) {
      await assert.rejects(
        async () => {
          const accessToken = {
            clientId,
            clientSecret: given,
            projectKey,
            authUrl,
          };
          await getAccessToken(accessToken);
        },
        { message: "Secret is missing or invalid clientSecret" }
      );
    }
  });

  it("should fail when projectKey is missing", async () => {
    const givens = ["", {}, [], null, undefined, 0, 10];

    for (const given of givens) {
      await assert.rejects(
        async () => {
          const accessToken = {
            clientId,
            clientSecret,
            projectKey: given,
            authUrl,
          };
          await getAccessToken(accessToken);
        },
        { message: "ProjectKey is missing or invalid projectKey" }
      );
    }
  });
});

describe("Query data", async () => {
  const refId1 = new mongoose.Types.ObjectId();
  const refId2 = new mongoose.Types.ObjectId();

  const mockData1 = {
    _id: new mongoose.Types.ObjectId(),
    no: 1,
    testA: "testA",
    testB: 1,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 1,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: [new mongoose.Types.ObjectId()],
    testE: ["test1"],
    testF: [1, 2, 3],
    testG: [
      {
        testGa: "testGa1",
        testGb: 1,
        testGc: true,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa2",
        testGb: 2,
        testGc: false,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa3",
        testGb: 3,
        testGc: true,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa4",
        testGb: 4,
        testGc: false,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
    ],
    testH: "2021-05-10T03:10:10.013+00:00",
    testI: new mongoose.Types.ObjectId(),
    testR: refId1,
    testJ: true,
    testM: "2021-05-10T03:10:10.013+00:00",
    testI: new mongoose.Types.ObjectId(),
  };

  const mockData2 = {
    _id: new mongoose.Types.ObjectId(),
    no: 2,
    testA: "testB",
    testB: 2,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 2,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: [new mongoose.Types.ObjectId()],
    testE: ["test2"],
    testF: [4, 5, 6],
    testG: [
      {
        testGa: "testGa1",
        testGb: 5,
        testGc: false,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa2",
        testGb: 6,
        testGc: false,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa3",
        testGb: 7,
        testGc: true,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
    ],
    testH: "2021-05-15T03:10:10.013+00:00",
    testR: refId2,
    testM: "2021-05-10T03:10:10.013+00:00",
    testI: new mongoose.Types.ObjectId(),
    testJ: false,
  };

  const mockData3 = {
    _id: new mongoose.Types.ObjectId(),
    no: null,
    testA: null,
    testB: 2,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 2,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: null,
    testE: null,
    testF: null,
    testG: null,
    testH: "2021-05-15T03:10:10.013+00:00",
    testR: refId2,
    testI: null,
    testM: null,
    testJ: null,
  };

  beforeEach(async () => {
    await TestModel.deleteMany({});
    await TestModel.insertMany([mockData1, mockData2]);
  });

  afterEach(async () => {
    await TestModel.deleteMany({});
  });

  context("Query object data", async () => {
    beforeEach(async () => {
      await TestModel.create({
        _id: new mongoose.Types.ObjectId(),
        testA: "Object is missing",
      });
    });
    afterEach(async () => {
      await TestModel.deleteMany({});
    });

    it("should be able query data when field is object", async () => {
      const filter = { testC: { $exists: false } };

      const result = await queryData(TestModel, [], {
        schema: {
          _id: MongoSchemaType.ObjectID,
          testA: MongoSchemaType.String,
          testC: { testCa: MongoSchemaType.Number },
        },
        filter,
        page: 1,
        limit: 10,
        project: { _id: 0, testA: 1 },
        calculatePages: true,
      });

      expect(result).to.eql({
        _metadata: {
          pageSize: 10,
          currentPage: 1,
          totalPages: 1,
          totalDocuments: 1,
        },
        data: [{ testA: "Object is missing" }],
      });
    });
  });

  context("Failed case", async () => {
    it("should be fail when limit = -1 and page have value", async () => {
      await assert.rejects(
        async () => {
          await queryData(TestModel, [], {
            schema: {
              no: MongoSchemaType.Number,
            },
            sort: {
              no: 1,
            },
            filter: {
              no: {
                $eq: 1,
              },
            },
            page: 1,
            limit: -1,
            calculatePages: false,
          });
        },
        { message: "Cannot allow page when limit is -1" }
      );
    });

    it("should be fail when limit == 0 or limit < -1", async () => {
      const limits = [-2, -3];

      for (const limit of limits) {
        await assert.rejects(
          async () => {
            await queryData(TestModel, [], {
              schema: {
                no: MongoSchemaType.Number,
              },
              sort: {
                no: 1,
              },
              filter: {
                no: {
                  $eq: 1,
                },
              },
              page: 1,
              limit,
              calculatePages: false,
            });
          },
          { message: "Invalid limit value" }
        );
      }
    });

    it("should be fail when schema is missing", async () => {
      await assert.rejects(
        async () => {
          await queryData(TestModel, [], {
            sort: {
              no: 1,
            },
            filter: {
              no: {
                $eq: 1,
              },
            },
            page: 1,
            limit: 1,
            calculatePages: false,
          });
        },
        { message: "Please input field for validation data" }
      );
    });
  });

  it("should be able queryData", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testH: MongoSchemaType.Date,
      },
      filter: { no: { $gt: 1 } },
      sort: {
        no: -1,
      },
      project: { no: 1, testH: 1 },
      page: 1,
      limit: 10,
      calculatePages: false,
    });

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);

    const { no, testH } = data[0];

    expect(no).to.eql(mockData2.no);
    expect(testH).to.eql(new Date(mockData2.testH));
  });

  it("should be able queryData operation $gt", async () => {
    const { no, testH } = mockData1;

    const filters = [{ no: { $gt: no }, testH: { $gt: testH } }];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { no: 1, testH: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testH: MongoSchemaType.Date,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { no: 1, testH: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { no, testH } = data[0];

      expect(no).to.eql(mockData2.no);
      expect(testH).to.eql(new Date(mockData2.testH));
    }
  });

  it("should be able queryData operation $gte", async () => {
    const { no, testH } = mockData1;

    const filters = [{ no: { $gte: no }, testH: { $gte: testH } }];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { no: 1, testH: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testH: MongoSchemaType.Date,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { no: 1, testH: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(2);

      expect(data[0].no).to.eql(mockData2.no);
      expect(data[0].testH).to.eql(new Date(mockData2.testH));

      expect(data[1].no).to.eql(mockData1.no);
      expect(data[1].testH).to.eql(new Date(mockData1.testH));
    }
  });

  it("should be able queryData operation $lt", async () => {
    const { no, testH } = mockData2;

    const filters = [{ no: { $lt: no }, testH: { $lt: testH } }];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { no: 1, testH: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testH: MongoSchemaType.Date,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { no: 1, testH: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      expect(data[0].no).to.eql(mockData1.no);
      expect(data[0].testH).to.eql(new Date(mockData1.testH));
    }
  });

  it("should be able queryData operation $lte", async () => {
    const { no, testH } = mockData2;

    const filters = [{ no: { $lte: no }, testH: { $lte: testH } }];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { no: 1, testH: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testH: MongoSchemaType.Date,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { no: 1, testH: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(2);

      expect(data[0].no).to.eql(mockData2.no);
      expect(data[0].testH).to.eql(new Date(mockData2.testH));

      expect(data[1].no).to.eql(mockData1.no);
      expect(data[1].testH).to.eql(new Date(mockData1.testH));
    }
  });

  it("should be able queryData operation $eq", async () => {
    const { testA, testI, no, testJ } = mockData1;

    const filters = [
      { testA: { $eq: testA } },
      { testI: { $eq: testI } },
      { no: { $eq: no } },
      { testJ: { $eq: testJ } },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          },
        ],
        {
          schema: {
            testA: MongoSchemaType.String,
            testI: MongoSchemaType.ObjectID,
            no: MongoSchemaType.Number,
            testJ: MongoSchemaType.Boolean,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { testA, testI, no, testJ } = data[0];
      expect(testA).to.eql(mockData1.testA);
      expect(testI).to.eql(mockData1.testI);
      expect(no).to.eql(mockData1.no);
      expect(testJ).to.eql(mockData1.testJ);
    }
  });

  it("should be able queryData operation $ne", async () => {
    const { testA, testI, no, testJ } = mockData1;

    const filters = [
      { testA: { $ne: testA } },
      { testI: { $ne: testI } },
      { no: { $ne: no } },
      { testJ: { $ne: testJ } },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          },
        ],
        {
          schema: {
            testA: MongoSchemaType.String,
            testI: MongoSchemaType.ObjectID,
            no: MongoSchemaType.Number,
            testJ: MongoSchemaType.Boolean,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { testA, testI, no, testJ } = data[0];
      expect(testA).to.eql(mockData2.testA);
      expect(testI).to.eql(mockData2.testI);
      expect(no).to.eql(mockData2.no);
      expect(testJ).to.eql(mockData2.testJ);
    }
  });

  it("should be able queryData operation $elemMatch", async () => {
    const {
      testG: [
        {
          testGa: firstTestGa,
          testGb: firstTestGb,
          testGc: firstTestGc,
          testGd: firstTestGd,
          testGe: firstTestGe,
        },
        {
          testGa: secondTestGa,
          testGb: secondTestGb,
          testGc: secondTestGc,
          testGd: secondTestGd,
          testGe: secondTestGe,
        },
      ],
      testJ,
    } = mockData1;

    const filters = [
      {
        testG: {
          $elemMatch: {
            testGa: secondTestGa,
            testGb: secondTestGb,
            testGc: secondTestGc,
            testGe: secondTestGe,
          },
        },
        testJ: testJ,
      },
      {
        testG: {
          $elemMatch: {
            testGa: firstTestGa,
            testGb: firstTestGb,
            testGc: firstTestGc,
            testGe: firstTestGe,
          },
        },
        testJ: testJ,
      },
    ];

    for (const filter of filters) {
      const result = await queryData(TestModel, [], {
        schema: {
          no: MongoSchemaType.Number,
          testG: [
            {
              testGa: MongoSchemaType.String,
              testGb: MongoSchemaType.Number,
              testGc: MongoSchemaType.Boolean,
              testGd: MongoSchemaType.Date,
              testGe: MongoSchemaType.ObjectID,
            },
          ],
          testJ: MongoSchemaType.Boolean,
        },
        filter,
        sort: {
          no: -1,
        },
        project: {},
        page: 1,
        limit: 10,
        calculatePages: true,
      });

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { no, testG } = data[0];
      expect(no).to.eql(mockData1.no);
      expect(testG).to.eql(mockData1.testG);
    }
  });

  it("should be able queryData operation $in", async () => {
    const { testE, testD, testF } = mockData1;

    const filters = [
      {
        testE: { $in: testE },
        testD: { $in: testD },
        testF: { $in: testF },
      },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testE: 1, testD: 1, testF: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testE: MongoSchemaType.StringArray,
            testD: MongoSchemaType.ObjectIDArray,
            testF: MongoSchemaType.NumberArray,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testE: 1, testD: 1, testF: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { testE, testD, testF } = data[0];
      expect(testE[0]).to.eql(mockData1.testE[0]);
      expect(testD[0]).to.eql(mockData1.testD[0]);
      expect(testF[0]).to.eql(mockData1.testF[0]);
    }
  });

  it("should be able queryData operation $nin", async () => {
    const { testE, testD, testF } = mockData1;

    const filters = [
      {
        testE: { $nin: testE },
        testD: { $nin: testD },
        testF: { $nin: testF },
      },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testE: 1, testD: 1, testF: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testE: MongoSchemaType.StringArray,
            testD: MongoSchemaType.ObjectIDArray,
            testF: MongoSchemaType.NumberArray,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testE: 1, testD: 1, testF: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { testE, testD, testF } = data[0];
      expect(testE[0]).to.eql(mockData2.testE[0]);
      expect(testD[0]).to.eql(mockData2.testD[0]);
      expect(testF[0]).to.eql(mockData2.testF[0]);
    }
  });

  it("should be able queryData operation $regex", async () => {
    const filters = [
      {
        testA: { $regex: "^testA" },
      },
      {
        testA: { $regex: "A$" },
      },
      {
        testA: { $regex: "A" },
      },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { no: 1, testA: 1 },
          },
        ],
        {
          schema: {
            no: MongoSchemaType.Number,
            testA: MongoSchemaType.String,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { no: 1, testA: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { no, testA } = data[0];
      expect(no).to.eql(mockData1.no);
      expect(testA).to.eql(mockData1.testA);
    }
  });

  it("should be able queryData operation $expr", async () => {
    const filter = {
      $expr: { $regexMatch: { input: { $toString: "$no" }, regex: "^2" } },
    };

    const result = await queryData(
      TestModel,
      [
        {
          $project: { no: 1, testA: 1 },
        },
      ],
      {
        schema: {
          no: MongoSchemaType.Number,
          testA: MongoSchemaType.String,
        },
        filter,
        sort: {
          no: -1,
        },
        project: { no: 1, testA: 1 },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);

    const { no, testA } = data[0];
    expect(no).to.eql(mockData2.no);
    expect(testA).to.eql(mockData2.testA);
  });

  it("should be exception when format $expr invalid", async () => {
    const givens = [
      {
        filter: {
          $expr: {
            $regexMatchxxx: { input: { $toString: "$no" }, regex: "^2" },
          },
        },
        message: "Unknown operator $regexMatchxxx",
      },
      {
        filter: { $expr: {} },
        message: "Field $expr has invalid value",
      },
    ];

    for (const given of givens) {
      const { filter, message } = given;
      await assert.rejects(
        async () => {
          await queryData(TestModel, [], {
            schema: {
              testA: MongoSchemaType.String,
              testI: MongoSchemaType.ObjectID,
              no: MongoSchemaType.Number,
              testJ: MongoSchemaType.Boolean,
            },
            filter,
            sort: {
              no: -1,
            },
            project: { testA: 1, no: 0 },
            page: 1,
            limit: 10,
            calculatePages: true,
          });
        },
        {
          message,
        }
      );
    }
  });

  it("should be able queryData object array", async () => {
    const result = await queryData(
      TestModel,
      [
        {
          $project: { no: 1, testG: 1 },
        },
      ],
      {
        schema: {
          no: MongoSchemaType.Number,
          testG: [
            {
              testGa: MongoSchemaType.String,
            },
          ],
        },
        filter: { no: { $eq: 1 }, "testG.testGa": { $eq: "testGa4" } },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );

    const { _metadata, data } = result;
    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);

    expect(data[0].no).to.eql(mockData1.no);
    expect(data[0].testG).to.eql(mockData1.testG);
  });

  it("should be fail queryData object array when value incorrect", async () => {
    const result = await queryData(
      TestModel,
      [
        {
          $project: { no: 1, testG: 1 },
        },
      ],
      {
        schema: {
          no: MongoSchemaType.Number,
          testG: [
            {
              testGa: MongoSchemaType.String,
            },
          ],
        },
        filter: { no: { $eq: 1 }, "testG.testGa": { $eq: "testGa4.4.4" } },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );

    const { _metadata, data } = result;
    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(0);
    expect(totalDocuments).to.eql(0);

    expect(data.length).to.eql(0);
  });

  it("should be fail queryData when source pipeline is []", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testG: [
          {
            testGa: MongoSchemaType.String,
          },
        ],
      },
      filter: { no: { $eq: 1 }, "testG.testGa": { $eq: "testGa4.4.4" } },
      page: 1,
      limit: 10,
      calculatePages: true,
    });

    const { _metadata, data } = result;
    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(0);
    expect(totalDocuments).to.eql(0);

    expect(data.length).to.eql(0);
  });

  it("should be able queryData on object", async () => {
    const result = await queryData(
      TestModel,
      [
        {
          $project: { testA: 1, testC: 1 },
        },
      ],
      {
        schema: {
          no: MongoSchemaType.Number,
          testC: {
            testCb: MongoSchemaType.Number,
          },
        },
        filter: { "testC.testCb": { $eq: 1 } },
        page: 1,
        limit: 10,
        calculatePages: true,
        readPref: "primary",
        readConcern: "local",
      }
    );
    const { _metadata, data } = result;
    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);

    expect(data[0].testA).to.eql(mockData1.testA);

    const { testA, testC } = data[0];

    expect(testA).to.eql(mockData1.testA);
    expect(testC.testCa.testCSub1).to.eql(mockData1.testC.testCa.testCSub1);
    expect(testC.testCa.testCSub2).to.eql(mockData1.testC.testCa.testCSub2);
    expect(testC.testCb).to.eql(mockData1.testC.testCb);
    expect(testC.testCc).to.eql(mockData1.testC.testCc);
    expect(testC.testCd).to.eql(mockData1.testC.testCd);
  });

  it("should be fail queryData on object when value incorrect", async () => {
    const result = await queryData(
      TestModel,
      [
        {
          $project: { testA: 1, testC: 1 },
        },
      ],
      {
        schema: {
          no: MongoSchemaType.Number,
          testC: {
            testCb: MongoSchemaType.Number,
          },
        },
        filter: { "testC.testCb": { $eq: 11 } },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );
    const { _metadata, data } = result;
    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(0);
    expect(totalDocuments).to.eql(0);

    expect(data.length).to.eql(0);
  });

  it("should be able queryData date null or undefined", async () => {
    const filter = { testM: { $ne: null } };

    const result = await queryData(
      TestModel,
      [
        {
          $project: { no: 1, testM: 1 },
        },
      ],
      {
        schema: {
          no: MongoSchemaType.Number,
          testM: MongoSchemaType.Date,
        },
        filter,
        sort: {
          no: 1,
        },
        project: { no: 1, testM: 1 },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(2);

    expect(data[0].no).to.eql(mockData1.no);
    expect(data[0].testM).to.eql(new Date(mockData1.testM));

    expect(data[1].no).to.eql(mockData2.no);
    expect(data[1].testM).to.eql(new Date(mockData2.testM));
  });

  it("should be able to queryData when allowDiskUse = true", async () => {
    const { testA, testI, no, testJ } = mockData1;

    const filters = [
      { testA: { $eq: testA } },
      { testI: { $eq: testI } },
      { no: { $eq: no } },
      { testJ: { $eq: testJ } },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          },
        ],
        {
          schema: {
            testA: MongoSchemaType.String,
            testI: MongoSchemaType.ObjectID,
            no: MongoSchemaType.Number,
            testJ: MongoSchemaType.Boolean,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          page: 1,
          limit: 10,
          allowDiskUse: true,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { testA, testI, no, testJ } = data[0];
      expect(testA).to.eql(mockData1.testA);
      expect(testI).to.eql(mockData1.testI);
      expect(no).to.eql(mockData1.no);
      expect(testJ).to.eql(mockData1.testJ);
    }
  });

  it("should be able to queryData when calculatePages = false", async () => {
    const { testA, testI, no, testJ } = mockData1;

    const filters = [
      { testA: { $eq: testA } },
      { testI: { $eq: testI } },
      { no: { $eq: no } },
      { testJ: { $eq: testJ } },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          },
        ],
        {
          schema: {
            testA: MongoSchemaType.String,
            testI: MongoSchemaType.ObjectID,
            no: MongoSchemaType.Number,
            testJ: MongoSchemaType.Boolean,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          page: 1,
          limit: 10,
          calculatePages: false,
        }
      );

      const { _metadata, data } = result;

      expect(_metadata).to.eql({ pageSize: 10, currentPage: 1 });
      const { testA, testI, no, testJ } = data[0];
      expect(testA).to.eql(mockData1.testA);
      expect(testI).to.eql(mockData1.testI);
      expect(no).to.eql(mockData1.no);
      expect(testJ).to.eql(mockData1.testJ);
    }
  });

  it("should be able to queryData when sourcePipeline is nothing", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testA: MongoSchemaType.String,
      },
      filter: { no: { $eq: 1 } },
      sort: {
        no: -1,
      },
      project: { no: 1, testA: 1 },
      page: 1,
      limit: 10,
      calculatePages: true,
    });

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);

    expect(data[0].no).to.eql(mockData1.no);
    expect(data[0].testA).to.eql(mockData1.testA);
  });

  it("should be able to queryData when filter is undefined", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testA: MongoSchemaType.String,
      },
      sort: {
        no: 1,
      },
      project: { no: 1, testA: 1 },
      page: 1,
      limit: 10,
      calculatePages: true,
    });

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(2);

    expect(data[0].no).to.eql(mockData1.no);
    expect(data[0].testA).to.eql(mockData1.testA);

    expect(data[1].no).to.eql(mockData2.no);
    expect(data[1].testA).to.eql(mockData2.testA);
  });

  it("should be able to queryData when sourcePipeline and calculatePages is empty", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testA: MongoSchemaType.String,
      },
      sort: {
        no: 1,
      },
      project: { no: 1, testA: 1 },
      page: 1,
      limit: 1,
      calculatePages: false,
    });

    const { _metadata, data } = result;

    const { pageSize, currentPage } = _metadata;
    expect(pageSize).to.eql(1);
    expect(currentPage).to.eql(1);

    expect(data[0].no).to.eql(mockData1.no);
    expect(data[0].testA).to.eql(mockData1.testA);
  });

  it("should be able to queryData when sourcePipline = [] and calculatePages = false else have filter", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testA: MongoSchemaType.String,
      },
      filter: { no: { $eq: 2 } },
      limit: -1,
      calculatePages: false,
    });
    const { _metadata, data } = result;

    const { pageSize, currentPage } = _metadata;
    expect(pageSize).to.eql(-1);
    expect(currentPage).to.eql(1);

    expect(data[0].no).to.eql(mockData2.no);
  });

  it("should be able to queryData when sourcePipline = [] and calculatePages = false else have filter project sort", async () => {
    const result = await queryData(TestModel, [], {
      schema: {
        no: MongoSchemaType.Number,
        testA: MongoSchemaType.String,
      },
      project: { no: 1 },
      sort: { no: -1 },
      limit: 10,
      calculatePages: false,
    });
    const { _metadata, data } = result;

    const { pageSize, currentPage } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);

    expect(data[0].no).to.eql(mockData2.no);
    expect(data[1].no).to.eql(mockData1.no);
  });

  it("should be able query data ex {'no' : 1}", async () => {
    const filters = [
      { no: 1 },
      { testI: mockData1.testI.toString() },
      { testJ: mockData1.testJ },
    ];

    for (const filter of filters) {
      const result = await queryData(
        TestModel,
        [
          {
            $project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          },
        ],
        {
          schema: {
            testA: MongoSchemaType.String,
            testI: MongoSchemaType.ObjectID,
            no: MongoSchemaType.Number,
            testJ: MongoSchemaType.Boolean,
          },
          filter,
          sort: {
            no: -1,
          },
          project: { testA: 1, testI: 1, no: 1, testJ: 1 },
          page: 1,
          limit: 10,
          calculatePages: true,
        }
      );

      const { _metadata, data } = result;

      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { testA, testI, no, testJ } = data[0];
      expect(testA).to.eql(mockData1.testA);
      expect(testI).to.eql(mockData1.testI);
      expect(no).to.eql(mockData1.no);
      expect(testJ).to.eql(mockData1.testJ);
    }
  });

  it("should be able query data multi field in object", async () => {
    const filter = {
      $or: [
        {
          testA: "testA",
        },
        {
          testA: { $eq: "testA" },
        },
        {
          testH: {
            $gte: "2021-05-10T03:10:10.013+00:00",
            $lte: "2021-05-10T03:10:10.013+00:00",
          },
          testJ: true,
          testA: { $eq: "testA" },
        },
      ],
    };

    const result = await queryData(
      TestModel,
      [
        {
          $project: { testA: 1, testI: 1, no: 1, testJ: 1, testH: 1 },
        },
      ],
      {
        schema: {
          testA: MongoSchemaType.String,
          testI: MongoSchemaType.ObjectID,
          no: MongoSchemaType.ObjectID,
          testJ: MongoSchemaType.Boolean,
          testH: MongoSchemaType.Date,
        },
        filter,
        sort: {
          no: -1,
        },
        project: { testA: 1, testI: 1, no: 1, testJ: 1, testH: 1 },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);

    const { testA, testI, no, testJ } = data[0];
    expect(testA).to.eql(mockData1.testA);
    expect(testI).to.eql(mockData1.testI);
    expect(no).to.eql(mockData1.no);
    expect(testJ).to.eql(mockData1.testJ);
  });

  it("should be able project", async () => {
    const result = await queryData(
      TestModel,
      [
        {
          $project: { testA: 1, no: 1 },
        },
      ],
      {
        schema: {
          testA: MongoSchemaType.String,
          testI: MongoSchemaType.ObjectID,
          no: MongoSchemaType.Number,
          testJ: MongoSchemaType.Boolean,
        },
        filter: { testA: { $eq: "testA" } },
        sort: {
          no: -1,
        },
        project: { testA: 1, no: "$no" },
        page: 1,
        limit: 10,
        calculatePages: true,
      }
    );

    const { _metadata, data } = result;

    const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
    expect(pageSize).to.eql(10);
    expect(currentPage).to.eql(1);
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);

    const { testA, testI, no } = data[0];
    expect(no).to.eql(mockData1.no);
    expect(testA).to.eql(mockData1.testA);
  });

  it("should be able query null data ex {field : null}", async () => {
    // * Insert value for test
    await TestModel.create(mockData3);

    const data = [
      {
        no: null,
      },
      {
        testA: null,
      },
      {
        testI: null,
      },
      {
        testM: null,
      },
      {
        testG: null,
      },
      {
        testD: null,
      },
      {
        testE: null,
      },
      {
        no: { $eq: null },
      },
      {
        testA: { $eq: null },
      },
      {
        testI: { $eq: null },
      },
      {
        testM: { $eq: null },
      },
    ];

    for (const obj of data) {
      const result = await queryData(TestModel, [], {
        schema: {
          no: MongoSchemaType.Number,
          testM: MongoSchemaType.Date,
          testA: MongoSchemaType.String,
          testI: MongoSchemaType.ObjectID,
          testD: MongoSchemaType.ObjectIDArray,
          testJ: MongoSchemaType.Boolean,
          testE: MongoSchemaType.StringArray,
          testF: MongoSchemaType.NumberArray,
          testG: [
            {
              testGa: MongoSchemaType.String,
            },
          ],
        },
        filter: obj,
        page: 1,
        limit: 10,
        calculatePages: true,
      });

      const { _metadata, data } = result;
      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;
      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      expect(data[0]._id).to.eql(mockData3._id);
      expect(data[0].no).to.eql(mockData3.no);
      expect(data[0].testM).to.eql(mockData3.testM);
      expect(data[0].testA).to.eql(mockData3.testA);
      expect(data[0].testI).to.eql(mockData3.testI);
      expect(data[0].testD).to.eql(mockData3.testD);
      expect(data[0].testJ).to.eql(mockData3.testJ);
      expect(data[0].testE).to.eql(mockData3.testE);
      expect(data[0].testF).to.eql(mockData3.testF);
      expect(data[0].testG).to.eql(mockData3.testG);
    }
  });

  it("should be able to queryData operator $text : {$search: string}", async () => {
    const { testA } = mockData1;

    const filters = [{ $text: { $search: testA } }];

    for (const filter of filters) {
      const result = await queryData(TestModel, [], {
        schema: {
          no: MongoSchemaType.Number,
          testA: MongoSchemaType.String,
        },
        filter,
        sort: {
          no: -1,
        },
        project: { testA: 1, no: 1 },
        page: 1,
        limit: 10,
        calculatePages: true,
      });

      const { _metadata, data } = result;
      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;

      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { no, testA } = data[0];

      expect(no).to.eql(mockData1.no);
      expect(testA).to.eql(mockData1.testA);
    }
  });

  it("should be able to queryData operator $all", async () => {
    const filters = [{ testF: { $all: [1, 2] } }];

    for (const filter of filters) {
      const result = await queryData(TestModel, [], {
        schema: {
          no: MongoSchemaType.Number,
          testF: MongoSchemaType.NumberArray,
        },
        filter,
        sort: {
          no: -1,
        },
        project: { testF: 1, no: 1 },
        page: 1,
        limit: 10,
        calculatePages: true,
      });

      const { _metadata, data } = result;
      const { pageSize, currentPage, totalPages, totalDocuments } = _metadata;

      expect(pageSize).to.eql(10);
      expect(currentPage).to.eql(1);
      expect(totalPages).to.eql(1);
      expect(totalDocuments).to.eql(1);

      const { no, testF } = data[0];

      expect(no).to.eql(mockData1.no);
      expect(testF).to.eql(mockData1.testF);
    }
  });

  it("should be fail when value type $search is not string", async () => {
    await assert.rejects(async () => {
      await queryData(TestModel, [], {
        schema: {
          no: MongoSchemaType.Number,
          testA: MongoSchemaType.String,
        },
        filter: { $text: { $search: 123 } }, // * search using number
        sort: {
          no: -1,
        },
        project: { testA: 1, no: 1 },
        page: 1,
        limit: 10,
        calculatePages: true,
      });
    });
  });

  it("should be fail when request filter incorrect", async () => {
    await assert.rejects(
      async () => {
        await queryData(TestModel, [], {
          schema: {
            no: MongoSchemaType.Number,
          },
          sort: {
            no: 1,
          },
          filter: {
            no: {
              $eq: 1,
            },
            limit: -1,
          },
          page: 1,
          limit: 1,
          calculatePages: false,
        });
      },
      { message: "Field [limit] does not exist in schema" }
    );
  });

  it("should be fail when project have 1 and 0", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { testA: 1, testI: 1, no: 1, testJ: 1 },
            },
          ],
          {
            schema: {
              testA: MongoSchemaType.String,
              testI: MongoSchemaType.ObjectID,
              no: MongoSchemaType.Number,
              testJ: MongoSchemaType.Boolean,
            },
            filter: { testA: { $eq: "testA" } },
            sort: {
              no: -1,
            },
            project: { testA: 1, no: 0 },
            page: 1,
            limit: 10,
            calculatePages: true,
          }
        );
      },
      {
        message: 'Bad projection : {"testA":1,"no":0}',
      }
    );
  });

  it("should be fail when pass value sort = {}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            sort: { no: {} },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value sort = {field : []}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            sort: { no: [] },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value sort = {field : [1,2,3]}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            sort: { no: [1, 2, 3] },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value sort = {field : null}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            sort: { no: null },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value project = {}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            project: { no: {} },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value project = {field : []}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            project: { no: [] },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value project = {field : [1,2,3]}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            project: { no: [1, 2, 3] },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value project = {field : null}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            page: 1,
            limit: 10,
            calculatePages: true,
            project: { no: null },
          }
        );
      },
      {
        message: "Field no is value incorrect",
      }
    );
  });

  it("should be fail when pass value filter = {}", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            filter: { no: {} },
            page: 1,
            limit: 10,
            calculatePages: true,
          }
        );
      },
      {
        message: "Field no has invalid value",
      }
    );
  });

  it("should be fail when operation incorrect", async () => {
    await assert.rejects(
      async () => {
        await queryData(
          TestModel,
          [
            {
              $project: { no: 1, testG: 1 },
            },
          ],
          {
            schema: {
              no: MongoSchemaType.Number,
              testG: [
                {
                  testGa: MongoSchemaType.String,
                },
              ],
            },
            filter: { no: { $incorrect: 1 } },
            page: 1,
            limit: 10,
            calculatePages: true,
          }
        );
      },
      {
        message: "Unknown operator $incorrect",
      }
    );
  });
});

describe("Query pages", async () => {
  const refId1 = new mongoose.Types.ObjectId();
  const refId2 = new mongoose.Types.ObjectId();

  const mockData1 = {
    _id: new mongoose.Types.ObjectId(),
    no: 1,
    testA: "testA",
    testB: 1,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 1,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: [new mongoose.Types.ObjectId()],
    testStatus: 10,
    testE: ["test1"],
    testF: [1, 2, 3],
    testG: [
      {
        testGa: "testGa1",
        testGb: 1,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa2",
        testGb: 2,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa3",
        testGb: 3,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa4",
        testGb: 4,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
    ],
    testH: "2021-05-10T03:10:10.013+00:00",
    testI: new mongoose.Types.ObjectId(),
    testR: refId1,
    testJ: true,
    testM: "2021-05-10T03:10:10.013+00:00",
  };

  const mockData2 = {
    _id: new mongoose.Types.ObjectId(),
    no: 2,
    testA: "testB",
    testB: 2,
    testC: {
      testCa: {
        testCSub1: "testCSub1",
        testCSub2: "testCSub2",
      },
      testCb: 2,
      testCc: new Date(),
      testCd: new mongoose.Types.ObjectId(),
    },
    testD: [new mongoose.Types.ObjectId()],
    testStatus: 11,
    testE: ["test2"],
    testF: [4, 5, 6],
    testG: [
      {
        testGa: "testGa1",
        testGb: 5,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa2",
        testGb: 6,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
      {
        testGa: "testGa3",
        testGb: 7,
        testGd: new Date(),
        testGe: new mongoose.Types.ObjectId(),
      },
    ],
    testH: "2021-05-15T03:10:10.013+00:00",
    testR: refId2,
  };

  before(async () => {
    await TestModel.collection.createIndex({ "$**": "text" });
  });

  beforeEach(async () => {
    await TestModel.insertMany([mockData1, mockData2]);
  });

  afterEach(async () => {
    await TestModel.deleteMany({});
  });

  it("should able query pages", async () => {
    const result = await queryPages(TestModel, [], { limit: 1 });

    const { totalPages, totalDocuments } = result;
    expect(totalPages).to.eql(2);
    expect(totalDocuments).to.eql(2);
  });

  it("should able query pages when has filter", async () => {
    const result = await queryPages(TestModel, [], {
      schema: { testA: MongoSchemaType.String },
      filter: { testA: { $eq: "testA" } },
    });

    const { totalPages, totalDocuments } = result;
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);
  });

  it("should able query pages when has full-text search filter", async () => {
    const result = await queryPages(TestModel, [], {
      schema: { testA: MongoSchemaType.String },
      filter: { $text: { $search: "testA" } },
    });

    const { totalPages, totalDocuments } = result;
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(1);
  });

  it("should fail when filter does not match schema type", async () => {
    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          schema: { testA: MongoSchemaType.Number },
          filter: { testA: { $eq: "testA" } },
        });
      },
      { message: "Value of property to filter does not match schema type" }
    );
  });

  it("should fail when field does not exist in schema", async () => {
    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          schema: { testB: MongoSchemaType.Number },
          filter: { testA: { $eq: "testA" } },
        });
      },
      { message: "Field [testA] does not exist in schema" }
    );
  });

  it("should fail when limit is invalid type", async () => {
    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          limit: "1",
        });
      },
      { message: "limit type is invalid" }
    );
  });

  it("should fail when full-text search is invalid type", async () => {
    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          schema: { testA: MongoSchemaType.String },
          filter: { $text: { $search: true } },
        });
      },
      { message: "$search only accepts string values" }
    );

    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          schema: { testA: MongoSchemaType.String },
          filter: { $text: { $search: 123 } },
        });
      },
      { message: "$search only accepts string values" }
    );

    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          schema: { testA: MongoSchemaType.String },
          filter: { $text: "123" },
        });
      },
      { message: "$text type cannot be used with operator $eq" }
    );

    await assert.rejects(
      async () => {
        await queryPages(TestModel, [], {
          filter: { $text: "123" },
        });
      },
      { message: "Field [$text] does not exist in schema" }
    );
  });

  it("should able get total pages and total documents when sent pipeline", async () => {
    const pipeline = [
      {
        $match: {
          testStatus: { $in: [10, 11] },
        },
      },
    ];
    const result = await queryPages(TestModel, pipeline, {
      schema: {
        testStatus: MongoSchemaType.Number,
      },
    });

    const { totalPages, totalDocuments } = result;
    expect(totalPages).to.eql(1);
    expect(totalDocuments).to.eql(2);
  });
});

describe("GenerateSchema", () => {
  it("should generate correctly", () => {
    const schema = {
      name: MongoSchemaType.String,
      address: {
        building: MongoSchemaType.String,
      },
      subjects: [
        {
          name: MongoSchemaType.String,
          grade: MongoSchemaType.Number,
          createdOn: MongoSchemaType.Date,
          students: MongoSchemaType.ObjectIDArray,
          main: {
            data: MongoSchemaType.String,
            type: MongoSchemaType.String,
          },
          testNestedArrary: [
            {
              data: MongoSchemaType.Boolean,
            },
          ],
        },
      ],
      avatar: {
        main: {
          data: MongoSchemaType.String,
          type: MongoSchemaType.String,
        },
        secondary: {
          data: MongoSchemaType.String,
          type: MongoSchemaType.String,
        },
      },
    };

    const generatedSchema = generateSchema(schema);

    expect(generatedSchema).to.eql({
      name: "String",
      address: "Object",
      "address.building": "String",
      subjects: "Array",
      "subjects.createdOn": "Date",
      "subjects.grade": "Number",
      "subjects.main.data": "String",
      "subjects.main.type": "String",
      "subjects.name": "String",
      "subjects.students": "ObjectID[]",
      "subjects.testNestedArrary": "Array",
      "subjects.testNestedArrary.data": "Boolean",
      avatar: "Object",
      "avatar.main.data": "String",
      "avatar.main.type": "String",
      "avatar.secondary.data": "String",
      "avatar.secondary.type": "String",
    });
  });
});

describe("Get socket recipient", () => {
  const site = "60f66d01b8696e5f58d91bd5";
  const device = "61b9ed74a799cb154057f6b7";

  it("should be able to get type is agent-service", async () => {
    const payload = {
      type: "agent-service",
      name: "common-utilities",
      site,
      device,
    };

    const result = getSocketRecipient(payload);

    const { name } = payload;
    expect(result).to.eql(
      `agent-service-name:${name}-site:${site}-device:${device}`
    );
  });

  it("should be able to get type is app", async () => {
    const payload = {
      type: "app",
      name: "common-utilities",
      site,
    };

    const result = getSocketRecipient(payload);

    const { name } = payload;
    expect(result).to.eql(`app-site:${site}-name:${name}`);
  });

  it("should be able to get type is service", async () => {
    const payload = {
      type: "service",
      name: "common-utilities",
    };

    const result = getSocketRecipient(payload);

    const { name } = payload;
    expect(result).to.eql(`service-name:${name}`);
  });

  it("should be able to get type is service", async () => {
    const payload = {
      type: "user",
      uid: "fsm2vsgo1pr",
    };

    const result = getSocketRecipient(payload);

    const { uid } = payload;
    expect(result).to.eql(`user-uid:${uid}`);
  });

  it("should be fail when type is incorrect", async () => {
    const payload = {
      type: "incorrect",
      name: "common-utilities",
      site,
      device,
    };

    const result = getSocketRecipient(payload);

    expect(result).to.eql(null);
  });
});

describe("validate string object id", () => {
  it("should be able to get true for objectId", async () => {
    const result = isValidObjectId(new mongoose.Types.ObjectId());
    expect(result).to.eql(true);
  });
  it("should be able to get true for string of length 24 with [A-Fa-f0-9]", async () => {
    const result = isValidObjectId("1234567890abcdefABCDEF00");
    expect(result).to.eql(true);
  });
  it("should be able to get false for string of length 24 with word beyond F", async () => {
    const result = isValidObjectId("12345678901234567890123G");
    expect(result).to.eql(false);
  });
  it("should be able to get false for string of length more than 24", async () => {
    const result = isValidObjectId("1234567890abcdefABCDEF00123456");
    expect(result).to.eql(false);
  });
  it("should be able to get false for string of length lower than 24", async () => {
    const result = isValidObjectId("1234567890abcdef");
    expect(result).to.eql(false);
  });
  it("should be able to get false for number", async () => {
    const result = isValidObjectId(12345);
    expect(result).to.eql(false);
  });
});

describe("Transform object to dot notation object", () => {
  it("should get dot notation", () => {
    const newOId = new mongoose.Types.ObjectId();

    const newDate = new Date();

    const usedPrimitiveData = {
      str: "string",
      num: 8.8,
      date: newDate,
      udf: undefined,
      oId: newOId,
      nil: null,
    };

    const testData = {
      ...usedPrimitiveData,
      items: [usedPrimitiveData],
      obj: {
        ...usedPrimitiveData,
        innerObj: {
          ...usedPrimitiveData,
        },
        innerItems: [usedPrimitiveData],
      },
    };

    const result = getDotNotation(testData);

    expect(result).to.eql({
      str: "string",
      num: 8.8,
      date: newDate,
      udf: undefined,
      oId: newOId,
      nil: null,
      items: [
        {
          str: "string",
          num: 8.8,
          date: newDate,
          udf: undefined,
          oId: newOId,
          nil: null,
        },
      ],
      "obj.str": "string",
      "obj.num": 8.8,
      "obj.date": newDate,
      "obj.udf": undefined,
      "obj.oId": newOId,
      "obj.nil": null,
      "obj.innerObj.str": "string",
      "obj.innerObj.num": 8.8,
      "obj.innerObj.date": newDate,
      "obj.innerObj.udf": undefined,
      "obj.innerObj.oId": newOId,
      "obj.innerObj.nil": null,
      "obj.innerItems": [
        {
          str: "string",
          num: 8.8,
          date: newDate,
          udf: undefined,
          oId: newOId,
          nil: null,
        },
      ],
    });
  });

  it("should get dot notation with prefix", () => {
    const newOId = new mongoose.Types.ObjectId();

    const newDate = new Date();

    const usedPrimitiveData = {
      str: "string",
      num: 8.8,
      date: newDate,
      udf: undefined,
      oId: newOId,
      nil: null,
    };

    const testData = {
      ...usedPrimitiveData,
      items: [usedPrimitiveData],
      obj: {
        ...usedPrimitiveData,
        innerObj: {
          ...usedPrimitiveData,
        },
        innerItems: [usedPrimitiveData],
      },
    };

    const result = getDotNotation(testData, "prefix.");

    expect(result).to.eql({
      "prefix.str": "string",
      "prefix.num": 8.8,
      "prefix.date": newDate,
      "prefix.udf": undefined,
      "prefix.oId": newOId,
      "prefix.nil": null,
      "prefix.items": [
        {
          str: "string",
          num: 8.8,
          date: newDate,
          udf: undefined,
          oId: newOId,
          nil: null,
        },
      ],
      "prefix.obj.str": "string",
      "prefix.obj.num": 8.8,
      "prefix.obj.date": newDate,
      "prefix.obj.udf": undefined,
      "prefix.obj.oId": newOId,
      "prefix.obj.nil": null,
      "prefix.obj.innerObj.str": "string",
      "prefix.obj.innerObj.num": 8.8,
      "prefix.obj.innerObj.date": newDate,
      "prefix.obj.innerObj.udf": undefined,
      "prefix.obj.innerObj.oId": newOId,
      "prefix.obj.innerObj.nil": null,
      "prefix.obj.innerItems": [
        {
          str: "string",
          num: 8.8,
          date: newDate,
          udf: undefined,
          oId: newOId,
          nil: null,
        },
      ],
    });
  });
});
