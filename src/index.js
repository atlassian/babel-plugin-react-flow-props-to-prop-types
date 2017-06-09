// @flow
import type {Node, Path} from './types';
import * as t from 'babel-types';
import {isReactComponentClass} from 'babel-react-components';
import {findContextTypesClassProperty, findPropsClassProperty} from './finders';
import convertTypeToPropTypes from './convertTypeToPropTypes';

type PluginOptions = {
  resolveOpts?: Object,
};

export default function() {
  return {
    name: 'react-flow-props-to-prop-types',
    visitor: {
      Program(path: Path, state: {opts: PluginOptions}) {
        path.traverse({
          ClassDeclaration(path) {
            if (!isReactComponentClass(path)) {
              return;
            }

            const body = path.get('body');
            const props = findPropsClassProperty(body);
            const contextTypes = findContextTypesClassProperty(body);
            if (!props && !contextTypes) return;

            let propTypesRef;
            let propTypesAllRef;

            function getPropTypesRef() {
              if (!propTypesRef) {
                propTypesRef = path.hub.file.addImport(
                  'prop-types',
                  'default',
                  'PropTypes',
                );
              }
              return propTypesRef;
            }

            function getPropTypesAllRef() {
              if (!propTypesAllRef) {
                propTypesAllRef = path.hub.file.addImport(
                  'prop-types-extra/lib/all',
                  'default',
                  'all',
                );
              }
              return propTypesAllRef;
            }

            if(contextTypes) {
              const contextTypesClassProperty = t.classProperty(
                t.identifier('contextTypes'),
                convertTypeToPropTypes(contextTypes.get('typeAnnotation'), {
                  getPropTypesRef,
                  getPropTypesAllRef,
                  resolveOpts: state.opts.resolveOpts,
                }),
              );

              contextTypesClassProperty.static = true;

              contextTypes.insertAfter(contextTypesClassProperty);
            }

            if(props) {
              const propsTypeAnnotation = props.get('typeAnnotation');
              if (!propsTypeAnnotation.node) {
                throw props.buildCodeFrameError(
                  'React component props must have type annotation',
                );
              }

              const propTypesClassProperty = t.classProperty(
                t.identifier('propTypes'),
                convertTypeToPropTypes(propsTypeAnnotation, {
                  getPropTypesRef,
                  getPropTypesAllRef,
                  resolveOpts: state.opts.resolveOpts,
                }),
              );

              propTypesClassProperty.static = true;

              props.insertAfter(propTypesClassProperty);
            }
          },
        });
      },
    },
  };
}
