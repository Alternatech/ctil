import {
  prop,
  getModelForClass,
  Ref,
  mongoose,
  index,
} from "@typegoose/typegoose";
import { Schema } from "mongoose";

// * Model TestRef
export class TestRef {
  @prop({ type: Number })
  public code!: number;
}

export const TestRefModel = getModelForClass(TestRef, {
  schemaOptions: { collection: "cltTestRef" },
});

// * Model test
class TestCSub {
  @prop({ type: String })
  public testCSub1!: string;

  @prop({ type: String })
  public testCSub2!: string;
}

class TestC {
  @prop({ type: TestCSub })
  public testCa!: TestCSub;

  @prop({ type: Number })
  public testCb!: number;

  @prop({ type: Date })
  public testCc!: Date;

  @prop({ type: mongoose.Types.ObjectId })
  public testCd!: mongoose.Types.ObjectId;

  @prop({ type: String })
  public testCe?: string;

  @prop({ type: Number })
  public testCf?: number;

  @prop({ type: Boolean })
  public testCg?: boolean;

  @prop({ type: String })
  public testCh?: string[];

  @prop({ type: mongoose.Types.ObjectId })
  public testCi?: mongoose.Types.ObjectId[];

  @prop({ type: Number })
  public testCj?: number[];
}

class TestG {
  @prop({ type: String })
  public testGa!: string;

  @prop({ type: Number })
  public testGb!: number;

  @prop({ type: Boolean })
  public testGc!: boolean;

  @prop({ type: Date })
  public testGd!: Date;

  @prop({ type: mongoose.Types.ObjectId })
  public testGe!: mongoose.Types.ObjectId;
}

@index({ "$**": "text" })
export class Test {
  @prop({ type: Number })
  public no!: number;

  @prop({ type: String })
  public testA!: string;

  @prop({ type: Number })
  public testB!: number;

  @prop({ _id: false, type: TestC })
  public testC!: TestC;

  @prop({ type: Schema.Types.ObjectId })
  public testD!: mongoose.Types.ObjectId[];

  @prop({ type: String })
  public testE!: string[];

  @prop({ type: Number })
  public testF!: number[];

  @prop({ _id: false, type: TestG })
  public testG!: TestG[];

  @prop({ type: Date })
  public testH?: Date;

  @prop({ type: mongoose.Types.ObjectId })
  public testI?: mongoose.Types.ObjectId;

  @prop({ type: Boolean })
  public testJ?: boolean;

  @prop({ type: Boolean })
  public testK?: boolean[];

  @prop({ ref: () => TestRef })
  public testR?: Ref<TestRef>;

  @prop({ ref: () => Date })
  public testM?: Date;

  @prop({ type: Number })
  public testStatus?: number;
}

export const TestModel = getModelForClass(Test, {
  schemaOptions: { collection: "cltTests" },
});
