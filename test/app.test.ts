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
  testValue,
  mutateQueryFiltersEx,
} from "../src/app";
import zlib from "zlib";
import { Test, TestModel } from "../src/models/test.model";
import mongoose from "mongoose";
import { templateSettings } from "lodash";
const { expect } = require("chai");

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
    ``;
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

    let result = removeEmpties(input);

    assert.deepStrictEqual(result, {
      test: "",
      test3: "Hello",
      test5: "2021-06-30T17:00:00+0000",
      test6: 0,
      test7: false,
      test8: true,
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
  context("Current", () => {
    it("it should able to create query filter", async () => {
      const filters = {
        filter: {
          testA: { $eq: "test-a" },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testA).to.eql(filters.filter.testA);
    });

    it("it should able to create query filter ObjectID[] for $in", async () => {
      const filters = {
        filter: {
          testD: { $in: [new mongoose.Types.ObjectId()] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testD).to.eql(filters.filter.testD);
    });

    it("it should able to create query filter String[] for $in", async () => {
      const filters = {
        filter: {
          testE: { $in: ["testD1", "testD2"] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testE).to.eql(filters.filter.testE);
    });

    it("it should able to create query filter Number[] for $in", async () => {
      const filters = {
        filter: {
          testF: { $in: [1, 2, 3] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testF).to.eql(filters.filter.testF);
    });

    it("it should able to create query filter ObjectID[] for $nin", async () => {
      const filters = {
        filter: {
          testD: { $nin: [new mongoose.Types.ObjectId()] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testD).to.eql(filters.filter.testD);
    });

    it("it should able to create query filter String[] for $nin", async () => {
      const filters = {
        filter: {
          testE: { $nin: ["testD1", "testD2"] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testE).to.eql(filters.filter.testE);
    });

    it("it should able to create query filter Number[] for $nin", async () => {
      const filters = {
        filter: {
          testF: { $nin: [1, 2, 3] },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter);

      expect(result.testF).to.eql(filters.filter.testF);
    });

    it("it should able to create query filter in object", async () => {
      const filters = {
        filter: {
          testCb: { $eq: 1 },
        },
      };
      const filter = filters.filter;
      const result = mutateQueryFilters(TestModel, filter, "testC");

      expect(result.testCb).to.eql(filters.filter.testCb);
    });

    it("it should able to create query filter in object ", async () => {
      const filters = {
        $and: [
          {
            "testCa.testCSub1": { $eq: "test-ca" },
          },
        ],
      };

      const result = mutateQueryFilters(TestModel, filters, "testC");

      expect(result.$and[0]).to.eql(filters.$and[0]);
    });

    it("it should fail when field is missing in object", async () => {
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

    it("it should fail when invalid type", async () => {
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
  });

  context("Experimental", () => {
    it("test", () => {
      class Test {}

      mutateQueryFiltersEx(Test, {});

      assert.equal(true, true);
    });
  });
});

describe("Get data with paging", () => {
  const mockData1: Test = {
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
  };

  const mockData2: Test = {
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
  };

  beforeEach(async () => {
    await TestModel.insertMany([mockData1, mockData2]);
  });

  afterEach(async () => {
    await TestModel.deleteMany({});
  });

  it("it should able to get data with paging", async () => {
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
      "", //* resource
      null //* lookup
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

  it("it should able to get data with paging when value in object array", async () => {
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
      "testG", //* resource
      null //* lookup
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

  it("it should able to get data with paging when match equal null", async () => {
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
      "", //* resource
      null //* lookup
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

  it("it should able to get data with paging when match equal null and resource have data", async () => {
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
      "testG", //* resource
      null //* lookup
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

  it("it should able to get data with paging when operation is or", async () => {
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
      "testG", //* resource
      null //* lookup
    );

    // * data 1
    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0]).to.eql(mockData1.testG[3]);

    expect(data[1]).to.eql(mockData2.testG[2]);
  });

  it("it should able to get data with paging when operation is and", async () => {
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
      "testG", //* resource
      null //* lookup
    );

    // * data 1
    const { _metadata, data } = results;
    expect(_metadata.currentPage).to.eql(1);
    expect(_metadata.pageSize).to.eql(10);
    expect(_metadata.totalPages).to.eql(1);

    expect(data[0]).to.eql(mockData1.testG[0]);
  });

  it("it should fail when invalid type", async () => {
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
          "",
          null
        );
      },
      { message: "Value of property to filter does not match schema type" }
    );
  });

  it("it should fail when missing field on model", async () => {
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
          "",
          null
        );
      },
      { message: "Field [testZ] does not exist in schema" }
    );
  });
});
