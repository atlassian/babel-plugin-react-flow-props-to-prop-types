// @flow
import type {Path} from './types';

function isClassProperty(path: Path, name: string) {
  return (
    path.isClassProperty() &&
    !path.node.computed &&
    !path.node.static &&
    path.node.key.name === name
  );
}

export function findPropsClassProperty(classBody: Path): Path | false {
  for (let item of classBody.get('body')) {
    if (isClassProperty(item, 'props')) {
      return item;
    }
  }

  return false;
}

export function findContextTypesClassProperty(classBody: Path): Path | false {
  for (let item of classBody.get('body')) {
    if (isClassProperty(item, 'contextTypes')) {
      return item;
    }
  }

  return false;
}
