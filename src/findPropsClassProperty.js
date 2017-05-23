// @flow
import type {Path} from './types';

function isPropsClassProperty(path: Path) {
  return (
    path.isClassProperty() &&
    !path.node.computed &&
    !path.node.static &&
    path.node.key.name === 'props'
  );
}

export default function findPropsClassProperty(classBody: Path): Path | false {
  for (let item of classBody.get('body')) {
    if (isPropsClassProperty(item)) {
      return item;
    }
  }

  return false;
}
