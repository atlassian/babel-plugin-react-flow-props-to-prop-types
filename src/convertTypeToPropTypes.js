// @flow
import type {Path, Node} from './types';
import * as t from 'babel-types';
import {log} from 'babel-log';
import {loadImportSync} from 'babel-file-loader';
import matchExported from './matchExported';
import error from './error';
import {findFlowBinding} from 'babel-flow-scope';
import {explodeStatement} from 'babel-explode-module';

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

converters.TypeAnnotation = (path: Path, opts: Options, id, topLevel) => {
  return convert(path.get('typeAnnotation'), opts, id, topLevel);
};

converters.ObjectTypeAnnotation = function(
  path: Path,
  opts: Options,
  id,
  topLevel: boolean,
) {
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
      props.push(convert(property, opts, undefined, topLevel));
    }

    let object = t.objectExpression(props);

    if (topLevel) {
      return object;
    } else {
      return t.callExpression(refPropTypes(t.identifier('shape'), opts), [
        object,
      ]);
    }
  }
};

converters.ObjectTypeProperty = (
  path: Path,
  opts: Options,
  id,
  topLevel: boolean,
) => {
  let key = path.get('key');
  let value = path.get('value');

  let keyId;
  if (key.isStringLiteral()) {
    keyId = t.stringLiteral(key.node.value);
  } else {
    keyId = t.identifier(key.node.name);
  }

  let converted = convert(value, opts, undefined, undefined, topLevel);

  if (!path.node.optional && !converted[OPTIONAL]) {
    converted = t.memberExpression(converted, t.identifier('isRequired'));
  }

  return t.objectProperty(inheritsComments(keyId, key.node), converted);
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

function getTypeParam(path, index) {
  return path.get('typeParameters').get('params')[index];
}

const OPTIONAL = Symbol('optional');

let pluginTypeConverters = {
  PropType: (path: Path, opts: Options) => {
    return convert(getTypeParam(path, 1), opts);
  },
  HasDefaultProp: (path: Path, opts: Options) => {
    let converted = convert(getTypeParam(path, 0), opts);
    converted[OPTIONAL] = true;
    return converted;
  },
};

converters.GenericTypeAnnotation = (
  path: Path,
  opts: Options,
  id,
  topLevel,
) => {
  if (!path.node.typeParameters) {
    return convert(path.get('id'), opts, id, topLevel);
  }

  let name = path.node.id.name;

  if (typeParametersConverters[name]) {
    return typeParametersConverters[name](path, opts);
  }

  let binding = path.scope.getBinding(name);

  if (binding) {
    let statement = binding.path.parentPath;
    let exploded = explodeStatement(statement.node);
    let matched = exploded.imports.find(specifier => {
      return specifier.local === name;
    });

    if (
      matched &&
      matched.kind === 'type' &&
      matched.source === 'babel-plugin-react-flow-props-to-prop-types' &&
      matched.external &&
      pluginTypeConverters[matched.external]
    ) {
      return pluginTypeConverters[matched.external](path, opts);
    }
  }

  throw error(path, `Unsupported generic type annotation with type parameters`);
};

let typeIdentifierConverters = {
  Function: createConversion('func'),
  Object: createConversion('object'),
};

converters.Identifier = (path: Path, opts: Options, id, topLevel) => {
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

  return convert(bindingPath, opts, id, topLevel);
};

converters.TypeAlias = (path: Path, opts: Options, id, topLevel) => {
  return convert(path.get('right'), opts, id, topLevel);
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

converters.IntersectionTypeAnnotation = (
  path: Path,
  opts: Options,
  id,
  topLevel,
) => {
  if (!topLevel) {
    return t.callExpression(
      opts.getPropTypesAllRef(),
      path.get('types').map(type => {
        return convert(type, opts);
      }),
    );
  } else {
    let properties = [];

    path.get('types').forEach(type => {
      let result = convert(type, opts, undefined, true);

      if (!t.isObjectExpression(result)) {
        throw type.buildCodeFrameError(
          'Cannot have intersection of non-objects or complex objects as top-level props',
        );
      }

      properties = properties.concat(result.properties);
    });

    return t.objectExpression(properties);
  }
};

function _convertImportSpecifier(path: Path, opts: Options, id, topLevel) {
  let kind = path.parent.importKind;
  if (kind === 'typeof') {
    throw error(path, 'import typeof is unsupported');
  }

  let file = loadImportSync(path.parentPath, opts.resolveOpts);
  let name;

  if (path.type === 'ImportDefaultSpecifier' && kind === 'value') {
    name = 'default';
  } else if (path.node.imported) {
    name = path.node.imported.name;
  } else {
    name = path.node.local.name;
  }

  let exported = matchExported(file, name);

  if (!exported) {
    throw error(path, 'Missing matching export');
  }

  return convert(exported, opts, t.identifier(name), topLevel);
}

converters.ImportDefaultSpecifier = (
  path: Path,
  opts: Options,
  id,
  topLevel,
) => {
  return _convertImportSpecifier(path, opts, undefined, topLevel);
};

converters.ImportSpecifier = (path: Path, opts: Options, id, topLevel) => {
  return _convertImportSpecifier(path, opts, undefined, topLevel);
};

let convert = function(
  path: Path,
  opts: Options,
  id?: Node,
  topLevel?: boolean,
  allowOptional?: boolean,
): Node {
  let converter = converters[path.type];

  if (!converter) {
    throw error(path, `No converter for node type: ${path.type}`);
  }

  // console.log(`convert(${path.type}, ${opts}, ${String(id)}, ${String(topLevel)})`);
  let converted = inheritsComments(
    converter(path, opts, id, topLevel),
    path.node,
  );

  if (!allowOptional && converted[OPTIONAL]) {
    throw error(
      path,
      'HasDefaultProp<T> must only be used as the immediate value inside `props: {}`',
    );
  }

  return converted;
};

export default function convertTypeToPropTypes(
  typeAnnotation: Path,
  opts: Options,
): Node {
  return convert(typeAnnotation, opts, undefined, true);
}
