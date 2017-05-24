// @flow
import type {Node, Path} from './types';
import * as t from 'babel-types';
import isReactComponentSuperClass from './isReactComponentSuperClass';
import findPropsClassProperty from './findPropsClassProperty';
import convertTypeToPropTypes from './convertTypeToPropTypes';
import {log} from 'babel-log';

export default function() {
  return {
    name: 'react-flow-props-to-prop-types',
    visitor: {
      ClassDeclaration(path: Path) {
        const superClass = path.get('superClass');
        if (!superClass.node) return;
        if (!isReactComponentSuperClass(superClass)) return;

        let props = findPropsClassProperty(path.get('body'));
        if (!props) return;

        let typeAnnotation = props.get('typeAnnotation');
        if (!typeAnnotation.node) {
          throw props.buildCodeFrameError(
            'React component props must have type annotation',
          );
        }

        let propTypesRef = path.hub.file.addImport(
          'prop-types',
          'default',
          'PropTypes',
        );

        let objectExpression = convertTypeToPropTypes(
          typeAnnotation,
          propTypesRef,
        );

        let propTypesClassProperty = t.classProperty(
          t.identifier('propTypes'),
          objectExpression,
        );

        propTypesClassProperty.static = true;

        props.insertBefore(propTypesClassProperty);
        props.remove();
      },
    },
  };
}
