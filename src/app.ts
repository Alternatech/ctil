import zlib from "zlib";
import _ from "lodash";
import mongoose, { SchemaType } from "mongoose";
import axios from "axios";
import pako from "pako";
import { AccessTokenModel } from "./models/accessToken.model";
export { default as container } from "./container";
export { default as types } from "./types";
export { default as middlewares } from "./middlewares";
export { default as gracefulShutdown } from "./gracefulShutdown";

export function compress(data: string): string {
  if (typeof window !== "undefined") {
    // * For browsers
    return window.btoa(
      String.fromCharCode.apply(null, Array.from(pako.gzip(data)))
    );
  }

  return zlib.gzipSync(Buffer.from(data)).toString("base64");
}

export function decompress(data: string): string {
  if (typeof window !== "undefined") {
    // * For browsers
    const binaryString = window.atob(data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return pako.ungzip(bytes.buffer, { to: "string" });
  }

  return zlib.unzipSync(Buffer.from(data, "base64")).toString();
}

const SCHEMATYPE_MISMATCH_ERROR =
  "Value of property to filter does not match schema type";

const filterRules: Record<string, string[]> = {
  $gt: ["Number", "Date"],
  $gte: ["Number", "Date"],
  $lt: ["Number", "Date"],
  $lte: ["Number", "Date"],
  $eq: ["String", "ObjectID", "Number", "Boolean", "Date"],
  $ne: ["Object", "String", "ObjectID", "Number", "Boolean", "Date"],
  $in: [
    "String",
    "ObjectID",
    "Number",
    "Boolean",
    "String[]",
    "ObjectID[]",
    "Number[]",
  ],
  $nin: [
    "String",
    "ObjectID",
    "Number",
    "Boolean",
    "String[]",
    "ObjectID[]",
    "Number[]",
  ],
  $regex: ["String"],
  $exists: [
    "Object",
    "String",
    "ObjectID",
    "Number",
    "Boolean",
    "Date",
    "String[]",
    "ObjectID[]",
    "Number[]",
  ],
  $regexMatch: ["Object"],
  $search: ["Object"],
  $all: [
    "Number",
    "String",
    "ObjectID",
    "Boolean",
    "Number[]",
    "String[]",
    "ObjectID[]",
    "Boolean[]",
  ],
  $elemMatch: [
    "Object",
    "String",
    "ObjectID",
    "Number",
    "Boolean",
    "Date",
    "String[]",
    "ObjectID[]",
    "Number[]",
    "Array",
  ],
};

export function mutateDateStrings(
  data: unknown,
  matches: string[],
  excludes: string[] = []
): unknown {
  if (!Array.isArray(data)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tmp = _.cloneDeep(data) as any;

    for (const key in tmp) {
      /* istanbul ignore else */
      if (Object.hasOwnProperty.call(tmp, key)) {
        if (typeof tmp[key] == "string" || typeof tmp[key] == "number") {
          // * String or number

          // * Skip if key appears in excludes
          let skip = false;

          for (const exclude of excludes) {
            if (key.includes(exclude)) {
              skip = true;
              break;
            }
          }

          if (skip) {
            continue;
          }

          // * Convert to date if match
          for (const match of matches) {
            if (key.includes(match) && tmp[key] !== null) {
              tmp[key] = new Date(tmp[key]);
              break;
            }
          }
        } else if (Array.isArray(tmp[key])) {
          // * Array
          const newArray: unknown[] = [];

          for (const iterator of tmp[key]) {
            const result = mutateDateStrings(iterator, matches, excludes);
            newArray.push(result);
          }

          tmp[key] = newArray;
        } else {
          // * Object
          tmp[key] = mutateDateStrings(tmp[key], matches, excludes);
        }
      }
    }

    return tmp;
  } else {
    const newArray: unknown[] = [];

    // * Is array
    for (const iterator of data) {
      const result = mutateDateStrings(iterator, matches, excludes);
      newArray.push(result);
    }

    return newArray;
  }
}

/**
 * Remove empties, nulls, undefined from input
 * @param data Data to remove empties
 * @param options
 * @returns
 */
export function removeEmpties(
  data: unknown,
  options?: RemoveEmptyOptions
): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tmp = _.cloneDeep(data) as any;
  const optionsTmp = _.cloneDeep(options);

  if (!Array.isArray(tmp)) {
    for (const key in tmp) {
      if (Object.prototype.hasOwnProperty.call(tmp, key)) {
        if (isPureObject(tmp[key])) {
          if (tmp[key] instanceof mongoose.Types.ObjectId) continue;

          tmp[key] = removeEmpties(tmp[key], optionsTmp);

          if (_.isEmpty(tmp[key])) delete tmp[key];
        } else if (Array.isArray(tmp[key])) {
          // * Array
          tmp[key] = handleArray(tmp[key]);

          if (tmp[key].length === 0) delete tmp[key];
        } else if (_.isNil(tmp[key])) {
          delete tmp[key];
        } else {
          if (
            typeof tmp[key] === "string" &&
            _.isEmpty(tmp[key]) &&
            optionsTmp?.removeEmptyString
          )
            delete tmp[key];

          if (
            typeof tmp[key] === "number" &&
            tmp[key] === 0 &&
            optionsTmp?.removeZeros
          )
            delete tmp[key];
        }
      }
    }

    return tmp;
  } else {
    return handleArray(tmp);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleArray(input: any) {
    const newArray: unknown[] = [];

    for (const iterator of input) {
      if (iterator instanceof mongoose.Types.ObjectId) {
        newArray.push(iterator);
        continue;
      }

      const result = removeEmpties(iterator, optionsTmp);

      if (!_.isEmpty(result)) newArray.push(result);
    }

    return newArray;
  }
}

export function isPureObject(data: unknown): boolean {
  const result = Object.prototype.toString.call(data);
  return result === "[object Object]";
}

function getDatabaseModelFields(schemaModel: unknown): Record<string, string> {
  if (!(typeof schemaModel === "function" && schemaModel.name === "model")) {
    throw Error("input is not a Model");
  }

  let mainPaths: {
    [key: string]: SchemaType;
  } = {};

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  mainPaths = (schemaModel as any).schema.paths;

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  function getFields(paths: any) {
    const tmp: Record<string, string> = {};

    for (const key in paths) {
      if (Object.prototype.hasOwnProperty.call(paths, key)) {
        /* eslint-disable  @typescript-eslint/no-explicit-any */
        const path = paths[key] as any;
        const instance = path.instance;

        // * Check if path has a sub document
        if (
          (path.$isMongooseArray && path.$isMongooseDocumentArray) ||
          path.$isSingleNested
        ) {
          tmp[key] = instance;
          const subFields = getFields(path.schema.paths);

          for (const field in subFields) {
            if (!Object.prototype.hasOwnProperty.call(subFields, field)) {
              continue;
            }

            tmp[`${key}.${field}`] = subFields[field];
          }
        } else if (path.$isMongooseArray) {
          tmp[key] = `${path.$embeddedSchemaType.instance}[]`;
        } else {
          tmp[key] = instance;
        }
      }
    }

    return tmp;
  }

  return getFields(mainPaths);
}

export function mutateQueryFilters(
  schema: unknown,
  filters: unknown,
  pre?: string
): any {
  const rules: Record<string, string[]> = {
    $gt: ["Number", "Date"],
    $gte: ["Number", "Date"],
    $lt: ["Number", "Date"],
    $lte: ["Number", "Date"],
    $eq: ["String", "ObjectID", "Number", "Boolean"],
    $ne: ["String", "ObjectID", "Number", "Boolean"],
    $in: [
      "String",
      "ObjectID",
      "Number",
      "Boolean",
      "String[]",
      "ObjectID[]",
      "Number[]",
    ],
    $nin: [
      "String",
      "ObjectID",
      "Number",
      "Boolean",
      "String[]",
      "ObjectID[]",
      "Number[]",
    ],
    $regex: ["String"],
  };

  const _filters: any = _.cloneDeep(filters);
  const fields = getDatabaseModelFields(schema);

  for (const field in _filters) {
    let _field = field;

    if (!Object.prototype.hasOwnProperty.call(_filters, _field)) {
      continue;
    }

    if (_field === "$and" || _field === "$or") {
      _filters[_field] = _filters[_field].map((f: any) => {
        return mutateQueryFilters(schema, f, pre);
      });

      continue;
    }

    if (pre) {
      _field = `${pre}.${field}`;
    }

    // * Get variables for validation
    const schemaFieldType = fields[_field];

    const operator = Object.keys(_filters[field])[0];
    const filterValue = _filters[field][operator];
    let typeOfFilterValue: any = typeof filterValue;

    if (typeof filterValue === "object" && Array.isArray(filterValue)) {
      typeOfFilterValue = "array";
    }

    const rule = rules[operator];

    // * Check if field to filter exists in schema
    if (!schemaFieldType) {
      throw new Error(`Field [${_field}] does not exist in schema`);
    }

    // * Check if operator exists
    if (!rule) {
      throw new Error(`Unknown operator ${operator}`);
    }

    // * Reject if not using arrays with $in or $nin
    if (!rule.includes(schemaFieldType)) {
      throw new Error(
        `${_field} type cannot be used with operator ${operator}`
      );
    }

    if (
      (operator === "$in" || operator === "$nin") &&
      typeOfFilterValue !== "array"
    ) {
      throw new Error(`${operator} only accepts array values`);
    }

    _field = field;
    // * Validate type of value
    switch (schemaFieldType) {
      case "String":
      case "String[]":
        if (typeOfFilterValue === "array") {
          for (const value of filterValue) {
            if (typeof value !== "string")
              throw new Error(SCHEMATYPE_MISMATCH_ERROR);
          }
        } else if (typeOfFilterValue !== "string") {
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
        } else if (operator === "$regex") {
          _filters[_field][operator] = new RegExp(filterValue);
        }
        break;
      case "Number":
      case "Number[]":
        if (typeOfFilterValue === "array") {
          for (const value of filterValue) {
            if (typeof value !== "number")
              throw new Error(SCHEMATYPE_MISMATCH_ERROR);
          }
        } else if (typeOfFilterValue !== "number") {
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
        }

        break;
      case "Boolean":
        if (typeOfFilterValue === "array") {
          for (const value of filterValue) {
            if (typeof value !== "boolean")
              throw new Error(SCHEMATYPE_MISMATCH_ERROR);
          }
        } else if (typeOfFilterValue !== "boolean") {
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
        }
        break;
      case "Date":
        if (typeOfFilterValue !== "string") {
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
        }

        _filters[_field] = {
          [operator]: new Date(filterValue),
        };
        break;
      case "ObjectID":
      case "ObjectID[]":
        if (typeOfFilterValue === "array") {
          const newFilterValue = filterValue.map((value: any) => {
            if (!mongoose.isValidObjectId(value)) {
              throw new Error(SCHEMATYPE_MISMATCH_ERROR);
            }

            return new mongoose.Types.ObjectId(value);
          }, []);

          _filters[_field] = {
            [operator]: newFilterValue,
          };
        } else if (!mongoose.isValidObjectId(filterValue)) {
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
        } else {
          _filters[_field][operator] = new mongoose.Types.ObjectId(filterValue);
        }

        break;
      default:
        throw new Error(
          `Schema field type ${schemaFieldType} unknown or not yet supported`
        );
    }
  }

  return _filters;
}

export function mutateQueryProjects(schema: unknown, filters: unknown): any {
  const _filters: any = _.cloneDeep(filters);
  const fields = getDatabaseModelFields(schema);

  for (const field in _filters) {
    if (!Object.prototype.hasOwnProperty.call(_filters, field)) {
      continue;
    }

    // * Get variables for validation
    const schemaFieldType = fields[field];
    const value = _filters[field];
    // * Check if field to filter exists in schema
    if (!schemaFieldType) {
      throw new Error(`Field [${field}] does not exist in schema`);
    }
    if (value !== 1 && value !== 0 && value !== true && value !== false) {
      throw new Error(`Project use value 1 or 0 and true or false`);
    }
  }

  return _filters;
}

export async function getDataWithPaging(
  /* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
  filter: any,
  pageInput: string,
  limitInput: string,
  sort: unknown,
  Model: any,
  projects: any,
  unwind: any,
  matchs: unknown,
  resource: string,
  lookups: any
): Promise<any> {
  let match = { $match: {} };

  if (filter) {
    match = {
      $match: !lookups ? mutateQueryFilters(Model, filter, resource) : filter,
    };
  }
  const currentPage = pageInput !== "0" ? +pageInput : 1;
  const limitNumber = +limitInput;

  const skip = { $skip: currentPage * limitNumber - limitNumber };
  const pageSize = { $limit: limitNumber || 10 };
  const count = { $count: "total" };

  const toFacet = {
    _metadata: [match, count],
    data: [sort, match, skip, pageSize],
  };

  // * Get data on array
  if (projects && unwind && !resource) {
    const value = unwind[Object.keys(unwind)[0]]["path"];
    const replaceRoot = { $replaceRoot: { newRoot: value } };
    toFacet._metadata = [match, projects, unwind, replaceRoot, count];

    toFacet.data = [sort, match, projects, unwind, replaceRoot, skip, pageSize];

    if (matchs) {
      toFacet._metadata = [match, projects, unwind, matchs, count];
      toFacet.data = [sort, match, projects, unwind, matchs, skip, pageSize];
    }
  }

  if (projects && !unwind && !resource) {
    toFacet._metadata = [match, projects, count];
    toFacet.data = [sort, match, projects, sort, skip, pageSize];
  }

  // * Get data on array by match value
  if (resource) {
    projects = projects || { $project: { _id: 0, [resource]: 1 } };
    unwind = unwind || { $unwind: { path: `$${resource}` } };
    const replaceRoot = { $replaceRoot: { newRoot: `$${resource}` } };
    toFacet._metadata = [projects, unwind, replaceRoot, count];
    toFacet.data = [sort, projects, unwind, replaceRoot, match, skip, pageSize];
  }

  if (lookups) {
    // * Validate feild on lookup
    if (!lookups["$lookup"]) {
      throw new Error(`Missing feild : $lookup`);
    }

    const key = ["from", "localField", "foreignField", "as"];

    const requestData = Object.keys(lookups["$lookup"]);
    const validateFeild = key.filter((item) => !requestData.includes(item));

    if (validateFeild.length > 0) {
      throw new Error(`Missing field : ${JSON.stringify(validateFeild)}`);
    }

    let unwindKey = "";
    for (const temp in lookups["$lookup"]) {
      if (Object.prototype.hasOwnProperty.call(lookups["$lookup"], temp)) {
        const element = lookups["$lookup"][temp];

        if (temp === "as") {
          unwindKey = element;
        }
      }
    }

    const tempUnwind = { $unwind: { path: `$${unwindKey}` } };

    if (projects) {
      toFacet._metadata = [lookups, match, count];
      toFacet.data = [
        lookups,
        match,
        tempUnwind,
        projects,
        sort,
        skip,
        pageSize,
      ];
    } else {
      toFacet._metadata = [lookups, match, count];
      toFacet.data = [lookups, match, tempUnwind, sort, skip, pageSize];
    }
  }

  const toSearchBody = { $facet: toFacet };

  const find = await Model.aggregate([toSearchBody]);

  if (find[0].data.length === 0) {
    if (currentPage > 1) {
      return false;
    }

    return {
      _metadata: {
        pageSize: limitNumber,
        currentPage,
        totalPages: 1,
      },
      data: find[0].data,
    };
  }

  const total = find[0]._metadata[0].total;
  const totalPages = Math.ceil(total / limitNumber);

  return {
    _metadata: {
      // total,
      pageSize: limitNumber,
      currentPage,
      totalPages,
    },
    data: find[0].data,
  };
}

export async function getAccessToken(
  accessToken: AccessTokenModel
): Promise<string> {
  const { clientId, clientSecret, projectKey, authUrl } = accessToken;

  if (!clientId || !mongoose.isValidObjectId(clientId) || !_.isString(clientId))
    throw new Error("ClientId is missing or invalid clientId");

  if (!clientSecret || !_.isString(clientSecret))
    throw new Error("Secret is missing or invalid clientSecret");

  if (!projectKey || !_.isString(projectKey))
    throw new Error("ProjectKey is missing or invalid projectKey");

  const response = await axios.post(
    authUrl,
    {},
    {
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-service": projectKey,
      },
    }
  );

  const {
    data: { data },
  } = response;

  return data;
}

interface RemoveEmptyOptions {
  /**
   * Remove empty strings. Default: false
   */
  removeEmptyString?: boolean;

  /**
   * Remove zeros. Default: false
   */
  removeZeros?: boolean;
}

export type QueryDataOptionType = {
  schema: { [key: string]: unknown };
  filter?: unknown;
  page?: number;
  limit?: number;
  sort?: { [key: string]: number };
  project?: { [key: string]: unknown };
  calculatePages?: boolean;
  allowDiskUse?: boolean;
  readPref?:
    | "primary"
    | "primaryPreferred"
    | "secondary"
    | "secondaryPreferred"
    | "nearest";
  readConcern?: "local" | "majority";
};

export type MetadataType = {
  pageSize: number;
  currentPage: number;
  totalPages?: number;
  totalDocuments?: number;
};

export type QueryDataReturnType = {
  _metadata: MetadataType;
  data: unknown[];
};

export type QueryPagesOptionType = {
  limit?: number;
  filter?: unknown;
  schema: { [key: string]: unknown };
  readPref?:
    | "primary"
    | "primaryPreferred"
    | "secondary"
    | "secondaryPreferred"
    | "nearest";
  readConcern?: "local" | "majority";
};

/* eslint-disable no-shadow */
export enum MongoSchemaType {
  Number = "Number",
  Date = "Date",
  String = "String",
  ObjectID = "ObjectID",
  ObjectIDArray = "ObjectID[]",
  Boolean = "Boolean",
  StringArray = "String[]",
  NumberArray = "Number[]",
  Array = "Array",
  Object = "Object",
}

type KeyAndSchemaType = {
  key: string;
  schemaType: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function internalGetKeyAndSchemaTypes(
  key: string,
  value: any,
  precededKey = ""
): KeyAndSchemaType[] {
  const keyToReturn = precededKey ? `${precededKey}.${key}` : key;

  if (typeof value !== "object") {
    return [
      {
        key: keyToReturn,
        schemaType: value,
      },
    ];
  }

  // * Either Object or Array
  const _value = Array.isArray(value) ? value[0] : value;
  let results: any = [];

  for (const _key in _value) {
    if (!Object.prototype.hasOwnProperty.call(_value, _key)) continue;
    results = results.concat(
      internalGetKeyAndSchemaTypes(_key, _value[_key], keyToReturn)
    );
  }

  Array.isArray(value)
    ? results.push({ key: keyToReturn, schemaType: MongoSchemaType.Array })
    : undefined;

  return results;
}

export function generateSchema(schema: unknown): unknown {
  const fields = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _schema = schema as any;

  for (const key in _schema) {
    // istanbul ignore next
    if (!Object.prototype.hasOwnProperty.call(_schema, key)) continue;

    const results = internalGetKeyAndSchemaTypes(key, _schema[key]);

    for (const result of results) {
      const { key: _key, schemaType } = result;

      // * For assign type object
      const checkKey = _key.split(".");
      if (checkKey.length > 1) {
        fields.set(checkKey[0], "Object");
      }

      fields.set(_key, schemaType);
    }
  }

  return Object.fromEntries(fields);
}

function validatePipeline(schema: any, pipeline: any, operation: string) {
  const fields: any = generateSchema(schema);

  let _variable;

  for (const field in pipeline) {
    const variable = pipeline[field];

    if (
      (typeof variable === "object" && _.isEmpty(variable)) ||
      Array.isArray(variable)
    )
      throw new Error(`Field ${field} is value incorrect`);

    const validate = fields[field];

    if (!validate) throw new Error(`Field [${field}] does not exist in schema`);

    if (
      _variable &&
      operation === "$project" &&
      typeof variable === "number" &&
      _variable !== variable
    ) {
      throw new Error(`Bad projection : ${JSON.stringify(pipeline)}`);
    }

    _variable = variable;
  }

  return pipeline;
}

export function mutateQueryFiltersV2(
  schema: unknown,
  filters: unknown,
  pre?: string
): any {
  const _filters: any = _.cloneDeep(filters);
  const fields: any = generateSchema(schema);

  for (const field in _filters) {
    const _field = field;

    if (!Object.prototype.hasOwnProperty.call(_filters, _field)) {
      continue;
    }

    const variable = _filters[field];
    if (
      typeof variable === "object" &&
      variable !== null &&
      _.isEmpty(variable)
    )
      throw new Error(`Field ${field} has invalid value`);

    // * Check if is $and or $or operators
    if (_field === "$and" || _field === "$or") {
      _filters[_field] = _filters[_field].map((f: any) => {
        return mutateQueryFiltersV2(schema, f, pre);
      });

      // * Continue to next field
      continue;
    }

    const schemaFieldType = fields[_field];

    if (typeof variable === "object" && variable !== null) {
      // * Assume value has many operators
      const operators = Object.keys(_filters[field]);
      for (const operator of operators) {
        const fieldValue = _filters[field][operator];
        _filters[field][operator] = internalValidateFieldAndReturnValue(
          _field,
          fieldValue,
          schemaFieldType,
          operator,
          fields
        );
      }
    }

    // * Check if filter is one-one key value type
    if (
      typeof variable === "string" ||
      typeof variable === "number" ||
      typeof variable === "boolean" ||
      (typeof variable === "object" && Array.isArray(variable))
    ) {
      _filters[field] = internalValidateFieldAndReturnValue(
        _field,
        variable,
        schemaFieldType
      );
    }
  }

  return _filters;
}

function internalValidateFieldAndReturnValue(
  fieldKey: string,
  fieldValue: any,
  schemaFieldType: string,
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  operator: string = "$eq",
  schemaField?: any
): unknown {
  let typeOfFilterValue: any = typeof fieldValue;

  if (typeof fieldValue === "object" && Array.isArray(fieldValue)) {
    typeOfFilterValue = "array";
  }

  const rule = filterRules[operator];

  // * Check if field to filter exists in schema
  if (!schemaFieldType) {
    throw new Error(`Field [${fieldKey}] does not exist in schema`);
  }

  // * Check if operator exists
  if (!rule) {
    throw new Error(`Unknown operator ${operator}`);
  }

  // * Reject if not using arrays with $in or $nin
  if (!rule.includes(schemaFieldType)) {
    throw new Error(
      `${fieldKey} type cannot be used with operator ${operator}`
    );
  }

  if (
    (operator === "$in" || operator === "$nin") &&
    typeOfFilterValue !== "array"
  ) {
    throw new Error(`${operator} only accepts array values`);
  }

  // * Validate type of $search operator accept only string
  if (operator === "$search" && typeOfFilterValue !== "string") {
    throw new Error(`${operator} only accepts string values`);
  }

  // * Validate type of $elemMatch operator accept only object
  if (operator === "$elemMatch" && typeOfFilterValue !== "object") {
    throw new Error(`${operator} only accepts object values`);
  }

  // * Validate type of value
  if (typeOfFilterValue === "object" && fieldValue === null) {
    return fieldValue;
  }

  if (schemaFieldType === "Object") {
    return fieldValue;
  }

  if (schemaFieldType === "String" || schemaFieldType === "String[]") {
    if (typeOfFilterValue === "array") {
      for (const value of fieldValue) {
        if (typeof value !== "string")
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
      }
    } else if (operator === "$regex" && typeOfFilterValue === "string") {
      return new RegExp(fieldValue, "i");
    } else if (typeOfFilterValue !== "string") {
      throw new Error(SCHEMATYPE_MISMATCH_ERROR);
    }

    return fieldValue;
  }

  if (schemaFieldType === "Number" || schemaFieldType === "Number[]") {
    if (typeOfFilterValue === "array") {
      for (const value of fieldValue) {
        if (typeof value !== "number")
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
      }
    } else if (typeOfFilterValue !== "number") {
      throw new Error(SCHEMATYPE_MISMATCH_ERROR);
    }

    return fieldValue;
  }

  if (schemaFieldType === "Boolean") {
    if (typeOfFilterValue === "array") {
      for (const value of fieldValue) {
        if (typeof value !== "boolean")
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
      }
    } else if (typeOfFilterValue !== "boolean") {
      throw new Error(SCHEMATYPE_MISMATCH_ERROR);
    }

    return fieldValue;
  }

  if (schemaFieldType === "Date") {
    if (typeOfFilterValue !== "string" && typeOfFilterValue !== "object") {
      throw new Error(SCHEMATYPE_MISMATCH_ERROR);
    }

    if (!fieldValue) return null;

    const date = new Date(fieldValue);

    if (date instanceof Date && date.toString() !== "Invalid Date") return date;

    throw new Error(SCHEMATYPE_MISMATCH_ERROR);
  }

  if (schemaFieldType === "ObjectID" || schemaFieldType === "ObjectID[]") {
    if (typeOfFilterValue === "array") {
      const newFilterValue = fieldValue.map((value: any) => {
        if (!mongoose.isValidObjectId(value)) {
          throw new Error(SCHEMATYPE_MISMATCH_ERROR);
        }

        return new mongoose.Types.ObjectId(value);
      }, []);

      return newFilterValue;
    } else if (!mongoose.isValidObjectId(fieldValue)) {
      throw new Error(SCHEMATYPE_MISMATCH_ERROR);
    } else {
      return new mongoose.Types.ObjectId(fieldValue);
    }
  }

  if (
    schemaFieldType === "Array" &&
    operator === "$elemMatch" &&
    typeOfFilterValue === "object"
  ) {
    Object.getOwnPropertyNames(fieldValue).forEach(function (key) {
      const subSchemaFieldType = schemaField[fieldKey + "." + key];
      fieldValue[key] = internalValidateFieldAndReturnValue(
        key,
        fieldValue[key],
        subSchemaFieldType
      );
    });
    return fieldValue;
  }

  throw new Error(
    `Schema field type ${schemaFieldType} unknown or not yet supported`
  );
}

export async function queryData(
  collectionModel: unknown,
  sourcePipeline: unknown[],
  options?: QueryDataOptionType
): Promise<QueryDataReturnType> {
  const _collectionModel = collectionModel as any;
  const _sourcePipline = _.cloneDeep(sourcePipeline);
  const basePipeline: any[] = [];
  let _page = 1;
  let _limit = 10;

  const hasSourcePipeline = _sourcePipline.length === 0 ? false : true;

  // * Using allowDiskUse
  let _allowDiskUse = false;

  // * Using process count documents
  let _calculatePages = true;

  // * For performance
  let _readPref = "secondaryPreferred";
  let _readConcern = "majority";

  // * Check field filter have value or not
  let hasFilter = false;

  let tempMatch;
  let tempFilter: any;

  // * Check options
  if (options) {
    const {
      schema,
      filter,
      page,
      limit,
      sort,
      project,
      allowDiskUse,
      calculatePages,
      readPref,
      readConcern,
    } = options;

    // * Always add $text and $expr in schema
    if (schema) {
      schema["$text"] = MongoSchemaType.Object;
      schema["$expr"] = MongoSchemaType.Object;
    }

    // * Validate data
    // ! Throw error if limit is -1 and page is provided
    if (limit) {
      if (limit === -1 && page !== undefined)
        throw new Error("Cannot allow page when limit is -1");
      if (limit === 0 || limit < -1) throw new Error("Invalid limit value");
    }

    // * Validate
    if (!schema) {
      throw new Error("Please input field for validation data");
    }

    // * Get skip and limit stage
    if (page) _page = +page;
    if (limit) _limit = +limit;

    // * Validate filter and get match stage
    if (filter && Object.keys(filter as any).length > 0) {
      const queryPredicate = mutateQueryFiltersV2(schema, filter);
      const match = {
        $match: queryPredicate,
      };

      tempMatch = match;
      tempFilter = queryPredicate;
      hasFilter = true;
    }

    // * Validate sort and get sort stage
    if (sort && Object.keys(sort as any).length > 0) {
      const sortEx = { $sort: validatePipeline(schema, sort, "$sort") };
      basePipeline.push(sortEx);
    }

    if (allowDiskUse) _allowDiskUse = allowDiskUse;

    if (typeof calculatePages === "boolean" && calculatePages === false)
      _calculatePages = calculatePages;

    if (readPref) _readPref = readPref;

    if (readConcern) _readConcern = readConcern;

    if (_limit > 0) {
      basePipeline.push({ $skip: _page * _limit - _limit });
      basePipeline.push({ $limit: _limit });
    }

    // * Validate project and get project stage
    if (project && Object.keys(project as any).length > 0) {
      const projectEx = {
        $project: validatePipeline(schema, project, "$project"),
      };
      basePipeline.push(projectEx);
    }
  }

  if (!hasSourcePipeline && !_calculatePages) {
    let data: any[] = [];

    if (_limit !== -1) {
      if (hasFilter) basePipeline.unshift(tempMatch);
      data = await _collectionModel.aggregate(basePipeline);
    }

    if (_limit === -1) {
      data = await _collectionModel.find(tempFilter).lean();
    }

    return {
      _metadata: {
        pageSize: _limit === -1 ? -1 : _limit,
        currentPage: _limit === -1 ? 1 : _page,
      },
      data,
    };
  }

  // * Construct aggregation pipeline
  const pipeline: any[] = [..._sourcePipline];
  if (tempMatch) pipeline.push(tempMatch);

  const facet = new Map<string, any>();
  facet.set("data", basePipeline);
  if (hasSourcePipeline) facet.set("metadata", [{ $count: "total" }]);

  pipeline.push({
    $facet: Object.fromEntries(facet),
  });

  // * Construct promises
  const promises: Promise<unknown>[] = [];

  // * Create promise for aggregation
  /* eslint-disable  no-async-promise-executor */
  const aggregationPromise = new Promise(async (resolve, reject) => {
    try {
      const response = await _collectionModel
        .aggregate(pipeline)
        .allowDiskUse(_allowDiskUse)
        .read(_readPref)
        .readConcern(_readConcern);

      resolve(response.length > 0 ? response[0] : undefined);
    } catch (error) {
      // istanbul ignore next
      const err = error as Error;
      // istanbul ignore next
      reject(new Error(err.message));
    }
  });

  promises.push(aggregationPromise);

  // * Set count for use promise if required
  /* eslint-disable  no-async-promise-executor */
  if (!hasSourcePipeline) {
    const countPromise = new Promise(async (resolve, reject) => {
      try {
        resolve(
          hasFilter
            ? await _collectionModel.countDocuments(tempFilter)
            : await _collectionModel.estimatedDocumentCount()
        );
      } catch (error) {
        // istanbul ignore next
        const err = error as Error;
        // istanbul ignore next
        reject(new Error(err.message));
      }
    });

    promises.push(countPromise);
  }

  const [aggregationResult, countResult] = await Promise.all(promises);
  const { metadata, data } = aggregationResult as any;

  // * Get total documents
  let totalDocuments = 0;
  if (countResult) totalDocuments = +(countResult as any);
  if (metadata && metadata.length > 0) totalDocuments = metadata[0].total;

  // * Construct _metadata
  const _metadata = new Map<string, number>();
  _metadata.set("pageSize", _limit === -1 ? 1 : _limit);
  _metadata.set("currentPage", _limit === -1 ? 1 : _page);

  if (_calculatePages) {
    _metadata.set(
      "totalPages",
      _limit === -1 ? 1 : Math.ceil(totalDocuments / _limit)
    );
    _metadata.set("totalDocuments", totalDocuments);
  }

  return {
    _metadata: Object.fromEntries(_metadata) as MetadataType,
    data: data || [],
  };
}

/**
 * This function used for get total pages and total documents
 * @param collectionModel collection's name
 * @param sourcePipeline pipeline for aggregate
 * @param options includes schema is mandatory, filter and limit are optional
 * @returns total pages and total documents in format: { totalPages: number;  totalDocuments: number;}
 */
export async function queryPages(
  collectionModel: unknown,
  sourcePipeline: unknown[],
  options: QueryPagesOptionType
): Promise<{
  totalPages: number;
  totalDocuments: number;
}> {
  const _collectionModel = collectionModel as any;
  const _sourcePipline = _.cloneDeep(sourcePipeline);

  let _limit = 10;
  let totalDocuments = 0;
  let _filter = {};
  let _match;

  // * For performance
  let _readPref = "secondaryPreferred";
  let _readConcern = "majority";

  if (options) {
    const { limit, filter, schema, readPref, readConcern } = options;

    if (readPref) _readPref = readPref;

    if (readConcern) _readConcern = readConcern;

    // * Always add $text and $expr in schema
    if (schema) {
      schema["$text"] = MongoSchemaType.Object;
      schema["$expr"] = MongoSchemaType.Object;
    }

    // * Validate type of limit
    if (limit) {
      if (!_.isNumber(limit)) throw new Error(`limit type is invalid`);

      _limit = +limit;
    }

    // * Validate filter and get match stage
    if (filter && Object.keys(filter as any).length > 0) {
      _filter = mutateQueryFiltersV2(schema, filter);
      _match = {
        $match: _filter,
      };
    }
  }

  if (_.isEmpty(_filter) && _sourcePipline.length === 0)
    totalDocuments = await _collectionModel.find().estimatedDocumentCount();

  if (!_.isEmpty(_filter) && _sourcePipline.length === 0)
    totalDocuments = await _collectionModel.countDocuments(_filter);

  if (_sourcePipline.length > 0) {
    const pipeline: any[] = [..._sourcePipline];
    if (_match) pipeline.push(_match);
    pipeline.push({
      $count: "totalCount",
    });

    const aggregateResults = await _collectionModel
      .aggregate(pipeline)
      .read(_readPref)
      .readConcern(_readConcern)
      .exec();
    totalDocuments = aggregateResults[0]?.totalCount;
  }

  if (!totalDocuments) totalDocuments = 0;

  return {
    totalPages: Math.ceil(totalDocuments / _limit),
    totalDocuments,
  };
}

export enum AgentClientType {
  AGENT_SERVICE = "agent-service",
  SERVICE = "service",
  APP = "app",
  USER = "user",
}

export const getSocketRecipient = (payload: {
  type: string;
  site?: string;
  device?: string;
  name?: string;
  uid?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): string | string[] | null => {
  try {
    const {
      type,
      site,
      device,
      name,
      uid,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = payload as any;

    let recipient = "";

    // * Check where to send and validate criterias
    if (type === AgentClientType.AGENT_SERVICE) {
      // * Check whether site also exist if device is specified
      if (device && !site) return null;

      recipient = `agent-service-name:${name}`;
      if (site) recipient += `-site:${site}`;
      if (site && device) recipient += `-device:${device}`;
    }

    if (type === AgentClientType.APP) {
      recipient = `app-site:${site}-name:${name}`;
    }

    if (type === AgentClientType.SERVICE) {
      recipient = `service-name:${name}`;
    }

    if (type === AgentClientType.USER) {
      recipient = `user-uid:${uid}`;
    }

    return recipient || null;
  } catch (error) {
    return null;
  }
};

/**
 * validate string for mongoose object id
 * @param _id Data to validate string for mongoose object id
 * @returns
 */
export function isValidObjectId(_id: unknown): boolean {
  // * the different value that can be use on new mongoose.Types.ObjectId
  // * 0 (00000000) - 4294967295 (ffffffff) -> first 8 chars will be hex of the given integer + random last 16 chars
  // * undefined, null, nothing -> random id
  // * "", {}, {...} -> error
  // * string (non-hex) 12 length -> unique hex lowercase
  // * string hex 24 length -> unique same hex lowercase
  if (_id instanceof mongoose.Types.ObjectId) return true;
  if (_.isString(_id)) return /^[A-Fa-f0-9]{24}$/.test(_id);
  return false;
}

export class CustomException extends Error {
  message: string;
  statusCode: number;
  code: any;
  responsioData = {};
  _metadata = {};
  errors: unknown;

  constructor(
    message: string,
    statusCode = 400,
    code?: string,
    responsioData?: any,
    _metadata?: any,
    errors?: unknown
  ) {
    super();
    this.message = message;
    this.statusCode = statusCode;
    this.code = code || -1;
    this.responsioData = responsioData;
    this._metadata = _metadata;
    this.errors = errors;
  }
}

/**
 * Transform object to dot notation object but keep array the same
 * @param obj object tp transform
 * @param prefix dot no tation prefix
 * @param target initial object
 * @returns dot notation object
 */
export function getDotNotation(
  obj: any,
  prefix: any = null,
  target: any = null
): any {
  let _target = _.cloneDeep(target) || {};
  prefix = prefix || "";

  Object.keys(obj).forEach(function (key: any) {
    if (
      typeof obj[key] !== "object" ||
      Array.isArray(obj[key]) ||
      obj[key] instanceof Date ||
      obj[key] instanceof mongoose.Types.ObjectId ||
      obj[key] === null
    ) {
      _target[prefix + key] = obj[key];
      return _target[prefix + key];
    }

    if (typeof obj[key] === "object" && obj[key] !== null)
      _target = getDotNotation(obj[key], prefix + key + ".", _target);
  });

  return _target;
}
