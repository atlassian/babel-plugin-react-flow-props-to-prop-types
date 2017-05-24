// @flow
import type {Path} from './types';

const GLOBAL_NAME = 'React';
const MODULE_NAME = 'react';

let getBinding = path => {
  return path.scope.getBinding(path.node.name);
};

let isReactComponentMember = path => {
  return path.node.name === 'Component' || path.node.name === 'PureComponent';
};

let getSourceFromSpecifier = path => {
  return path.parent.source.value;
};

export default function isReactComponentSuperClass(superClass: Path) {
  if (superClass.isMemberExpression()) {
    let object: Path = superClass.get('object');
    let property: Path = superClass.get('property');

    if (!object.isIdentifier()) return false;

    let binding = getBinding(object);

    if (!binding) {
      if (object.node.name !== GLOBAL_NAME) return false;
    } else {
      if (binding.kind !== 'module') return false;
      if (!binding.path.isImportDefaultSpecifier()) return false;
      if (getSourceFromSpecifier(binding.path) !== MODULE_NAME) return false;
    }

    return isReactComponentMember(property);
  }

  if (superClass.isIdentifier()) {
    let binding = getBinding(superClass);
    if (!binding) return false;

    if (binding.kind !== 'module') return false;
    if (!binding.path.isImportSpecifier()) return false;
    if (getSourceFromSpecifier(binding.path) !== MODULE_NAME) return false;
    if (!isReactComponentMember(binding.path.get('imported'))) return false;

    return true;
  }

  throw superClass.buildCodeFrameError(
    `Unexpected super class type: ${superClass.type}`,
  );
}
