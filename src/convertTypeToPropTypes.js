// @flow
import type {Path, Node} from './types';
import * as t from 'babel-types';
import {log} from 'babel-log';

type Options = {
  propTypesRef: Node,
};

let refPropTypes = (property: Node, opts: Options): Node => {
  return t.memberExpression(opts.propTypesRef, property);
};

let createThrows = message => (path: Path, opts: Options) => {
  throw path.buildCodeFrameError(message);
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

  let id = t.inheritsComments(t.identifier(key.node.name), key.node);

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
    throw path.buildCodeFrameError('Missing reference');
  }
  return convert(binding.path, opts);
};

converters.TypeAlias = (path: Path, opts: Options) => {
  return convert(path.get('right'), opts);
};

converters.InterfaceDeclaration = (path: Path, opts: Options) => {
  return convert(path.get('body'), opts);
};

converters.ClassDeclaration = (path: Path, opts: Options) => {
  return t.callExpression(refPropTypes(t.identifier('instanceOf'), opts), [
    t.identifier(path.node.id.name),
  ]);
};

let convert = (path: Path, opts: {propTypesRef: Node}): Node => {
  let converter = converters[path.type];

  if (!converter) {
    throw path.buildCodeFrameError(`No converter for node type: ${path.type}`);
  }

  return t.inheritsComments(converter(path, opts), path.node);
};

export default function convertTypeToPropTypes(
  typeAnnotation: Path,
  propTypesRef: Node,
): Node {
  return convert(typeAnnotation, {propTypesRef}).arguments[0];
}
