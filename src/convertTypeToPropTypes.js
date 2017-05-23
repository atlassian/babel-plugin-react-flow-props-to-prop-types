// @flow
import type {Path, Node} from './types';
import * as t from 'babel-types';
import log from './log';

let refPropTypes = (property: Node): Node => {
  return t.memberExpression(t.identifier('PropTypes'), property);
};

let createThrows = message => (path: Path) => {
  throw path.buildCodeFrameError(message);
};

let createConversion = name => (path: Path): Node => {
  return refPropTypes(t.identifier(name));
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

converters.TypeAnnotation = (path: Path) => {
  return convert(path.get('typeAnnotation'));
};

converters.ObjectTypeAnnotation = (path: Path) => {
  let properties = [];

  for (let property of path.get('properties')) {
    properties.push(convert(property));
  }

  let object = t.objectExpression(properties);

  return t.callExpression(refPropTypes(t.identifier('shape')), [object]);
};

converters.ObjectTypeProperty = (path: Path) => {
  let key = path.get('key');
  let value = path.get('value');

  let id = t.inheritsComments(t.identifier(key.node.name), key.node);

  let converted = convert(value);

  if (!path.node.optional) {
    converted = t.memberExpression(converted, t.identifier('isRequired'));
  }

  return t.objectProperty(id, converted);
};

converters.ArrayTypeAnnotation = (path: Path) => {
  return t.callExpression(refPropTypes(t.identifier('arrayOf')), [
    convert(path.get('elementType')),
  ]);
};

converters.GenericTypeAnnotation = (path: Path) => {
  return convert(path.get('id'));
};

converters.Identifier = (path: Path) => {
  let binding = path.scope.getBinding(path.node.name);
  if (!binding) {
    throw path.buildCodeFrameError('Missing reference');
  }
  return convert(binding.path);
};

converters.TypeAlias = (path: Path) => {
  return convert(path.get('right'));
};

converters.InterfaceDeclaration = (path: Path) => {
  return convert(path.get('body'));
};

converters.ClassDeclaration = (path: Path) => {
  return t.callExpression(refPropTypes(t.identifier('instanceOf')), [
    t.identifier(path.node.id.name),
  ]);
};

let convert = (path: Path): Node => {
  let converter = converters[path.type];

  if (!converter) {
    throw path.buildCodeFrameError(`No converter for node type: ${path.type}`);
  }

  return t.inheritsComments(converter(path), path.node);
};

export default function convertTypeToPropTypes(typeAnnotation: Path): Node {
  return convert(typeAnnotation).arguments[0];
}
