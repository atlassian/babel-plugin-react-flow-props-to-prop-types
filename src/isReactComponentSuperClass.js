// @flow
import type {Path} from './types';

export default function isReactComponentSuperClass(superClass: Path) {
  if (superClass.isMemberExpression()) {
    let object: Path = superClass.get('object');
    let property: Path = superClass.get('property');

    if (!object.isIdentifier()) {
      return false;
    }

    let objectBinding = object.scope.getBinding(object.node.name);

    if (!objectBinding) {
      if (object.node.name !== 'React') {
        return false;
      }
    } else {
    }

    if (
      property.node.name !== 'Component' &&
      property.node.name !== 'PureComponent'
    ) {
      return false;
    }

    return true;
  } else {
    // ...
  }
}
