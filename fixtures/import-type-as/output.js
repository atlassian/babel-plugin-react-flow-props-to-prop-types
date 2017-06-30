import _PropTypes from 'prop-types';
import type { a as b } from './other';

class Foo extends React.Component {
  props: {
    b: b
  };
  static propTypes = {
    b: _PropTypes.number.isRequired
  };
}
