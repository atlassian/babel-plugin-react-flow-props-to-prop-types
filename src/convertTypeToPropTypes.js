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
  propTypesRef: Node,
  resolveOpts?: Object,
};

let refPropTypes = (property: Node, opts: Options): Node => {
  return t.memberExpression(opts.propTypesRef, property);
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
  let properties = [];

  for (let property of path.get('properties')) {
    properties.push(convert(property, opts));
  }

  let object = t.objectExpression(properties);

  return t.callExpression(refPropTypes(t.identifier('shape'), opts), [object]);
};

converters.ObjectTypeProperty = (path: Path, opts: Options) => {
  let key = path.get('key');
  let value = path.get('value');

  let id = inheritsComments(t.identifier(key.node.name), key.node);

  let converted = convert(value, opts);

  if (!path.node.optional) {
    converted = t.memberExpression(converted, t.identifier('isRequired'));
  }

  return t.objectProperty(id, converted);
};

converters.ArrayTypeAnnotation = (path: Path, opts: Options) => {
  return t.callExpression(refPropTypes(t.identifier('arrayOf'), opts), [
    convert(path.get('elementType'), opts),
  ]);
};

converters.GenericTypeAnnotation = (path: Path, opts: Options) => {
  return convert(path.get('id'), opts);
};

converters.Identifier = (path: Path, opts: Options) => {
  let binding = path.scope.getBinding(path.node.name);
  if (!binding) {
    throw error(path, `Missing reference "${path.node.name}"`);
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

  return t.callExpression(refPropTypes(t.identifier('oneOf'), opts), [arr]);
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

let convert = (path: Path, opts: {propTypesRef: Node}, id?: Node): Node => {
  let converter = converters[path.type];

  if (!converter) {
    throw error(path, `No converter for node type: ${path.type}`);
  }

  return inheritsComments(converter(path, opts, id), path.node);
};

export default function convertTypeToPropTypes(
  typeAnnotation: Path,
  propTypesRef: Node,
  resolveOpts?: Object,
): Node {
  return convert(typeAnnotation, {propTypesRef, resolveOpts}).arguments[0];
}
