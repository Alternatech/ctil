export class SourceType {
  public sourceKey!: string;

  public documentId!: string;
}

export class LookupType {
  public join!: string;

  public localField!: string;

  public foreignField?: string;
}

export class QueryOptionType {
  public startingSource?: SourceType;

  public lookups?: LookupType[];

  public filter?: unknown;

  public limit?: number;
}
