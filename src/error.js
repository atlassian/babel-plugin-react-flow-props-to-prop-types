// @flow
import type {Path} from './types';
import {buildCodeFrameError, toErrorStack} from 'babel-errors';

export default function error(path: Path, message: string) {
  let err = buildCodeFrameError(path, message);
  err.stack = toErrorStack(err);
  return err;
}
