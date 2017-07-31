// @flow
import type {Path, Node} from './types';
import * as t from 'babel-types';
import {loadImportSync} from 'babel-file-loader';
import matchExported from './matchExported';
import error from './error';
import {isFlowIdentifier} from 'babel-flow-identifiers';
import {findFlowBinding} from 'babel-flow-scope';
import {explodeStatement} from 'babel-explode-module';

type Context = {
  depth: number,
  replacementId?: Node,
  isObjectValue?: boolean,
};

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

function isObjectValue(path) {
  return (
    path.parent.type === 'ObjectTypeProperty' && path.parentKey === 'value'
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

function isExact(path: Path) {
  return path.node.type === 'GenericTypeAnnotation' &&
    (path.node.id.name === '$Exact' || path.context.parentPath.parentPath.node.exact)
}

type Options = {
  getPropTypesRef: () => Node,
  getPropTypesAllRef: () => Node,
  resolveOpts?: Object,
  nonExactSpread?: boolean,
};

let refPropTypes = (property: Node, opts: Options): Node => {
  return t.memberExpression(opts.getPropTypesRef(), property);
};

let createThrows = message => (path: Path, opts: Options, context: Context) => {
  throw error(path, message);
};

let createConversion = name => (
  path: Path,
  opts: Options,
  context: Context,
): Node => {
  return refPropTypes(t.identifier(name), opts);
};

let convertLiteral = (path: Path, opts: Options, context: Context): Node => {
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

converters.NullableTypeAnnotation = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  let converted = convert(path.get('typeAnnotation'), opts, context);

  if (isObjectValue(path)) {
    converted[OPTIONAL] = true;
    return converted;
  } else {
    return t.callExpression(refPropTypes(t.identifier('oneOf'), opts), [
      t.arrayExpression([
        t.valueToNode(null),
        t.valueToNode(undefined),
        converted,
      ]),
    ]);
  }
};

converters.QualifiedTypeIdentifier = createThrows(
  'qualified type identifiers unsupported',
);

converters.TypeAnnotation = (path: Path, opts: Options, context: Context) => {
  return convert(path.get('typeAnnotation'), opts, context);
};

converters.ObjectTypeAnnotation = function(
  path: Path,
  opts: Options,
  context: Context,
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
      convert(indexer, opts, {...context, depth: context.depth + 1}),
    ]);
  } else {
    let props = [];

    for (let property of path.get('properties')) {
      // result may be from:
      //  ObjectTypeProperty - objectProperty
      //  ObjectTypeSpreadProperty - Array<objectProperty>
      const converted = convert(property, opts, {...context, depth: context.depth + 1});
      if (Array.isArray(converted)){
        converted.forEach((prop) => props.push(prop));
      }
      else {
        props.push(converted);
      }
    }

    let object = t.objectExpression(props);

    if (context.depth === 0) {
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
  context: Context,
) => {
  let key = path.get('key');
  let value = path.get('value');

  let keyId;
  if (key.isStringLiteral()) {
    keyId = t.stringLiteral(key.node.value);
  } else {
    keyId = t.identifier(key.node.name);
  }

  let converted = convert(value, opts, context);

  if (!path.node.optional && !converted[OPTIONAL] && !opts.nonExactSpread) {
    converted = t.memberExpression(converted, t.identifier('isRequired'));
  }

  return t.objectProperty(inheritsComments(keyId, key.node), converted);
};

converters.ObjectTypeSpreadProperty = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  const argument = path.get('argument')

  // Unless or until the strange default behavior changes in flow (https://github.com/facebook/flow/issues/3214)
  // every property from spread becomes optional unless it uses `...$Exact<T>`
  // @see also explanation of behavior - https://github.com/facebook/flow/issues/3534#issuecomment-287580240
  const converted = convert(argument, {...opts, nonExactSpread: !isExact(argument)}, context);

  // @returns flattened properties from shape
  return converted.arguments[0].properties;
};

converters.ObjectTypeIndexer = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  return convert(path.get('value'), opts, context);
};

converters.ArrayTypeAnnotation = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  return t.callExpression(refPropTypes(t.identifier('arrayOf'), opts), [
    convert(path.get('elementType'), opts, context),
  ]);
};

let typeParametersConverters = {
  Array: (path: Path, opts: Options, context: Context) => {
    let param = path.get('typeParameters').get('params')[0];
    return t.callExpression(refPropTypes(t.identifier('arrayOf'), opts), [
      convert(param, opts, context),
    ]);
  },
  '$Exact': (path: Path, opts: Options, context: Context) => {
    let param = path.get('typeParameters').get('params')[0];
    return convert(param, opts, context);
  },
};

function getTypeParam(path, index) {
  return path.get('typeParameters').get('params')[index];
}

const OPTIONAL = Symbol('optional');

let pluginTypeConverters = {
  PropType: (path: Path, opts: Options, context: Context) => {
    return convert(getTypeParam(path, 1), opts, context);
  },
  HasDefaultProp: (path: Path, opts: Options, context: Context) => {
    if (context.depth > 1 || !isObjectValue(path)) {
      throw error(
        path,
        'HasDefaultProp<T> must only be used as the immediate value inside `props: {}`',
      );
    }

    let converted = convert(getTypeParam(path, 0), opts, context);
    converted[OPTIONAL] = true;
    return converted;
  },
};

converters.GenericTypeAnnotation = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  if (!path.node.typeParameters) {
    return convert(path.get('id'), opts, context);
  }

  let name = path.node.id.name;

  if (typeParametersConverters[name]) {
    return typeParametersConverters[name](path, opts, context);
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
      return pluginTypeConverters[matched.external](path, opts, context);
    }
  }

  throw error(path, `Unsupported generic type annotation with type parameters`);
};

let typeIdentifierConverters = {
  Function: createConversion('func'),
  Object: createConversion('object'),
};

converters.Identifier = (path: Path, opts: Options, context: Context) => {
  let name = path.node.name;

  if (path.parentPath.isFlow() && typeIdentifierConverters[name]) {
    return typeIdentifierConverters[name](path, opts, context);
  }

  let binding;
  if (isFlowIdentifier(path)) {
    binding = findFlowBinding(path, name);
  } else {
    binding = path.scope.getBinding(name);
  }

  if (!binding) {
    throw error(path, `Missing reference "${name}"`);
  }

  let kind = binding.kind;
  let bindingPath;

  if (kind === 'import' || kind === 'declaration') {
    bindingPath = binding.path.parentPath;
  } else if (kind === 'module' || kind === 'let') {
    bindingPath = binding.path;
  } else if (kind === 'param') {
    throw binding.path.buildCodeFrameError('Cannot convert type parameters');
  } else {
    throw new Error(`Unexpected Flow binding kind: ${binding.kind}`);
  }

  return convert(bindingPath, opts, context);
};

converters.TypeAlias = (path: Path, opts: Options, context: Context) => {
  return convert(path.get('right'), opts, context);
};

converters.InterfaceDeclaration = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  return convert(path.get('body'), opts, context);
};

converters.ClassDeclaration = (path: Path, opts: Options, context: Context) => {
  return t.callExpression(refPropTypes(t.identifier('instanceOf'), opts), [
    context.replacementId || t.identifier(path.node.id.name),
  ]);
};

converters.UnionTypeAnnotation = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  let isLiterals = path.node.types.every(isLiteralTypeAnnotation);
  let propType;
  let elements;

  if (isLiterals) {
    propType = 'oneOf';
    elements = path.get('types').map(p => typeToValue(p.node));
  } else {
    propType = 'oneOfType';
    elements = path.get('types').map(p => convert(p, opts, context));
  }

  let arr = t.arrayExpression(elements);
  return t.callExpression(refPropTypes(t.identifier(propType), opts), [arr]);
};

converters.IntersectionTypeAnnotation = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  if (context.depth > 0) {
    return t.callExpression(
      opts.getPropTypesAllRef(),
      path.get('types').map(type => {
        return convert(type, opts, context);
      }),
    );
  } else {
    let properties = [];

    path.get('types').forEach(type => {
      let result = convert(type, opts, context);

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

function _convertImportSpecifier(path: Path, opts: Options, context) {
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

  let id;
  if (path.node.imported) {
    id = path.node.imported.name;
  } else {
    id = path.node.local.name;
  }

  let exported = matchExported(file, name);

  if (!exported) {
    throw error(path, 'Missing matching export');
  }

  return convert(exported, opts, {
    ...context,
    replacementId: t.identifier(id),
  });
}

converters.ImportDefaultSpecifier = (
  path: Path,
  opts: Options,
  context: Context,
) => {
  return _convertImportSpecifier(path, opts, context);
};

converters.ImportSpecifier = (path: Path, opts: Options, context: Context) => {
  return _convertImportSpecifier(path, opts, context);
};

let convert = function(path: Path, opts: Options, context?: Context): Node {
  let converter = converters[path.type];

  if (!converter) {
    throw error(path, `No converter for node type: ${path.type}`);
  }

  // console.log(`convert(${path.type}, ${JSON.stringify(opts)}, ${JSON.stringify(context)})`);
  let converted = inheritsComments(converter(path, opts, context), path.node);

  return converted;
};

export default function convertTypeToPropTypes(
  typeAnnotation: Path,
  opts: Options,
): Node {
  return convert(typeAnnotation, opts, {
    depth: 0,
  });
}
