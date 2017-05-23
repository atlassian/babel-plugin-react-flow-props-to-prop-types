// @flow
import printAST from 'ast-pretty-print';
import type {Node} from './types';

export default function log(node: Node) {
  if (node.node) throw new Error('Called log() with Path');
  console.log(printAST(node, true));
}
