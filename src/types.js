// @flow

export type Node = {
  type: string,
  [prop: any]: any,
};

export type Path = {
  type: string,
  node: Node,
  scope: Scope,
  buildCodeFrameError: (message: string) => Error,
  insertBefore: (node: Node) => void,
  remove: () => void,
  [prop: string]: any,
};

export type Binding = {
  kind: string,
  path: Path,
  [prop: string]: any,
};

export type Scope = {
  getBinding(name: string): ?Binding,
};
