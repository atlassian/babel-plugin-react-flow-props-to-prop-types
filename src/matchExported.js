// @flow
import explodeModule from 'babel-explode-module';
import {explodedToStatements} from 'babel-helper-simplify-module';
import {format} from 'babel-log';
import * as t from 'babel-types';

export default function matchExported(file: Object, exportName: string) {
  let exploded = explodeModule(file.path.node);
  let statements = explodedToStatements(exploded);

  let program = Object.assign({}, file.path.node, {
    body: statements,
  });

  file.path.replaceWith(program);

  let match = exploded.exports.find(item => {
    return item.external === exportName;
  });

  if (!match) {
    return null;
  }

  let statement = file.path.get('body').find(item => {
    if (!item.isDeclaration()) return false;

    let id = null;

    if (item.isVariableDeclaration()) {
      id = item.node.declarations[0].id;
    } else if (item.node.id) {
      id = item.node.id;
    } else {
      throw new Error(`Unexpected node:\n\n${format(item)}`);
    }

    if (!id) {
      throw new Error(`Couldn't find id on node:\n\n${format(item)}`);
    }

    return id.name === match.local;
  });

  return statement || null;
}
