import _PropTypes from 'prop-types';
import type b from './other';

class Foo extends React.Component {
  props: {
    b: b
  };
  static propTypes = {
    b: _PropTypes.oneOf([1]).isRequired
  };
}
