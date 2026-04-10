export interface SchemaTransform<TData> {
  fromVersion: string;
  toVersion: string;
  apply: (data: TData) => TData;
}

export interface RunSchemaTransformsOptions<TData> {
  currentVersion: string;
  targetVersion: string;
  data: TData;
  transforms: SchemaTransform<TData>[];
}

export interface AppliedSchemaTransform {
  fromVersion: string;
  toVersion: string;
}

export function runSchemaTransforms<TData>({
  currentVersion,
  targetVersion,
  data,
  transforms,
}: RunSchemaTransformsOptions<TData>): { data: TData; applied: AppliedSchemaTransform[] } {
  if (currentVersion === targetVersion || transforms.length === 0) {
    return { data, applied: [] };
  }

  let nextData = data;
  const applied: AppliedSchemaTransform[] = [];

  for (const transform of transforms) {
    nextData = transform.apply(nextData);
    applied.push({
      fromVersion: transform.fromVersion,
      toVersion: transform.toVersion,
    });
  }

  return { data: nextData, applied };
}