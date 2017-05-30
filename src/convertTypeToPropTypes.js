// @flow
import type {Path, Node} from './types';
import * as t from 'babel-types';
import {log} from 'babel-log';
import {loadImportSync} from 'babel-file-loader';
import matchExported from './matchExported';
import {
  wrapErrorWithCodeFrame,
  buildCodeFrameError,
  toErrorStack,
} from 'babel-errors';

function error(path, message) {
  let err = buildCodeFrameError(path, message);
  err.stack = toErrorStack(err);
  return err;
}

function cloneComments(comments) {
  return (
    comments &&
    comments.map(comment => {
      comment = t.clone(comment);
      comment.start = comment.start + 0.0001; // Force printer to print... (sigh)
      return comment;
    })
  );
}

function inheritsComments(a, b) {
  return t.inheritsComments(a, {
    trailingComments: cloneComments(b.trailingComments),
    leadingComments: cloneComments(b.leadingComments),
    innerComments: cloneComments(b.innerComments),
  });
}

type Options = {
  getPropTypesRef: () => Node,
  getPropTypesAllRef: () => Node,
  resolveOpts?: Object,
};

let refPropTypes = (property: Node, opts: Options): Node => {
  return t.memberExpression(opts.getPropTypesRef(), property);
};

let createThrows = message => (path: Path, opts: Options) => {
  throw error(path, message);
};

let createConversion = name => (path: Path, opts: Options): Node => {
  return refPropTypes(t.identifier(name), opts);
};

let converters = {};

converters.AnyTypeAnnotation = createConversion('any');
converters.MixedTypeAnnotation = createConversion('any');
converters.NumberTypeAnnotation = createConversion('number');
converters.NumericLiteralTypeAnnotation = createConversion('number');
converters.BooleanTypeAnnotation = createConversion('bool');
converters.BooleanLiteralTypeAnnotation = createConversion('bool');
converters.StringTypeAnnotation = createConversion('string');
converters.StringLiteralTypeAnnotation = createConversion('string');
converters.NullLiteralTypeAnnotation = createThrows('null types unsupported');
converters.VoidTypeAnnotation = createThrows('void types unsupported');
converters.FunctionTypeAnnotation = createConversion('func');
converters.NullableTypeAnnotation = createThrows('maybe types unsupported');
converters.TupleTypeAnnotation = createConversion('array');

converters.QualifiedTypeIdentifier = createThrows(
  'qualified type identifiers unsupported',
);

converters.TypeAnnotation = (path: Path, opts: Options) => {
  return convert(path.get('typeAnnotation'), opts);
};

converters.ObjectTypeAnnotation = (path: Path, opts: Options) => {
  let {properties, indexers, callProperties} = path.node;

  if (properties.length && indexers.length) {
    throw error(
      path,
      'Objects with both properties and indexers are unsupported',
    );
  }

  if (!properties.length && indexers.length > 1) {
    throw error(path, 'Objects with multiple indexers are unsupported');
  }

  if (callProperties.length) {
    throw error(
      path.get('callProperties')[0],
      'Object call properties are unsupported',
    );
  }

  if (indexers.length) {
    let indexer = path.get('indexers')[0];
    return t.callExpression(refPropTypes(t.identifier('objectOf'), opts), [
      convert(indexer, opts),
    ]);
  } else {
    let props = [];

    for (let property of path.get('properties')) {
      props.push(convert(property, opts));
    }

    let object = t.objectExpression(props);

    return t.callExpression(refPropTypes(t.identifier('shape'), opts), [
      object,
    ]);
  }
};

converters.ObjectTypeProperty = (path: Path, opts: Options) => {
  let key = path.get('key');
  let value = path.get('value');

  let id;
  if (key.isStringLiteral()) {
    id = t.stringLiteral(key.node.value);
  } else {
    id = t.identifier(key.node.name);
  }

  let converted = convert(value, opts);

  if (!path.node.optional) {
    converted = t.memberExpression(converted, t.identifier('isRequired'));
  }

  return t.objectProperty(inheritsComments(id, key.node), converted);
};

converters.ObjectTypeIndexer = (path: Path, opts: Options) => {
  return convert(path.get('value'), opts);
};

converters.ArrayTypeAnnotation = (path: Path, opts: Options) => {
  return t.callExpression(refPropTypes(t.identifier('arrayOf'), opts), [
    convert(path.get('elementType'), opts),
  ]);
};

let typeParametersConverters = {
  Array: (path: Path, opts: Options) => {
    let param = path.get('typeParameters').get('params')[0];
    return t.callExpression(refPropTypes(t.identifier('arrayOf'), opts), [
      convert(param, opts),
    ]);
  },
};

converters.GenericTypeAnnotation = (path: Path, opts: Options) => {
  if (!path.node.typeParameters) {
    return convert(path.get('id'), opts);
  }

  let name = path.node.id.name;

  if (typeParametersConverters[name]) {
    return typeParametersConverters[name](path, opts);
  } else {
    throw error(
      path,
      `Unsupported generic type annotation with type parameters`,
    );
  }
};

let typeIdentifierConverters = {
  Function: createConversion('func'),
  Object: createConversion('object'),
};

converters.Identifier = (path: Path, opts: Options) => {
  let name = path.node.name;

  if (path.parentPath.isFlow() && typeIdentifierConverters[name]) {
    return typeIdentifierConverters[name](path, opts);
  }

  let binding = path.scope.getBinding(name);
  if (!binding) {
    throw error(path, `Missing reference "${name}"`);
  }
  return convert(binding.path, opts);
};

converters.TypeAlias = (path: Path, opts: Options) => {
  return convert(path.get('right'), opts);
};

converters.InterfaceDeclaration = (path: Path, opts: Options) => {
  return convert(path.get('body'), opts);
};

converters.ClassDeclaration = (path: Path, opts: Options, id?: Node) => {
  return t.callExpression(refPropTypes(t.identifier('instanceOf'), opts), [
    id || t.identifier(path.node.id.name),
  ]);
};

converters.UnionTypeAnnotation = (path: Path, opts: Options) => {
  let types = path.get('types').map(p => convert(p, opts));
  let arr = t.arrayExpression(types);

  return t.callExpression(refPropTypes(t.identifier('oneOfType'), opts), [arr]);
};

converters.IntersectionTypeAnnotation = (path: Path, opts: Options) => {
  return t.callExpression(
    opts.getPropTypesAllRef(),
    path.get('types').map(type => {
      return convert(type, opts);
    }),
  );
};

function _convertImportSpecifier(path: Path, opts: Options) {
  let kind = path.parent.importKind;
  if (kind === 'typeof') {
    throw error(path, 'import typeof is unsupported');
  }

  let file = loadImportSync(path.parentPath, opts.resolveOpts);
  let local = path.node.local.name;
  let name;

  if (path.type === 'ImportDefaultSpecifier' && kind === 'value') {
    name = 'default';
  } else {
    name = local;
  }

  let exported = matchExported(file, name);

  if (!exported) {
    throw error(path, 'Missing matching export');
  }

  return convert(exported, opts, t.identifier(name));
}

converters.ImportDefaultSpecifier = (path: Path, opts: Options) => {
  return _convertImportSpecifier(path, opts);
};

converters.ImportSpecifier = (path: Path, opts: Options) => {
  return _convertImportSpecifier(path, opts);
};

let convert = (path: Path, opts: Options, id?: Node): Node => {
  let converter = converters[path.type];

  if (!converter) {
    throw error(path, `No converter for node type: ${path.type}`);
  }

  return inheritsComments(converter(path, opts, id), path.node);
};

export default function convertTypeToPropTypes(
  typeAnnotation: Path,
  opts: Options,
): Node {
  return convert(typeAnnotation, opts).arguments[0];
}
