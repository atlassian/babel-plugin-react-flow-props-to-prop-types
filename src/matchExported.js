// @flow
import {explodeModule} from 'babel-explode-module';
import {explodedToStatements} from 'babel-helper-simplify-module';
import format from 'babel-log';
import * as t from 'babel-types';
import error from './error';

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

  let local = match.local;

  if (!local) {
    return null;
  }

  let statement = file.path.get('body').find(item => {
    if (!item.isDeclaration()) return false;

    let id = null;

    if (item.isVariableDeclaration()) {
      id = item.node.declarations[0].id;
    } else if (item.isImportDeclaration()) {
      id = item.node.specifiers[0].local;
    } else if (item.node.id) {
      id = item.node.id;
    } else {
      throw error(item, `Unexpected node:\n\n${String(format(item))}`);
    }

    if (!id) {
      throw new Error(`Couldn't find id on node:\n\n${String(format(item))}`);
    }

    return id.name === local;
  });

  return statement || null;
}
