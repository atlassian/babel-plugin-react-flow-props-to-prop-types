// @flow
import type {Path, Node} from './types';
import * as t from 'babel-types';
import {log} from 'babel-log';
import {loadImportSync} from 'babel-file-loader';
import matchExported from './matchExported';
import error from './error';
import {findFlowBinding} from 'babel-flow-scope';

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

function isLiteralTypeAnnotation(node) {
  return (
    t.isStringLiteralTypeAnnotation(node) ||
    t.isBooleanLiteralTypeAnnotation(node) ||
    t.isNumericLiteralTypeAnnotation(node) ||
    t.isVoidTypeAnnotation(node) ||
    t.isNullLiteralTypeAnnotation(node)
  );
}

function typeToValue(node) {
  let value;

  if (t.isVoidTypeAnnotation(node)) {
    value = undefined;
  } else if (t.isNullLiteralTypeAnnotation(node)) {
    value = null;
  } else {
    value = node.value;
  }

  return t.valueToNode(value);
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

let convertLiteral = (path: Path, opts: Options): Node => {
  let arr = t.arrayExpression([typeToValue(path.node)]);
  return t.callExpression(refPropTypes(t.identifier('oneOf'), opts), [arr]);
};

let converters = {};

converters.AnyTypeAnnotation = createConversion('any');
converters.MixedTypeAnnotation = createConversion('any');
converters.NumberTypeAnnotation = createConversion('number');
converters.NumericLiteralTypeAnnotation = convertLiteral;
converters.BooleanTypeAnnotation = createConversion('bool');
converters.BooleanLiteralTypeAnnotation = convertLiteral;
converters.StringTypeAnnotation = createConversion('string');
converters.StringLiteralTypeAnnotation = convertLiteral;
converters.NullLiteralTypeAnnotation = convertLiteral;
converters.VoidTypeAnnotation = convertLiteral;
converters.FunctionTypeAnnotation = createConversion('func');
converters.TupleTypeAnnotation = createConversion('array');

converters.NullableTypeAnnotation = (path: Path, opts: Options) => {
  return t.callExpression(refPropTypes(t.identifier('oneOf'), opts), [
    t.valueToNode(null),
    t.valueToNode(undefined),
    convert(path.get('typeAnnotation'), opts),
  ]);
};

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
      // result may be from:
      //  ObjectTypeProperty - objectProperty
      //  ObjectTypeSpreadProperty - Array<objectProperty>
      const converted = convert(property, opts);
      if (Array.isArray(converted)){
        converted.forEach((prop) => {
          props.push(prop)
        });
      }
      else {
        props.push(converted);
      }
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

converters.ObjectTypeSpreadProperty = (path: Path, opts: Options) => {
  //let key = path.get('key');
  //let value = path.get('value');

  let argument = path.get('argument')
  let typeParameters = path.get('typeParameters')

  const exact = false; //isExact(argument);
  let subnode;
  if(exact) {
    subnode = node.argument.typeParameters.params[0];
  }
  else {
    subnode = argument;
  }

  let converted = convert(subnode, opts);
  const properties = converted.arguments[0].properties;

  // Unless or until the strange default behavior changes in flow (https://github.com/facebook/flow/issues/3214)
  // every property from spread becomes optional unless it uses `...$Exact<T>`

  // @see also explanation of behavior - https://github.com/facebook/flow/issues/3534#issuecomment-287580240
  // @returns flattened properties from shape
  //if(!exact) {
  //  properties.forEach((prop) => prop.value.isRequired = false);
  //}
  return properties;
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

  let binding = findFlowBinding(path, name);

  if (!binding) {
    throw error(path, `Missing reference "${name}"`);
  }

  let bindingPath;

  if (binding.kind === 'declaration') {
    bindingPath = binding.path.parentPath;
  } else if (binding.kind === 'import') {
    bindingPath = binding.path.parentPath;
  } else if (binding.kind === 'param') {
    throw binding.path.buildCodeFrameError('Cannot convert type parameters');
  } else {
    throw new Error(`Unexpected Flow binding kind: ${binding.kind}`);
  }

  return convert(bindingPath, opts);
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
  let isLiterals = path.node.types.every(isLiteralTypeAnnotation);
  let propType;
  let elements;

  if (isLiterals) {
    propType = 'oneOf';
    elements = path.get('types').map(p => typeToValue(p.node));
  } else {
    propType = 'oneOfType';
    elements = path.get('types').map(p => convert(p, opts));
  }

  let arr = t.arrayExpression(elements);
  return t.callExpression(refPropTypes(t.identifier(propType), opts), [arr]);
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
