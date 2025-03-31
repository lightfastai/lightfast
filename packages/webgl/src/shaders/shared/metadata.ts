export interface ValueFieldMetadata {
  min: number;
  max: number;
  step: number;
}

export interface Vec1FieldMetadata {
  x: ValueFieldMetadata;
}

export interface Vec2FieldMetadata {
  x: ValueFieldMetadata;
  y: ValueFieldMetadata;
}

export interface Vec3FieldMetadata {
  x: ValueFieldMetadata;
  y: ValueFieldMetadata;
  z: ValueFieldMetadata;
}

export interface UniformConstraint {
  type: "vec1" | "vec2" | "vec3";
  metadata: Vec1FieldMetadata | Vec2FieldMetadata | Vec3FieldMetadata;
}
